import { S_OK, type HRESULT } from "./types";

export type DComMessageType =
  | "ORPC_CALL"
  | "ORPC_RETURN"
  | "ORPC_ACTIVATE"
  | "ORPC_ACTIVATE_RETURN"
  | "OXID_PING"
  | "OXID_PING_ACK";

export interface DComMessage {
  msgType: DComMessageType;
  callId: string;
  senderId?: string;
  targetId?: string;
  oid?: string;
  ipid?: string;
  clsid?: string;
  riid?: string;
  method?: string;
  args?: any[];
  hr?: HRESULT;
  result?: any;
  error?: string;
  oxid?: string;
}

export interface IDComTransport {
  readonly channelName: string;
  send(message: DComMessage): void;
  onMessage(listener: (message: DComMessage) => void): () => void;
  close(): void;
}

// In-memory bus for Node / non-browser test environments or simulated multi-tab environments
const inMemoryBuses = new Map<string, Set<(msg: DComMessage) => void>>();

export class BroadcastChannelTransport implements IDComTransport {
  public readonly channelName: string;
  private bc: any = null;
  private listeners = new Set<(msg: DComMessage) => void>();
  private memoryBusListeners: Set<(msg: DComMessage) => void>;

  constructor(channelName = "win32-dcom-bus") {
    this.channelName = channelName;

    if (!inMemoryBuses.has(channelName)) {
      inMemoryBuses.set(channelName, new Set());
    }
    this.memoryBusListeners = inMemoryBuses.get(channelName)!;

    // Use native BroadcastChannel if supported in environment
    if (typeof globalThis.BroadcastChannel !== "undefined") {
      try {
        this.bc = new globalThis.BroadcastChannel(channelName);
        this.bc.onmessage = (event: MessageEvent) => {
          this.dispatch(event.data);
        };
      } catch {
        this.bc = null;
      }
    }
  }

  private dispatch(msg: DComMessage): void {
    for (const listener of this.listeners) {
      try {
        listener(msg);
      } catch (err) {
        console.error("Error in DCOM transport listener:", err);
      }
    }
  }

  public send(message: DComMessage): void {
    if (this.bc) {
      try {
        this.bc.postMessage(message);
      } catch (err) {
        console.warn("Failed to post message to BroadcastChannel:", err);
      }
    }

    // Also dispatch to in-memory listeners across instances/tabs in the same process
    for (const listener of this.memoryBusListeners) {
      if (!this.listeners.has(listener)) {
        try {
          listener(message);
        } catch (err) {
          console.error("Error in DCOM memory bus listener:", err);
        }
      }
    }
  }

  public onMessage(listener: (message: DComMessage) => void): () => void {
    this.listeners.add(listener);
    this.memoryBusListeners.add(listener);

    return () => {
      this.listeners.delete(listener);
      this.memoryBusListeners.delete(listener);
    };
  }

  public close(): void {
    for (const listener of this.listeners) {
      this.memoryBusListeners.delete(listener);
    }
    this.listeners.clear();

    if (this.bc) {
      try {
        this.bc.close();
      } catch {}
      this.bc = null;
    }
  }
}
