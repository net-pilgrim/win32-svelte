import {
  type IUnknown,
  type IDispatch,
  type HRESULT,
  type COSERVERINFO,
  S_OK,
  E_NOINTERFACE,
  E_FAIL,
  RPC_E_SERVERUNAVAILABLE,
  DISPATCH_METHOD,
  DISPATCH_PROPERTYGET,
  DISP_E_MEMBERNOTFOUND,
} from "./types";
import { createGuid, guidEquals, IID_IUnknown, IID_IDispatch } from "./guid";
import {
  type IDComTransport,
  type DComMessage,
  BroadcastChannelTransport,
} from "./transport";
import { comRegistry } from "./registry";

export interface ExportedStub {
  oid: string;
  ipid: string;
  instance: IUnknown | IDispatch | any;
  clsid?: string;
  createdAt: number;
  lastPing: number;
}

export class DComStubManager {
  private stubs = new Map<string, ExportedStub>(); // ipid -> stub
  private oidToIpids = new Map<string, Set<string>>(); // oid -> Set<ipid>
  private transport: IDComTransport;
  private unsubscribe: (() => void) | null = null;
  public readonly endpointId: string;

  constructor(transport?: IDComTransport) {
    this.endpointId = createGuid();
    this.transport = transport || new BroadcastChannelTransport();
    this.initListener();
  }

  private initListener(): void {
    this.unsubscribe = this.transport.onMessage((msg: DComMessage) => {
      this.handleIncomingMessage(msg);
    });
  }

  public exportObject(instance: IUnknown | any, clsid?: string): { oid: string; ipid: string } {
    const oid = createGuid();
    const ipid = createGuid();

    const stub: ExportedStub = {
      oid,
      ipid,
      instance,
      clsid,
      createdAt: Date.now(),
      lastPing: Date.now(),
    };

    this.stubs.set(ipid, stub);

    if (!this.oidToIpids.has(oid)) {
      this.oidToIpids.set(oid, new Set());
    }
    this.oidToIpids.get(oid)!.add(ipid);

    return { oid, ipid };
  }

  public revokeObject(ipid: string): boolean {
    const stub = this.stubs.get(ipid);
    if (!stub) return false;

    this.stubs.delete(ipid);
    const ipids = this.oidToIpids.get(stub.oid);
    if (ipids) {
      ipids.delete(ipid);
      if (ipids.size === 0) {
        this.oidToIpids.delete(stub.oid);
      }
    }
    return true;
  }

  public getStub(ipid: string): ExportedStub | null {
    return this.stubs.get(ipid) || null;
  }

  public getActiveStubs(): ExportedStub[] {
    return Array.from(this.stubs.values());
  }

  private async handleIncomingMessage(msg: DComMessage): Promise<void> {
    // 1. Activation request from a remote client
    if (msg.msgType === "ORPC_ACTIVATE") {
      if (!msg.clsid) return;
      const clsidNorm = comRegistry.CLSIDFromProgID(msg.clsid) || msg.clsid;

      // Check if we can activate this class locally
      const { comRuntime } = await import("./runtime");
      const objResult = comRuntime.createLocalInstance(clsidNorm);

      if (objResult.hr === S_OK && objResult.ppv) {
        const { oid, ipid } = this.exportObject(objResult.ppv, clsidNorm);
        this.transport.send({
          msgType: "ORPC_ACTIVATE_RETURN",
          callId: msg.callId,
          targetId: msg.senderId,
          senderId: this.endpointId,
          hr: S_OK,
          oid,
          ipid,
        });
      }
      return;
    }

    // 2. Remote method invocation
    if (msg.msgType === "ORPC_CALL") {
      if (!msg.ipid || !this.stubs.has(msg.ipid)) {
        return; // Not targeted to us or stub not found
      }

      const stub = this.stubs.get(msg.ipid)!;
      stub.lastPing = Date.now();
      const instance = stub.instance;

      try {
        let result: any;
        const method = msg.method || "";
        const args = msg.args || [];

        if (typeof instance.Invoke === "function") {
          // IDispatch interface invocation
          const invokeRes = instance.Invoke(method, null, 0, DISPATCH_METHOD | DISPATCH_PROPERTYGET, args);
          if (invokeRes.hr === S_OK) {
            result = invokeRes.pVarResult;
          } else if (typeof instance[method] === "function") {
            result = await instance[method](...args);
          } else {
            throw new Error(`Dispatch method '${method}' failed with hr=0x${(invokeRes.hr >>> 0).toString(16)}`);
          }
        } else if (typeof instance[method] === "function") {
          result = await instance[method](...args);
        } else if (method in instance) {
          result = instance[method];
        } else {
          this.transport.send({
            msgType: "ORPC_RETURN",
            callId: msg.callId,
            targetId: msg.senderId,
            senderId: this.endpointId,
            hr: DISP_E_MEMBERNOTFOUND,
            error: `Method or property '${method}' not found on target`,
          });
          return;
        }

        this.transport.send({
          msgType: "ORPC_RETURN",
          callId: msg.callId,
          targetId: msg.senderId,
          senderId: this.endpointId,
          hr: S_OK,
          result,
        });
      } catch (err: any) {
        this.transport.send({
          msgType: "ORPC_RETURN",
          callId: msg.callId,
          targetId: msg.senderId,
          senderId: this.endpointId,
          hr: E_FAIL,
          error: err?.message || String(err),
        });
      }
      return;
    }

    // 3. Keep-alive OXID Ping
    if (msg.msgType === "OXID_PING") {
      if (msg.oid) {
        const ipids = this.oidToIpids.get(msg.oid);
        if (ipids) {
          for (const ipid of ipids) {
            const stub = this.stubs.get(ipid);
            if (stub) stub.lastPing = Date.now();
          }
        }
      }
    }
  }

  public destroy(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.stubs.clear();
    this.oidToIpids.clear();
    this.transport.close();
  }
}

export const dcomStubManager = new DComStubManager();

/**
 * Creates a transparent client-side proxy (DComProxy)
 * that intercepts property & method calls and dispatches them across the transport.
 */
export function createDComProxy<T = any>(
  oid: string,
  ipid: string,
  transport: IDComTransport = new BroadcastChannelTransport(),
  timeoutMs = 5000
): T {
  const pendingCalls = new Map<string, { resolve: (val: any) => void; reject: (err: any) => void; timer: any }>();

  const unsubscribe = transport.onMessage((msg: DComMessage) => {
    if (msg.msgType === "ORPC_RETURN" && pendingCalls.has(msg.callId)) {
      const call = pendingCalls.get(msg.callId)!;
      pendingCalls.delete(msg.callId);
      clearTimeout(call.timer);

      if (msg.hr === S_OK) {
        call.resolve(msg.result);
      } else {
        call.reject(new Error(msg.error || `Remote call returned error hr=0x${((msg.hr || 0) >>> 0).toString(16)}`));
      }
    }
  });

  const sendCall = (method: string, args: any[]): Promise<any> => {
    return new Promise((resolve, reject) => {
      const callId = createGuid();
      const timer = setTimeout(() => {
        pendingCalls.delete(callId);
        reject(new Error(`DCOM Call '${method}' timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      pendingCalls.set(callId, { resolve, reject, timer });

      transport.send({
        msgType: "ORPC_CALL",
        callId,
        oid,
        ipid,
        method,
        args,
      });
    });
  };

  const proxyTarget = {
    _oid: oid,
    _ipid: ipid,
    QueryInterface: (riid: string) => {
      if (guidEquals(riid, IID_IUnknown) || guidEquals(riid, IID_IDispatch)) {
        return { hr: S_OK, ppv: proxyTarget };
      }
      return { hr: E_NOINTERFACE, ppv: null };
    },
    AddRef: () => 1,
    Release: () => {
      unsubscribe();
      return 0;
    },
  };

  return new Proxy(proxyTarget as any, {
    get(target, prop, receiver) {
      if (prop in target || typeof prop === "symbol") {
        return Reflect.get(target, prop, receiver);
      }
      const methodName = String(prop);
      return (...args: any[]) => sendCall(methodName, args);
    },
  });
}
