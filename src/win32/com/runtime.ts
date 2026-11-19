import {
  type IUnknown,
  type IClassFactory,
  type IDispatch,
  type HRESULT,
  type COSERVERINFO,
  type MULTI_QI,
  S_OK,
  S_FALSE,
  E_NOINTERFACE,
  E_POINTER,
  CLASS_E_CLASSNOTAVAILABLE,
  REGDB_E_CLASSNOTREG,
  RPC_E_SERVERUNAVAILABLE,
  CLSCTX_INPROC_SERVER,
  CLSCTX_LOCAL_SERVER,
  CLSCTX_REMOTE_SERVER,
  CLSCTX_ALL,
  COINIT_APARTMENTTHREADED,
} from "./types";
import {
  normalizeGuidString,
  guidEquals,
  createGuid,
  IID_IUnknown,
  IID_IClassFactory,
  IID_IDispatch,
  CLSID_CalcEngine,
  CLSID_AudioSynthesizer,
  CLSID_NotepadDocument,
  CLSID_ExplorerVFS,
} from "./guid";
import { comRegistry } from "./registry";
import { createDispatchProxy } from "./dispatch";
import {
  CalcEngineServer,
  AudioSynthesizerServer,
  NotepadDocumentServer,
  ExplorerVFSServer,
} from "./servers";
import { dcomStubManager, createDComProxy } from "./dcom";
import { BroadcastChannelTransport, type DComMessage } from "./transport";

/**
 * Standard generic ClassFactory implementation.
 */
export class SimpleClassFactory implements IClassFactory {
  private createFn: () => IUnknown;
  private refCount = 1;

  constructor(createFn: () => IUnknown) {
    this.createFn = createFn;
  }

  public QueryInterface(riid: string): { hr: HRESULT; ppv: any } {
    if (guidEquals(riid, IID_IUnknown) || guidEquals(riid, IID_IClassFactory)) {
      this.AddRef();
      return { hr: S_OK, ppv: this };
    }
    return { hr: E_NOINTERFACE, ppv: null };
  }

  public AddRef(): number {
    return ++this.refCount;
  }

  public Release(): number {
    return --this.refCount;
  }

  public CreateInstance(pUnkOuter: IUnknown | null, riid: string): { hr: HRESULT; ppv: any } {
    if (pUnkOuter) {
      return { hr: 0x80040110 | 0, ppv: null }; // CLASS_E_NOAGGREGATION
    }
    try {
      const obj = this.createFn();
      return obj.QueryInterface(riid);
    } catch {
      return { hr: CLASS_E_CLASSNOTAVAILABLE, ppv: null };
    }
  }

  public LockServer(_fLock: boolean): HRESULT {
    return S_OK;
  }
}

class ComRuntime {
  private initializedCount = 0;
  private classFactories = new Map<string, IClassFactory>(); // clsid -> IClassFactory
  private registrationCookies = new Map<number, string>(); // cookie -> clsid
  private nextCookie = 1000;

  constructor() {
    this.registerBuiltinClassFactories();
  }

  private registerBuiltinClassFactories(): void {
    // 1. Calc.Engine
    this.registerClassFactory(
      CLSID_CalcEngine,
      new SimpleClassFactory(() => new CalcEngineServer())
    );

    // 2. Audio.Synthesizer
    this.registerClassFactory(
      CLSID_AudioSynthesizer,
      new SimpleClassFactory(() => new AudioSynthesizerServer())
    );

    // 3. Notepad.Document
    this.registerClassFactory(
      CLSID_NotepadDocument,
      new SimpleClassFactory(() => new NotepadDocumentServer())
    );

    // 4. Explorer.VFS
    this.registerClassFactory(
      CLSID_ExplorerVFS,
      new SimpleClassFactory(() => new ExplorerVFSServer())
    );
  }

  public registerClassFactory(clsid: string, factory: IClassFactory): number {
    const clsidNorm = normalizeGuidString(clsid);
    this.classFactories.set(clsidNorm, factory);
    const cookie = ++this.nextCookie;
    this.registrationCookies.set(cookie, clsidNorm);
    return cookie;
  }

  public revokeClassFactory(cookie: number): boolean {
    const clsid = this.registrationCookies.get(cookie);
    if (!clsid) return false;
    this.registrationCookies.delete(cookie);
    this.classFactories.delete(clsid);
    return true;
  }

  public CoInitialize(pvReserved?: any): HRESULT {
    return this.CoInitializeEx(pvReserved, COINIT_APARTMENTTHREADED);
  }

  public CoInitializeEx(_pvReserved?: any, _dwCoInit = COINIT_APARTMENTTHREADED): HRESULT {
    this.initializedCount++;
    return this.initializedCount === 1 ? S_OK : S_FALSE;
  }

  public CoUninitialize(): void {
    if (this.initializedCount > 0) {
      this.initializedCount--;
    }
  }

  public isInitialized(): boolean {
    return this.initializedCount > 0;
  }

  public CoRegisterClassObject(
    rclsid: string,
    pUnk: IUnknown,
    _dwClsContext = CLSCTX_INPROC_SERVER,
    _flags = 1
  ): { hr: HRESULT; dwRegister: number } {
    const qiRes = pUnk.QueryInterface(IID_IClassFactory);
    if (qiRes.hr !== S_OK || !qiRes.ppv) {
      return { hr: E_NOINTERFACE, dwRegister: 0 };
    }
    const cookie = this.registerClassFactory(rclsid, qiRes.ppv as IClassFactory);
    return { hr: S_OK, dwRegister: cookie };
  }

  public CoRevokeClassObject(dwRegister: number): HRESULT {
    return this.revokeClassFactory(dwRegister) ? S_OK : 0x80040154 | 0;
  }

  public CoGetClassObject(
    rclsid: string,
    _dwClsContext = CLSCTX_ALL,
    _pServerInfo?: COSERVERINFO | null,
    riid = IID_IClassFactory
  ): { hr: HRESULT; ppv: any } {
    const clsidNorm = comRegistry.CLSIDFromProgID(rclsid) || normalizeGuidString(rclsid);
    const factory = this.classFactories.get(clsidNorm);
    if (!factory) {
      return { hr: REGDB_E_CLASSNOTREG, ppv: null };
    }
    return factory.QueryInterface(riid);
  }

  public createLocalInstance(rclsid: string, riid = IID_IUnknown): { hr: HRESULT; ppv: any } {
    const clsidNorm = comRegistry.CLSIDFromProgID(rclsid) || normalizeGuidString(rclsid);
    const factoryRes = this.CoGetClassObject(clsidNorm, CLSCTX_ALL, null, IID_IClassFactory);
    if (factoryRes.hr !== S_OK || !factoryRes.ppv) {
      return { hr: factoryRes.hr, ppv: null };
    }
    const factory = factoryRes.ppv as IClassFactory;
    return factory.CreateInstance(null, riid);
  }

  public CoCreateInstance(
    rclsid: string,
    pUnkOuter: IUnknown | null = null,
    dwClsContext = CLSCTX_ALL,
    riid = IID_IUnknown
  ): { hr: HRESULT; ppv: any } {
    const clsidNorm = comRegistry.CLSIDFromProgID(rclsid) || normalizeGuidString(rclsid);

    // In-proc or local server creation
    const factoryRes = this.CoGetClassObject(clsidNorm, dwClsContext, null, IID_IClassFactory);
    if (factoryRes.hr !== S_OK || !factoryRes.ppv) {
      return { hr: factoryRes.hr, ppv: null };
    }

    const factory = factoryRes.ppv as IClassFactory;
    return factory.CreateInstance(pUnkOuter, riid);
  }

  public async CoCreateInstanceEx(
    rclsid: string,
    pUnkOuter: IUnknown | null = null,
    dwClsContext = CLSCTX_ALL,
    pServerInfo: COSERVERINFO | null = null,
    cmq = 1,
    pResults?: MULTI_QI[]
  ): Promise<{ hr: HRESULT; ppv: any }> {
    const clsidNorm = comRegistry.CLSIDFromProgID(rclsid) || normalizeGuidString(rclsid);
    const serverName = pServerInfo?.pwszName || "local";

    // 1. Local execution
    if (serverName === "local" || (dwClsContext & CLSCTX_INPROC_SERVER) && !pServerInfo) {
      const res = this.CoCreateInstance(clsidNorm, pUnkOuter, dwClsContext, IID_IUnknown);
      if (pResults && pResults.length > 0) {
        for (const qi of pResults) {
          if (res.hr === S_OK && res.ppv) {
            const subQi = res.ppv.QueryInterface(qi.pIID);
            qi.hr = subQi.hr;
            qi.pItf = subQi.ppv;
          } else {
            qi.hr = res.hr;
            qi.pItf = null;
          }
        }
      }
      return res;
    }

    // 2. Remote execution via BroadcastChannel / DCOM bus
    const channelName = serverName.startsWith("broadcast://")
      ? serverName.replace("broadcast://", "")
      : serverName.startsWith("tab://")
      ? `win32-tab-${serverName.replace("tab://", "")}`
      : "win32-dcom-bus";

    const transport = new BroadcastChannelTransport(channelName);

    return new Promise<{ hr: HRESULT; ppv: any }>((resolve) => {
      const callId = createGuid();
      let resolved = false;

      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          unsubscribe();
          resolve({ hr: RPC_E_SERVERUNAVAILABLE, ppv: null });
        }
      }, 3000);

      const unsubscribe = transport.onMessage((msg: DComMessage) => {
        if (msg.msgType === "ORPC_ACTIVATE_RETURN" && msg.callId === callId) {
          if (!resolved) {
            resolved = true;
            clearTimeout(timer);
            unsubscribe();

            if (msg.hr === S_OK && msg.oid && msg.ipid) {
              const proxy = createDComProxy(msg.oid, msg.ipid, transport);
              if (pResults && pResults.length > 0) {
                pResults[0].hr = S_OK;
                pResults[0].pItf = proxy;
              }
              resolve({ hr: S_OK, ppv: proxy });
            } else {
              resolve({ hr: msg.hr || RPC_E_SERVERUNAVAILABLE, ppv: null });
            }
          }
        }
      });

      // Send remote activation broadcast
      transport.send({
        msgType: "ORPC_ACTIVATE",
        callId,
        clsid: clsidNorm,
        riid: IID_IUnknown,
      });
    });
  }

  /**
   * High-level automation helper: CreateObject(progIdOrClsid, [serverName])
   * Returns a friendly Proxy wrapping IDispatch for direct method invocation.
   */
  public async CreateObject<T = any>(progIdOrClsid: string, serverName?: string): Promise<T> {
    if (serverName && serverName !== "local") {
      const res = await this.CoCreateInstanceEx(
        progIdOrClsid,
        null,
        CLSCTX_REMOTE_SERVER,
        { pwszName: serverName },
        1
      );
      if (res.hr !== S_OK || !res.ppv) {
        throw new Error(`Failed to activate remote COM object '${progIdOrClsid}' on '${serverName}' (hr=0x${(res.hr >>> 0).toString(16)})`);
      }
      return res.ppv;
    }

    const res = this.CoCreateInstance(progIdOrClsid, null, CLSCTX_ALL, IID_IDispatch);
    if (res.hr !== S_OK || !res.ppv) {
      throw new Error(`Failed to create COM object '${progIdOrClsid}' (hr=0x${(res.hr >>> 0).toString(16)})`);
    }

    return createDispatchProxy(res.ppv as IDispatch);
  }
}

export const comRuntime = new ComRuntime();

// Top-level Win32 COM procedural exports
export const CoInitialize = (pvReserved?: any) => comRuntime.CoInitialize(pvReserved);
export const CoInitializeEx = (pvReserved?: any, dwCoInit?: number) => comRuntime.CoInitializeEx(pvReserved, dwCoInit);
export const CoUninitialize = () => comRuntime.CoUninitialize();
export const CoRegisterClassObject = (rclsid: string, pUnk: IUnknown, dwClsContext?: number, flags?: number) =>
  comRuntime.CoRegisterClassObject(rclsid, pUnk, dwClsContext, flags);
export const CoRevokeClassObject = (dwRegister: number) => comRuntime.CoRevokeClassObject(dwRegister);
export const CoGetClassObject = (rclsid: string, dwClsContext?: number, pServerInfo?: COSERVERINFO | null, riid?: string) =>
  comRuntime.CoGetClassObject(rclsid, dwClsContext, pServerInfo, riid);
export const CoCreateInstance = (rclsid: string, pUnkOuter?: IUnknown | null, dwClsContext?: number, riid?: string) =>
  comRuntime.CoCreateInstance(rclsid, pUnkOuter, dwClsContext, riid);
export const CoCreateInstanceEx = (
  rclsid: string,
  pUnkOuter?: IUnknown | null,
  dwClsContext?: number,
  pServerInfo?: COSERVERINFO | null,
  cmq?: number,
  pResults?: MULTI_QI[]
) => comRuntime.CoCreateInstanceEx(rclsid, pUnkOuter, dwClsContext, pServerInfo, cmq, pResults);
export const CreateObject = (progIdOrClsid: string, serverName?: string) => comRuntime.CreateObject(progIdOrClsid, serverName);
