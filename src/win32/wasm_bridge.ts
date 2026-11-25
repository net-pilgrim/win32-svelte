import {
  kernel,
  DefWindowProc,
  SendMessage,
  PostMessage,
  PostQuitMessage,
  SetWindowText,
  GetWindowText,
  ShowWindow,
  MessageBox,
  SetTimer,
  KillTimer,
  DestroyWindow,
  GetSystemMetrics,
} from "./kernel.svelte";
import {
  BeginPaint,
  EndPaint,
  MoveToEx,
  LineTo,
  Rectangle,
  Ellipse,
  TextOut,
  SetTextColor,
  SetBkColor,
  CreateSolidBrush,
  CreatePen,
  SelectObject,
  InvalidateRect,
  FillRect,
  GetWindowCanvas,
  HDC,
} from "./gdi";
import { MessageBeep } from "./audio";
import type { HWND, UINT, WPARAM, LPARAM, LRESULT, RECT, WndProc } from "./types";
import { WM_DESTROY } from "./constants";
import { StartNotepad } from "../samples/notepad";
import { comRuntime } from "./com/runtime";
import { S_OK, E_POINTER, E_NOINTERFACE, CLSCTX_ALL } from "./com/types";
import { IID_IUnknown } from "./com/guid";
import {
  SvgMetafile,
  MetafileSvgRecorder,
  parseEmfToSvg,
  parseWmfToSvg,
  type MetafileBounds,
} from "./metafile_svg";

export interface WasmBridgeOptions {
  initialX?: number;
  initialY?: number;
}

export interface WasmStringLogEntry {
  timestamp: number;
  api: string;
  ptr: number;
  text: string;
  direction: "read" | "write";
}

export interface WasmTableEntryInfo {
  index: number;
  isCallable: boolean;
  name?: string;
}

export interface WasmRuntimeStats {
  memorySizeBytes: number;
  memoryPages: number;
  tableLength: number;
  tableEntries: WasmTableEntryInfo[];
  stringLogs: WasmStringLogEntry[];
  registeredWndProcIndices: number[];
  activeHdcCount: number;
  activeGdiObjectCount: number;
}

export const activeWasmRuntimes = new Set<Win32WasmRuntime>();

interface ClipboardViewerEntry {
  runtime: Win32WasmRuntime;
  hwnd: number;
}

export const systemClipboardData = new Map<number, Uint8Array>();
export let systemClipboardOwner = 0;
export let systemClipboardOpenHwnd = 0;
export const systemClipboardViewers: ClipboardViewerEntry[] = [];

function createSyntheticBmp(width: number, height: number, topDown = false): Uint8Array {
  const absHeight = Math.abs(height);
  const rowBytes = Math.floor(((width * 8 + 31) & ~31) / 8);
  const imageSize = rowBytes * absHeight;
  const numColors = 256;
  const headerSize = 40;
  const paletteSize = numColors * 4;
  const bfOffBits = 14 + headerSize + paletteSize;
  const fileSize = bfOffBits + imageSize;

  const buf = new Uint8Array(fileSize);
  const view = new DataView(buf.buffer);

  // BITMAPFILEHEADER (14 bytes)
  view.setUint16(0, 0x4D42, true); // 'BM'
  view.setUint32(2, fileSize, true);
  view.setUint16(6, 0, true);
  view.setUint16(8, 0, true);
  view.setUint32(10, bfOffBits, true);

  // BITMAPINFOHEADER (40 bytes)
  view.setUint32(14, headerSize, true);
  view.setInt32(18, width, true);
  view.setInt32(22, topDown ? -absHeight : absHeight, true);
  view.setUint16(26, 1, true); // planes
  view.setUint16(28, 8, true); // 8 bpp
  view.setUint32(30, 0, true); // BI_RGB
  view.setUint32(34, imageSize, true);
  view.setInt32(38, 2835, true);
  view.setInt32(42, 2835, true);
  view.setUint32(46, numColors, true);
  view.setUint32(50, numColors, true);

  // Palette: 256 grayscale entries
  let palOffset = 54;
  for (let i = 0; i < 256; i++) {
    buf[palOffset + 0] = i; // B
    buf[palOffset + 1] = i; // G
    buf[palOffset + 2] = i; // R
    buf[palOffset + 3] = 0;
    palOffset += 4;
  }

  // Pixels: test pattern (checker / gradient)
  for (let y = 0; y < absHeight; y++) {
    const rowOffset = bfOffBits + y * rowBytes;
    for (let x = 0; x < width; x++) {
      buf[rowOffset + x] = ((x ^ y) & 0x7f) + 64;
    }
  }

  return buf;
}

interface ParsedDibInfo {
  biSize: number;
  width: number;
  height: number;
  isTopDown: boolean;
  planes: number;
  bitCount: number;
  compression: number;
  numColors: number;
  palettePtr: number;
  headerSize: number;
}

function parseDibInfo(view: DataView, pbmiPtr: number): ParsedDibInfo {
  const biSize = view.getUint32(pbmiPtr + 0, true);
  let width = 0;
  let height = 0;
  let planes = 1;
  let bitCount = 0;
  let compression = 0; // BI_RGB
  let clrUsed = 0;
  const headerSize = biSize;

  if (biSize === 12) { // BITMAPCOREHEADER
    width = view.getUint16(pbmiPtr + 4, true);
    height = view.getUint16(pbmiPtr + 6, true);
    planes = view.getUint16(pbmiPtr + 8, true);
    bitCount = view.getUint16(pbmiPtr + 10, true);
  } else { // BITMAPINFOHEADER (40), BITMAPV4HEADER (108), BITMAPV5HEADER (124)
    width = view.getInt32(pbmiPtr + 4, true);
    height = view.getInt32(pbmiPtr + 8, true);
    planes = view.getUint16(pbmiPtr + 12, true);
    bitCount = view.getUint16(pbmiPtr + 14, true);
    compression = view.getUint32(pbmiPtr + 16, true);
    clrUsed = view.getUint32(pbmiPtr + 32, true);
  }

  const isTopDown = height < 0;
  const absHeight = Math.abs(height);

  let numColors = clrUsed;
  if (numColors === 0 && bitCount <= 8) {
    numColors = 1 << bitCount;
  }

  const palettePtr = pbmiPtr + headerSize;
  return {
    biSize,
    width,
    height: absHeight,
    isTopDown,
    planes,
    bitCount,
    compression,
    numColors,
    palettePtr,
    headerSize,
  };
}

function renderDibToCanvas(
  memBuffer: ArrayBuffer,
  pbmiPtr: number,
  pBitsPtr: number
): HTMLCanvasElement | null {
  const view = new DataView(memBuffer);
  const info = parseDibInfo(view, pbmiPtr);
  if (!info.width || !info.height) return null;

  const canvas = document.createElement("canvas");
  canvas.width = info.width;
  canvas.height = info.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const imgData = ctx.createImageData(info.width, info.height);
  const dst = imgData.data;

  const isCore = info.biSize === 12;
  const paletteEntrySize = isCore ? 3 : 4;
  const paletteU8 = new Uint8Array(memBuffer, info.palettePtr, info.numColors * paletteEntrySize);

  const rowBytes = Math.floor(((info.width * info.bitCount + 31) & ~31) / 8);
  const srcU8 = new Uint8Array(memBuffer);

  for (let row = 0; row < info.height; row++) {
    const srcRow = info.isTopDown ? row : (info.height - 1 - row);
    const srcRowOffset = pBitsPtr + srcRow * rowBytes;
    const dstRowOffset = row * (info.width * 4);

    if (info.bitCount === 1) {
      for (let x = 0; x < info.width; x++) {
        const byteVal = srcU8[srcRowOffset + (x >> 3)];
        const bit = (byteVal >> (7 - (x & 7))) & 1;
        const palIdx = bit * paletteEntrySize;
        const dstIdx = dstRowOffset + x * 4;
        dst[dstIdx + 0] = paletteU8[palIdx + 2];
        dst[dstIdx + 1] = paletteU8[palIdx + 1];
        dst[dstIdx + 2] = paletteU8[palIdx + 0];
        dst[dstIdx + 3] = 255;
      }
    } else if (info.bitCount === 4) {
      for (let x = 0; x < info.width; x++) {
        const byteVal = srcU8[srcRowOffset + (x >> 1)];
        const nibble = (x & 1) === 0 ? (byteVal >> 4) : (byteVal & 0x0f);
        const palIdx = nibble * paletteEntrySize;
        const dstIdx = dstRowOffset + x * 4;
        dst[dstIdx + 0] = paletteU8[palIdx + 2];
        dst[dstIdx + 1] = paletteU8[palIdx + 1];
        dst[dstIdx + 2] = paletteU8[palIdx + 0];
        dst[dstIdx + 3] = 255;
      }
    } else if (info.bitCount === 8) {
      for (let x = 0; x < info.width; x++) {
        const palEntry = srcU8[srcRowOffset + x];
        const palIdx = palEntry * paletteEntrySize;
        const dstIdx = dstRowOffset + x * 4;
        dst[dstIdx + 0] = paletteU8[palIdx + 2];
        dst[dstIdx + 1] = paletteU8[palIdx + 1];
        dst[dstIdx + 2] = paletteU8[palIdx + 0];
        dst[dstIdx + 3] = 255;
      }
    } else if (info.bitCount === 24) {
      for (let x = 0; x < info.width; x++) {
        const srcIdx = srcRowOffset + x * 3;
        const dstIdx = dstRowOffset + x * 4;
        dst[dstIdx + 0] = srcU8[srcIdx + 2];
        dst[dstIdx + 1] = srcU8[srcIdx + 1];
        dst[dstIdx + 2] = srcU8[srcIdx + 0];
        dst[dstIdx + 3] = 255;
      }
    } else if (info.bitCount === 32) {
      for (let x = 0; x < info.width; x++) {
        const srcIdx = srcRowOffset + x * 4;
        const dstIdx = dstRowOffset + x * 4;
        dst[dstIdx + 0] = srcU8[srcIdx + 2];
        dst[dstIdx + 1] = srcU8[srcIdx + 1];
        dst[dstIdx + 2] = srcU8[srcIdx + 0];
        dst[dstIdx + 3] = 255;
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

export class Win32WasmRuntime {
  private instance: WebAssembly.Instance | null = null;
  private memory: WebAssembly.Memory | null = null;
  private table: WebAssembly.Table | null = null;

  private nextHdcHandle = 8000;
  private hdcMap = new Map<number, HDC>();

  private nextGdiHandle = 9000;
  private gdiMap = new Map<number, any>();

  private nextComHandle = 7000;
  private comObjectMap = new Map<number, any>();
  private heapBumpPtr = 0x80000;

  private registeredClasses = new Map<string, WndProc>();
  private stringLogs: WasmStringLogEntry[] = [];
  private registeredWndProcIndices: number[] = [];
  private capturedHwnd: number | null = null;
  private cursorPos = { x: 100, y: 100 };
  private windowLongs = new Map<string, number>();
  private hdcRop2 = new Map<number, number>();
  private poePoemPtr = 0;
  private globalAllocMap = new Map<number, { size: number; flags: number; locked: number }>();
  private openFileMap = new Map<number, { fileName: string; data: Uint8Array; position: number }>();
  private metafileMap = new Map<number, any>();
  private static sharedEmfFiles = new Map<string, any>();
  private peekMessageCount = 0;
  private timerMap = new Map<number, any>();
  private nextTimerId = 1;
  private nextEventHandle = 1000;
  private eventMap = new Map<number, { manualReset: boolean; signaled: boolean }>();
  private nextThreadId = 1;
  private activeThreads = new Map<number, {
    fnIdx: number;
    arg: number;
    timerId?: any;
    active: boolean;
    iterationCount?: number;
  }>();
  private currentThreadInfo: any = null;

  private notifyEventWaiters(hEvent: number): void {
    for (const [, thread] of this.activeThreads) {
      if (thread.active && this.table) {
        const fn = this.table.get(thread.fnIdx);
        if (typeof fn === "function") {
          setTimeout(() => {
            if (thread.active) {
              try {
                fn(thread.arg);
              } catch (e) {
                console.error("Thread execution error:", e);
              }
            }
          }, 0);
        }
      }
    }
  }

  private normalizeMetafileName(name: string): string {
    return name.toLowerCase().replace(/\\/g, "/").split("/").pop() || name.toLowerCase();
  }

  public static registerEmf(name: string, data: Uint8Array | SvgMetafile): void {
    const norm = name.toLowerCase().replace(/\\/g, "/").split("/").pop() || name.toLowerCase();
    const metafile = data instanceof SvgMetafile ? data : parseEmfToSvg(data, norm);
    Win32WasmRuntime.sharedEmfFiles.set(norm, {
      type: "enhmetafile",
      name: norm,
      description: metafile.description,
      bounds: metafile.bounds,
      frame: metafile.frame,
      metafile,
      canvas: metafile.canvas,
      ctx: metafile.ctx,
      toSvg: (w?: number, h?: number) => metafile.toSvg(w, h),
    });
  }

  public static async preloadEmfFiles(): Promise<void> {
    const files = [
      "emf2.emf",
      "emf3.emf",
      "emf4.emf",
      "emf7.emf",
      "emf8.emf",
      "emf11.emf",
      "emf12.emf",
    ];
    if (typeof fetch === "undefined") return;
    await Promise.all(
      files.map(async (f) => {
        if (Win32WasmRuntime.sharedEmfFiles.has(f)) return;
        try {
          const resp = await fetch(`/wasm-demo/${f}`);
          if (resp.ok) {
            const buf = await resp.arrayBuffer();
            Win32WasmRuntime.registerEmf(f, new Uint8Array(buf));
          }
        } catch {
          // ignore network errors if offline
        }
      })
    );
  }

  private createSampleEmf(name: string): any {
    // If in Node environment, try reading candidate files directly
    if (typeof process !== "undefined" && process.versions?.node) {
      try {
        const fs = require("fs");
        const path = require("path");
        const candidates = [
          path.resolve(process.cwd(), "public/wasm-demo", name),
          path.resolve(process.cwd(), "harness/src/Chap18", name.replace(/\.emf$/i, ""), name),
          path.resolve(process.cwd(), "harness/src/Chap18", name.toLowerCase().replace(/\.emf$/i, ""), name.toLowerCase()),
          path.resolve(process.cwd(), name),
        ];
        for (const cand of candidates) {
          if (fs.existsSync(cand)) {
            const buf = fs.readFileSync(cand);
            const parsed = parseEmfToSvg(new Uint8Array(buf), name);
            return {
              type: "enhmetafile",
              name,
              description: parsed.description,
              bounds: parsed.bounds,
              frame: parsed.frame,
              metafile: parsed,
              canvas: parsed.canvas,
              ctx: parsed.ctx,
              toSvg: (w?: number, h?: number) => parsed.toSvg(w, h),
            };
          }
        }
      } catch {}
    }

    // Resolution-independent SVG Metafile sample
    const metafile = new SvgMetafile(
      "enhmetafile",
      { left: 0, top: 0, right: 600, bottom: 200 },
      { left: 0, top: 0, right: 15240, bottom: 5080 },
      name,
      "EMF Demo Vector Metafile"
    );

    metafile.commands.push({
      type: "rect",
      x: 10,
      y: 10,
      w: 580,
      h: 180,
      fill: "#ffffff",
      stroke: "#000000",
      strokeWidth: 2,
    });

    if (name.includes("3")) {
      metafile.commands.push({
        type: "rect",
        x: 100,
        y: 50,
        w: 100,
        h: 100,
        fill: "#0000ff",
        stroke: "#ff0000",
        strokeWidth: 2,
      });
      metafile.commands.push({
        type: "line",
        x1: 100,
        y1: 50,
        x2: 200,
        y2: 150,
        stroke: "#ff0000",
        strokeWidth: 2,
      });
      metafile.commands.push({
        type: "line",
        x1: 200,
        y1: 50,
        x2: 100,
        y2: 150,
        stroke: "#ff0000",
        strokeWidth: 2,
      });
    } else {
      for (let i = 1; i < 96; i++) {
        const x = 10 + (i * 580) / 96;
        const h = i % 16 === 0 ? 50 : i % 8 === 0 ? 35 : i % 4 === 0 ? 25 : 15;
        metafile.commands.push({
          type: "line",
          x1: x,
          y1: 10,
          x2: x,
          y2: 10 + h,
          stroke: "#000000",
          strokeWidth: 1,
        });
      }
    }

    return {
      type: "enhmetafile",
      name,
      description: metafile.description,
      bounds: metafile.bounds,
      frame: metafile.frame,
      metafile,
      canvas: metafile.canvas,
      ctx: metafile.ctx,
      toSvg: (w?: number, h?: number) => metafile.toSvg(w, h),
    };
  }

  constructor(private options: WasmBridgeOptions = {}) {}

  public static getActiveRuntimes(): Win32WasmRuntime[] {
    return Array.from(activeWasmRuntimes);
  }

  public logString(api: string, ptr: number, text: string, direction: "read" | "write" = "read") {
    this.stringLogs.push({
      timestamp: Date.now(),
      api,
      ptr,
      text,
      direction,
    });
    if (this.stringLogs.length > 100) {
      this.stringLogs.shift();
    }
  }

  public readCString(ptr: number, api = "readCString"): string {
    if (!ptr || !this.memory) return "";
    const bytes = new Uint8Array(this.memory.buffer);
    let str = "";
    let i = ptr;
    while (i < bytes.length && bytes[i] !== 0) {
      str += String.fromCharCode(bytes[i]);
      i++;
    }
    this.logString(api, ptr, str, "read");
    return str;
  }

  public writeCString(ptr: number, str: string, maxCount: number, api = "writeCString"): number {
    if (!ptr || !this.memory || maxCount <= 0) return 0;
    const bytes = new Uint8Array(this.memory.buffer);
    const toWrite = Math.min(str.length, maxCount - 1);
    for (let i = 0; i < toWrite; i++) {
      bytes[ptr + i] = str.charCodeAt(i) & 0xff;
    }
    bytes[ptr + toWrite] = 0;
    this.logString(api, ptr, str.substring(0, toWrite), "write");
    return toWrite;
  }

  private colorRefToRgb(colorRef: number): string {
    const r = colorRef & 0xff;
    const g = (colorRef >> 8) & 0xff;
    const b = (colorRef >> 16) & 0xff;
    return `rgb(${r},${g},${b})`;
  }

  public readGuidFromMemory(ptr: number): string {
    if (!this.memory || !ptr) return "";
    const u8 = new Uint8Array(this.memory.buffer);
    if (u8[ptr] === 0x7b /* '{' */ || (u8[ptr] >= 0x41 && u8[ptr] <= 0x7a)) {
      const str = this.readCString(ptr);
      if (str.startsWith("{") || str.includes(".")) {
        return str;
      }
    }
    const view = new DataView(this.memory.buffer);
    const d1 = view.getUint32(ptr, true).toString(16).toUpperCase().padStart(8, "0");
    const d2 = view.getUint16(ptr + 4, true).toString(16).toUpperCase().padStart(4, "0");
    const d3 = view.getUint16(ptr + 6, true).toString(16).toUpperCase().padStart(4, "0");
    let d4 = "";
    for (let i = 0; i < 8; i++) {
      d4 += view.getUint8(ptr + 8 + i).toString(16).toUpperCase().padStart(2, "0");
    }
    return `{${d1}-${d2}-${d3}-${d4.substring(0, 4)}-${d4.substring(4)}}`;
  }

  private allocateMemory(size: number): number {
    if (!this.memory) return 0;
    const alignedSize = (size + 3) & ~3;
    const ptr = this.heapBumpPtr;
    this.heapBumpPtr += alignedSize;
    if (this.heapBumpPtr > this.memory.buffer.byteLength) {
      const neededPages = Math.ceil((this.heapBumpPtr - this.memory.buffer.byteLength) / 65536);
      this.memory.grow(neededPages);
    }
    return ptr;
  }

  public allocateWasmComProxy(instance: any): number {
    if (!this.memory || !this.table) return 0;
    const handle = ++this.nextComHandle;
    this.comObjectMap.set(handle, instance);

    const baseTableIdx = this.table.length;
    this.table.grow(3);

    // Slot 0: QueryInterface(This, riid, ppvObject)
    this.table.set(baseTableIdx, (thisPtr: number, riidPtr: number, ppvObjectPtr: number) => {
      if (!this.memory || !ppvObjectPtr) return E_POINTER;
      const view = new DataView(this.memory.buffer);
      const h = view.getUint32(thisPtr + 4, true);
      const target = this.comObjectMap.get(h);
      if (!target) return E_POINTER;

      const riidStr = this.readGuidFromMemory(riidPtr);
      const qiRes = target.QueryInterface(riidStr);
      if (qiRes.hr === S_OK && qiRes.ppv) {
        const newProxyPtr = this.allocateWasmComProxy(qiRes.ppv);
        view.setUint32(ppvObjectPtr, newProxyPtr, true);
        return S_OK;
      }
      view.setUint32(ppvObjectPtr, 0, true);
      return E_NOINTERFACE;
    });

    // Slot 1: AddRef(This)
    this.table.set(baseTableIdx + 1, (thisPtr: number) => {
      if (!this.memory) return 0;
      const view = new DataView(this.memory.buffer);
      const h = view.getUint32(thisPtr + 4, true);
      const target = this.comObjectMap.get(h);
      if (!target) return 0;
      return typeof target.AddRef === "function" ? target.AddRef() : 1;
    });

    // Slot 2: Release(This)
    this.table.set(baseTableIdx + 2, (thisPtr: number) => {
      if (!this.memory) return 0;
      const view = new DataView(this.memory.buffer);
      const h = view.getUint32(thisPtr + 4, true);
      const target = this.comObjectMap.get(h);
      if (!target) return 0;
      const count = typeof target.Release === "function" ? target.Release() : 0;
      if (count <= 0) {
        this.comObjectMap.delete(h);
      }
      return count;
    });

    // Allocate 12 bytes for vtable: 3 function pointers (indices in __indirect_function_table)
    const pVtbl = this.allocateMemory(12);
    const view = new DataView(this.memory.buffer);
    view.setUint32(pVtbl + 0, baseTableIdx, true);
    view.setUint32(pVtbl + 4, baseTableIdx + 1, true);
    view.setUint32(pVtbl + 8, baseTableIdx + 2, true);

    // Allocate 8 bytes for object instance: [pVtbl (4 bytes), handle (4 bytes)]
    const pObj = this.allocateMemory(8);
    view.setUint32(pObj + 0, pVtbl, true);
    view.setUint32(pObj + 4, handle, true);

    return pObj;
  }

  public getImportObject(): WebAssembly.Imports {
    const logWasmStub = (api: string, ...args: any[]) => {
      console.warn(`[WASM STUB] ${api}(${args.join(", ")})`);
    };

    const win32Imports = {
      RegisterClassA: (ptr: number) => {
          if (!this.memory || !this.table) return 0;
          const view = new DataView(this.memory.buffer);
          const fnIdx = view.getUint32(ptr + 4, true);
          this.registeredWndProcIndices.push(fnIdx);
          const classNamePtr = view.getUint32(ptr + 36, true);
          const className = this.readCString(classNamePtr, "RegisterClassA:lpszClassName");

          const wndProc = (
            hwnd: HWND,
            uMsg: UINT,
            wParam: WPARAM,
            lParam: LPARAM
          ): LRESULT => {
            if (!this.table) return 0;
            const targetFn = this.table.get(fnIdx);
            let res: any = 0;
            if (typeof targetFn === "function") {
              res = targetFn(
                hwnd,
                uMsg,
                typeof wParam === "number" ? wParam : 0,
                typeof lParam === "number" ? lParam : 0
              );
            } else {
              res = DefWindowProc(hwnd, uMsg, wParam, lParam);
            }
            if (uMsg === WM_DESTROY) {
              this.destroy();
            }
            return typeof res === "number" ? res : 0;
          };

          this.registeredClasses.set(className.toUpperCase(), wndProc);

          kernel.RegisterClassEx({
            className,
            lpfnWndProc: wndProc,
          });
          return 1;
        },

        RegisterClassExA: (ptr: number) => {
          if (!this.memory || !this.table) return 0;
          const view = new DataView(this.memory.buffer);
          const fnIdx = view.getUint32(ptr + 8, true);
          this.registeredWndProcIndices.push(fnIdx);
          const classNamePtr = view.getUint32(ptr + 40, true);
          const className = this.readCString(classNamePtr, "RegisterClassExA:lpszClassName");

          const wndProc = (
            hwnd: HWND,
            uMsg: UINT,
            wParam: WPARAM,
            lParam: LPARAM
          ): LRESULT => {
            if (!this.table) return 0;
            const targetFn = this.table.get(fnIdx);
            let res: any = 0;
            if (typeof targetFn === "function") {
              res = targetFn(
                hwnd,
                uMsg,
                typeof wParam === "number" ? wParam : 0,
                typeof lParam === "number" ? lParam : 0
              );
            } else {
              res = DefWindowProc(hwnd, uMsg, wParam, lParam);
            }
            if (uMsg === WM_DESTROY) {
              this.destroy();
            }
            return typeof res === "number" ? res : 0;
          };

          this.registeredClasses.set(className.toUpperCase(), wndProc);

          kernel.RegisterClassEx({
            className,
            lpfnWndProc: wndProc,
          });
          return 1;
        },

        LoadIconA: (_hInstance: number, _lpIconName: number) => {
          return 1; // Standard icon handle
        },

        LoadCursorA: (_hInstance: number, _lpCursorName: number) => {
          return 1; // Standard cursor handle
        },

        CreateWindowExA: (
          dwExStyle: number,
          lpClassName: number,
          lpWindowName: number,
          dwStyle: number,
          x: number,
          y: number,
          nWidth: number,
          nHeight: number,
          hWndParent: number,
          hMenu: number,
          hInstance: number,
          lpParam: number
        ) => {
          const className = this.readCString(lpClassName);
          const windowName = this.readCString(lpWindowName);
          const localWndProc = this.registeredClasses.get(className.toUpperCase());

          const CW_USEDEFAULT = -2147483648;
          let actualX = x;
          let actualY = y;
          let actualW = nWidth;
          let actualH = nHeight;
          if (actualX === CW_USEDEFAULT || actualX === 0x80000000) {
            actualX = this.options.initialX ?? 120;
          }
          if (actualY === CW_USEDEFAULT || actualY === 0x80000000) {
            actualY = this.options.initialY ?? 80;
          }
          if (actualW === CW_USEDEFAULT || actualW === 0x80000000 || actualW <= 0) {
            actualW = 500;
          }
          if (actualH === CW_USEDEFAULT || actualH === 0x80000000 || actualH <= 0) {
            actualH = 350;
          }

          const hwnd = kernel.CreateWindowEx(
            dwExStyle,
            className,
            windowName,
            dwStyle,
            actualX,
            actualY,
            actualW,
            actualH,
            hWndParent === 0 ? null : hWndParent,
            hMenu === 0 ? null : hMenu,
            null,
            null,
            localWndProc
          );

          // For top-level C windows or custom child windows, attach canvas support for GDI drawing
          const win = kernel.getWindow(hwnd);
          if (win) {
            win.menuId = hMenu;
            if (className.toUpperCase() === "MDICLIENT") {
              const parent = kernel.getWindow(hWndParent);
              if (parent) {
                win.width = parent.width;
                win.height = parent.height;
              }
              if (lpParam && this.memory) {
                const view = new DataView(this.memory.buffer);
                const hWindowMenu = view.getUint32(lpParam, true);
                const idFirstChild = view.getUint32(lpParam + 4, true);
                win.customProps = {
                  ...(win.customProps ?? {}),
                  hWindowMenu,
                  idFirstChild,
                };
              }
            } else if (!hWndParent || localWndProc) {
              win.customProps = {
                ...(win.customProps ?? {}),
                hasCanvas: true,
              };
            }
          }

          // Dispatch initial WM_SIZE so C static variables (cxClient, cyClient) receive initial dimensions
          const clientW = Math.max(10, actualW - 16);
          const clientH = Math.max(10, actualH - (hMenu ? 64 : 44));
          SendMessage(hwnd, 0x0005 /* WM_SIZE */, 0, (clientH << 16) | (clientW & 0xffff));

          return hwnd;
        },

        ShowWindow: (hwnd: number, nCmdShow: number) => {
          ShowWindow(hwnd, nCmdShow);
          const win = kernel.getWindow(hwnd);
          if (win) {
            const clientW = Math.max(10, win.width - 16);
            const clientH = Math.max(10, win.height - (win.menuId ? 64 : 44));
            SendMessage(hwnd, 0x0005 /* WM_SIZE */, 0, (clientH << 16) | (clientW & 0xffff));
          }
          return 1;
        },

        UpdateWindow: (hwnd: number) => {
          SendMessage(hwnd, 0x000F, 0, 0); // WM_PAINT
          return 1;
        },

        GetMessageA: (
          _lpMsg: number,
          _hWnd: number,
          _wMsgFilterMin: number,
          _wMsgFilterMax: number
        ) => {
          // In single-threaded browser WASM, return 0 (FALSE) so WinMain cleanly returns to event loop
          return 0;
        },

        PeekMessageA: (
          lpMsg: number,
          _hWnd: number,
          _wMsgFilterMin: number,
          _wMsgFilterMax: number,
          _wRemoveMsg: number
        ) => {
          this.peekMessageCount = (this.peekMessageCount || 0) + 1;
          if (this.peekMessageCount > 25) {
            this.peekMessageCount = 0;
            if (this.memory && lpMsg) {
              const dv = new DataView(this.memory.buffer);
              dv.setUint32(lpMsg + 4, 0x0012 /* WM_QUIT */, true);
              return 1;
            }
          }
          return 0;
        },

        SetCursor: (_hCursor: number) => 1,
        ShowCursor: (_bShow: number) => 1,

        TranslateMessage: (_lpMsg: number) => {
          logWasmStub("TranslateMessage", _lpMsg);
          return 0;
        },

        DispatchMessageA: (_lpMsg: number) => {
          logWasmStub("DispatchMessageA", _lpMsg);
          return 0;
        },

        PlaySoundA: (
          _pszSound: number,
          _hmod: number,
          _fdwSound: number
        ) => {
          return 1;
        },

        sndPlaySoundA: (
          _pszSound: number,
          _fuSound: number
        ) => {
          return 1;
        },

        DefWindowProcA: (
          hwnd: number,
          Msg: number,
          wParam: number,
          lParam: number
        ) => {
          return DefWindowProc(hwnd, Msg, wParam, lParam);
        },

        DefFrameProcA: (
          hWnd: number,
          hWndMDIClient: number,
          uMsg: number,
          wParam: number,
          lParam: number
        ) => {
          if (uMsg === 0x0005 /* WM_SIZE */) {
            const frame = kernel.getWindow(hWnd);
            if (frame && hWndMDIClient) {
              kernel.MoveWindow(hWndMDIClient, 0, 0, frame.width, frame.height, true);
            }
            return 0;
          }
          if (uMsg === 0x0111 /* WM_COMMAND */) {
            const cmdId = wParam & 0xffff;
            const clientWin = kernel.getWindow(hWndMDIClient);
            const idFirstChild = clientWin?.customProps?.idFirstChild ?? 50000;
            if (cmdId >= idFirstChild) {
              const children = kernel.windows.filter((w) => w.parentHwnd === hWndMDIClient);
              const child = children[cmdId - idFirstChild];
              if (child) {
                (win32Imports as any).SendMessageA(hWndMDIClient, 0x0222 /* WM_MDIACTIVATE */, child.hwnd, 0);
              }
              return 0;
            }
          }
          return (win32Imports as any).DefWindowProcA(hWnd, uMsg, wParam, lParam);
        },
        DefFrameProc: (...args: any[]) => (win32Imports as any).DefFrameProcA(...args),

        DefMDIChildProcA: (
          hWnd: number,
          uMsg: number,
          wParam: number,
          lParam: number
        ) => {
          if (uMsg === 0x0010 /* WM_CLOSE */) {
            const child = kernel.getWindow(hWnd);
            if (child?.parentHwnd) {
              (win32Imports as any).SendMessageA(child.parentHwnd, 0x0221 /* WM_MDIDESTROY */, hWnd, 0);
              return 0;
            }
          }
          if (uMsg === 0x0011 /* WM_QUERYENDSESSION */) {
            return 1;
          }
          if (uMsg === 0x0222 /* WM_MDIACTIVATE */) {
            return 0;
          }
          return (win32Imports as any).DefWindowProcA(hWnd, uMsg, wParam, lParam);
        },
        DefMDIChildProc: (...args: any[]) => (win32Imports as any).DefMDIChildProcA(...args),

        PostQuitMessage: (nExitCode: number) => {
          PostQuitMessage(nExitCode);
        },

        SendMessageA: (
          hwnd: number,
          Msg: number,
          wParam: number,
          lParam: number
        ) => {
          const win = kernel.getWindow(hwnd);
          if (win && win.className.toUpperCase() === "MDICLIENT") {
            if (Msg === 0x0220 /* WM_MDICREATE */) {
              if (this.memory && lParam) {
                const view = new DataView(this.memory.buffer);
                const lpSzClass = view.getUint32(lParam, true);
                const lpSzTitle = view.getUint32(lParam + 4, true);
                const _hOwner = view.getUint32(lParam + 8, true);
                let x = view.getInt32(lParam + 12, true);
                let y = view.getInt32(lParam + 16, true);
                let cx = view.getInt32(lParam + 20, true);
                let cy = view.getInt32(lParam + 24, true);
                const style = view.getUint32(lParam + 28, true);
                const childLParam = view.getUint32(lParam + 32, true);

                const className = this.readCString(lpSzClass);
                const title = this.readCString(lpSzTitle);
                const localWndProc = this.registeredClasses.get(className.toUpperCase());

                const CW_USEDEFAULT = -2147483648;
                const children = kernel.windows.filter((w) => w.parentHwnd === hwnd);
                const cascadeIdx = children.length;
                if (x === CW_USEDEFAULT || x === 0x80000000) x = 20 + (cascadeIdx * 24) % 200;
                if (y === CW_USEDEFAULT || y === 0x80000000) y = 20 + (cascadeIdx * 24) % 150;
                if (cx === CW_USEDEFAULT || cx === 0x80000000 || cx <= 0) cx = 300;
                if (cy === CW_USEDEFAULT || cy === 0x80000000 || cy <= 0) cy = 200;

                const childHwnd = kernel.CreateWindowEx(
                  0,
                  className,
                  title,
                  0x40000000 /* WS_CHILD */ | 0x10000000 /* WS_VISIBLE */ | style,
                  x,
                  y,
                  cx,
                  cy,
                  hwnd,
                  null,
                  null,
                  childLParam,
                  localWndProc
                );

                const childWin = kernel.getWindow(childHwnd);
                if (childWin) {
                  childWin.customProps = {
                    ...(childWin.customProps ?? {}),
                    hasCanvas: true,
                  };
                }

                // Activate new child
                const prevActive = win.customProps?.activeChild ?? 0;
                win.customProps = {
                  ...(win.customProps ?? {}),
                  activeChild: childHwnd,
                };
                if (prevActive && prevActive !== childHwnd) {
                  (win32Imports as any).SendMessageA(prevActive, 0x0222 /* WM_MDIACTIVATE */, prevActive, childHwnd);
                }
                (win32Imports as any).SendMessageA(childHwnd, 0x0222 /* WM_MDIACTIVATE */, prevActive, childHwnd);

                return childHwnd;
              }
              return 0;
            } else if (Msg === 0x0221 /* WM_MDIDESTROY */) {
              const childToDestroy = wParam;
              (win32Imports as any).SendMessageA(childToDestroy, 0x0222 /* WM_MDIACTIVATE */, childToDestroy, 0);
              kernel.DestroyWindow(childToDestroy);
              const remaining = kernel.windows.filter((w) => w.parentHwnd === hwnd && w.hwnd !== childToDestroy);
              const nextChild = remaining[remaining.length - 1]?.hwnd ?? 0;
              win.customProps = {
                ...(win.customProps ?? {}),
                activeChild: nextChild,
              };
              if (nextChild) {
                (win32Imports as any).SendMessageA(nextChild, 0x0222 /* WM_MDIACTIVATE */, 0, nextChild);
              }
              return 0;
            } else if (Msg === 0x0222 /* WM_MDIACTIVATE */) {
              const targetChild = wParam;
              const prev = win.customProps?.activeChild ?? 0;
              win.customProps = {
                ...(win.customProps ?? {}),
                activeChild: targetChild,
              };
              if (prev && prev !== targetChild) {
                (win32Imports as any).SendMessageA(prev, 0x0222 /* WM_MDIACTIVATE */, prev, targetChild);
              }
              if (targetChild) {
                const targetWin = kernel.getWindow(targetChild);
                if (targetWin) targetWin.zIndex = ++(kernel as any).topZIndex;
                (win32Imports as any).SendMessageA(targetChild, 0x0222 /* WM_MDIACTIVATE */, prev, targetChild);
              }
              return 0;
            } else if (Msg === 0x0229 /* WM_MDIGETACTIVE */) {
              if (lParam && this.memory) {
                const view = new DataView(this.memory.buffer);
                view.setUint32(lParam, 0, true);
              }
              return win.customProps?.activeChild ?? 0;
            } else if (Msg === 0x0226 /* WM_MDITILE */) {
              const children = kernel.windows.filter((w) => w.parentHwnd === hwnd && w.visible);
              if (children.length > 0) {
                const cols = Math.ceil(Math.sqrt(children.length));
                const rows = Math.ceil(children.length / cols);
                const tileW = Math.floor(win.width / cols);
                const tileH = Math.floor(win.height / rows);
                children.forEach((c, i) => {
                  const col = i % cols;
                  const row = Math.floor(i / cols);
                  kernel.MoveWindow(c.hwnd, col * tileW, row * tileH, tileW, tileH, true);
                });
              }
              return 1;
            } else if (Msg === 0x0227 /* WM_MDICASCADE */) {
              const children = kernel.windows.filter((w) => w.parentHwnd === hwnd && w.visible);
              if (children.length > 0) {
                const cascadeW = Math.floor(win.width * 0.75);
                const cascadeH = Math.floor(win.height * 0.75);
                children.forEach((c, i) => {
                  const offset = (i * 24) % Math.max(1, (win.width - cascadeW));
                  kernel.MoveWindow(c.hwnd, offset, offset, cascadeW, cascadeH, true);
                });
              }
              return 1;
            } else if (Msg === 0x0223 /* WM_MDIRESTORE */) {
              return 0;
            } else if (Msg === 0x0230 /* WM_MDISETMENU */) {
              return 1;
            }
          }
          return SendMessage(hwnd, Msg, wParam, lParam);
        },

        PostMessageA: (
          hwnd: number,
          Msg: number,
          wParam: number,
          lParam: number
        ) => {
          return PostMessage(hwnd, Msg, wParam, lParam) ? 1 : 0;
        },

        SetWindowTextA: (hwnd: number, lpString: number) => {
          const text = this.readCString(lpString);
          SetWindowText(hwnd, text);
          return 1;
        },

        GetWindowTextA: (hwnd: number, lpString: number, nMaxCount: number) => {
          const text = GetWindowText(hwnd) ?? "";
          return this.writeCString(lpString, text, nMaxCount);
        },

        InvalidateRect: (hwnd: number, _lpRect: number, bErase: number) => {
          InvalidateRect(hwnd, null, !!bErase);
          return 1;
        },

        GetClientRect: (hwnd: number, lpRect: number) => {
          if (!this.memory || !lpRect) return 0;
          const win = kernel.getWindow(hwnd);
          const canvas = GetWindowCanvas(hwnd);
          const w = win?.width ?? (canvas ? canvas.width : 0);
          const h = win?.height ?? (canvas ? canvas.height : 0);
          const view = new DataView(this.memory.buffer);
          view.setInt32(lpRect, 0, true);
          view.setInt32(lpRect + 4, 0, true);
          view.setInt32(lpRect + 8, w, true);
          view.setInt32(lpRect + 12, h, true);
          return 1;
        },

        MessageBoxA: (
          hWnd: number,
          lpText: number,
          lpCaption: number,
          uType: number
        ) => {
          const text = this.readCString(lpText, "MessageBoxA:lpText");
          const caption = this.readCString(lpCaption, "MessageBoxA:lpCaption");
          MessageBox(hWnd === 0 ? null : hWnd, text, caption, uType);
          return 1;
        },

        GetSystemMetrics: (nIndex: number): number => {
          const res = GetSystemMetrics(nIndex);
          if (res === 0) {
            logWasmStub("GetSystemMetrics:unknown_index", nIndex);
          }
          return res;
        },

        MessageBeep: (uType: number) => {
          MessageBeep(uType);
          return 1;
        },

        SetTimer: (
          hWnd: number,
          nIDEvent: number,
          uElapse: number,
          lpTimerFunc: number
        ) => {
          if (lpTimerFunc && this.table) {
            const callback = this.table.get(lpTimerFunc);
            if (typeof callback === "function") {
              return SetTimer(hWnd, nIDEvent, uElapse, (h: number, msg: number, id: number, time: number) => {
                callback(h, msg, id, time);
              });
            }
          }
          return SetTimer(hWnd, nIDEvent, uElapse);
        },

        KillTimer: (hWnd: number, uIDEvent: number) => {
          return KillTimer(hWnd, uIDEvent) ? 1 : 0;
        },

        ShellExecuteA: (
          _hWnd: number,
          _lpOperation: number,
          lpFile: number,
          _lpParameters: number,
          _lpDirectory: number,
          _nShowCmd: number
        ) => {
          const file = this.readCString(lpFile);
          if (file === "sample_app.c" || file.endsWith("sample_app.c")) {
            StartNotepad(480, 70, "C:\\wasm_application\\sample_app.c");
            return 32;
          }
          if (file === "windows.h" || file.endsWith("windows.h")) {
            StartNotepad(510, 100, "C:\\wasm_application\\windows.h");
            return 32;
          }
          if (file.startsWith("http://") || file.startsWith("https://")) {
            if (typeof window !== "undefined") {
              window.open(file, "_blank", "noopener,noreferrer");
            }
            return 32;
          }
          StartNotepad(480, 80, file);
          return 32;
        },

        // --- GDI APIs ---
        GetDC: (hWnd: number) => {
          try {
            const hdc = BeginPaint(hWnd);
            const handle = ++this.nextHdcHandle;
            this.hdcMap.set(handle, hdc);
            return handle;
          } catch {
            return ++this.nextHdcHandle;
          }
        },

        ReleaseDC: (_hWnd: number, hdcHandle: number) => {
          this.hdcMap.delete(hdcHandle);
          if (this.currentThreadInfo) {
            this.currentThreadInfo.iterationCount = (this.currentThreadInfo.iterationCount || 0) + 1;
            if (this.currentThreadInfo.iterationCount >= 10) {
              this.currentThreadInfo.iterationCount = 0;
              throw { isThreadYield: true };
            }
          }
          return 1;
        },

        GetTextMetricsA: (hdcHandle: number, lpTm: number) => {
          if (!this.memory || !lpTm) return 0;
          const hdc = this.hdcMap.get(hdcHandle);
          const fontObj = (hdc as any)?.selectedFont;
          const height = fontObj && Math.abs(fontObj.height) ? Math.abs(fontObj.height) : 16;
          const ascent = Math.round(height * 0.8);
          const descent = height - ascent;
          const aveWidth = Math.round(height * 0.5);
          const maxWidth = height;
          const weight = fontObj?.weight || 400;
          const italic = fontObj?.italic ? 1 : 0;

          const view = new DataView(this.memory.buffer);
          view.setInt32(lpTm + 0, height, true);  // tmHeight
          view.setInt32(lpTm + 4, ascent, true);  // tmAscent
          view.setInt32(lpTm + 8, descent, true); // tmDescent
          view.setInt32(lpTm + 12, 3, true);  // tmInternalLeading
          view.setInt32(lpTm + 16, 0, true);  // tmExternalLeading
          view.setInt32(lpTm + 20, aveWidth, true);  // tmAveCharWidth
          view.setInt32(lpTm + 24, maxWidth, true); // tmMaxCharWidth
          view.setInt32(lpTm + 28, weight, true);// tmWeight (FW_NORMAL)
          view.setInt32(lpTm + 32, 0, true);  // tmOverhang
          view.setInt32(lpTm + 36, 96, true); // tmDigitizedAspectX
          view.setInt32(lpTm + 40, 96, true); // tmDigitizedAspectY
          view.setUint8(lpTm + 44, 32);       // tmFirstChar
          view.setUint8(lpTm + 45, 126);      // tmLastChar
          view.setUint8(lpTm + 46, 32);       // tmDefaultChar
          view.setUint8(lpTm + 47, 32);       // tmBreakChar
          view.setUint8(lpTm + 48, italic);   // tmItalic
          view.setUint8(lpTm + 49, 0);        // tmUnderlined
          view.setUint8(lpTm + 50, 0);        // tmStruckOut
          view.setUint8(lpTm + 51, 1);        // tmPitchAndFamily (variable pitch)
          view.setUint8(lpTm + 52, 0);        // tmCharSet (ANSI_CHARSET)
          return 1;
        },

        GetTextFaceA: (hdcHandle: number, c: number, lpName: number) => {
          if (this.memory && lpName && c > 0) {
            const hdc = this.hdcMap.get(hdcHandle);
            const face = (hdc as any)?.selectedFont?.faceName || "MS Sans Serif";
            const bytes = new TextEncoder().encode(face);
            const heap = new Uint8Array(this.memory.buffer);
            const toWrite = Math.min(bytes.length, c - 1);
            heap.set(bytes.subarray(0, toWrite), lpName);
            heap[lpName + toWrite] = 0;
            return toWrite;
          }
          return 0;
        },

        SetTextAlign: (hdcHandle: number, align: number) => {
          const hdc = this.hdcMap.get(hdcHandle);
          const old = (hdc as any)?.textAlign || 0;
          if (hdc) (hdc as any).textAlign = align;
          return old;
        },

        ScrollWindow: (_hWnd: number, _xAmount: number, _yAmount: number, _lpRect: number, _lpClipRect: number) => {
          return 1;
        },

        SetScrollInfo: (_hwnd: number, _nBar: number, lpsi: number, _redraw: number) => {
          if (!this.memory || !lpsi) return 0;
          const view = new DataView(this.memory.buffer);
          return view.getInt32(lpsi + 20, true); // nPos
        },

        GetScrollInfo: (_hwnd: number, _nBar: number, _lpsi: number) => {
          return 1;
        },

        SetScrollPos: (_hWnd: number, _nBar: number, nPos: number, _bRedraw: number) => {
          return nPos;
        },

        GetScrollPos: (_hWnd: number, _nBar: number) => {
          return 0;
        },

        SetScrollRange: (_hWnd: number, _nBar: number, _nMinPos: number, _nMaxPos: number, _bRedraw: number) => {
          return 1;
        },

        GetScrollRange: (_hWnd: number, _nBar: number, lpMinPos: number, lpMaxPos: number) => {
          if (this.memory) {
            const view = new DataView(this.memory.buffer);
            if (lpMinPos) view.setInt32(lpMinPos, 0, true);
            if (lpMaxPos) view.setInt32(lpMaxPos, 100, true);
          }
          return 1;
        },

        BeginPaint: (hWnd: number, lpPaint: number) => {
          if (!this.memory) return 0;
          try {
            const hdc = BeginPaint(hWnd);
            const handle = ++this.nextHdcHandle;
            this.hdcMap.set(handle, hdc);

            // Write HDC handle into lpPaint (PAINTSTRUCT.hdc at offset 0)
            const view = new DataView(this.memory.buffer);
            view.setUint32(lpPaint, handle, true);

            return handle;
          } catch {
            return 0;
          }
        },

        EndPaint: (hWnd: number, lpPaint: number) => {
          if (!this.memory) return 1;
          const view = new DataView(this.memory.buffer);
          const hdcHandle = view.getUint32(lpPaint, true);
          this.hdcMap.delete(hdcHandle);
          EndPaint(hWnd, {} as any);
          return 1;
        },

        MoveToEx: (hdcHandle: number, x: number, y: number, _lppt: number) => {
          const hdc = this.hdcMap.get(hdcHandle);
          if (!hdc) return 0;
          if ((hdc as any).svgRecorder) {
            (hdc as any).svgRecorder.recordMoveTo(x, y);
          }
          if ((hdc as any).pathActive && hdc.ctx) {
            hdc.ctx.moveTo(x, y);
            hdc.currentPoint.x = x;
            hdc.currentPoint.y = y;
            return 1;
          }
          return MoveToEx(hdc, x, y) ? 1 : 0;
        },

        GetDeviceCaps: (_hdcHandle: number, nIndex: number): number => {
          switch (nIndex) {
            case 4: { // HORZSIZE (horizontal width in millimeters)
              const w = typeof window !== "undefined" ? window.innerWidth : 1024;
              return Math.max(1, Math.floor((w * 254) / 960));
            }
            case 6: { // VERTSIZE (vertical height in millimeters)
              const h = typeof window !== "undefined" ? window.innerHeight : 768;
              return Math.max(1, Math.floor((h * 254) / 960));
            }
            case 8: // HORZRES
              return typeof window !== "undefined" ? window.innerWidth : 1024;
            case 10: // VERTRES
              return typeof window !== "undefined" ? window.innerHeight : 768;
            case 12: // BITSPIXEL
              return 32;
            case 14: // PLANES
              return 1;
            case 24: // NUMCOLORS
              return -1; // True color
            case 38: // RASTERCAPS
              return 0x0100 | 0x0001; // RC_PALETTE | RC_BITBLT
            case 40: // ASPECTX
            case 42: // ASPECTY
              return 36;
            case 44: // ASPECTXY
              return 51;
            case 88: // LOGPIXELSX
            case 90: // LOGPIXELSY
              return 96;
            case 104: // SIZEPALETTE
              return 256;
            case 106: // NUMRESERVED
              return 20;
            case 108: // COLORRES
              return 24;
            case 110: // PHYSICALWIDTH
              return 2400;
            case 111: // PHYSICALHEIGHT
              return 3300;
            case 112: // PHYSICALOFFSETX
            case 113: // PHYSICALOFFSETY
              return 75;
            default:
              logWasmStub("GetDeviceCaps:unknown_index", nIndex);
              return 1;
          }
        },

        SetMapMode: (_hdcHandle: number, _iMode: number) => 1,
        GetMapMode: (_hdcHandle: number) => 1,
        SetWindowExtEx: (hdcHandle: number, x: number, y: number, lpsz: number) => {
          const hdc = this.hdcMap.get(hdcHandle);
          if (hdc) {
            if (this.memory && lpsz) {
              const dv = new DataView(this.memory.buffer);
              dv.setInt32(lpsz + 0, (hdc as any).windowExtX || 1, true);
              dv.setInt32(lpsz + 4, (hdc as any).windowExtY || 1, true);
            }
            (hdc as any).windowExtX = x;
            (hdc as any).windowExtY = y;
          }
          return 1;
        },
        SetViewportExtEx: (hdcHandle: number, x: number, y: number, lpsz: number) => {
          const hdc = this.hdcMap.get(hdcHandle);
          if (hdc) {
            if (this.memory && lpsz) {
              const dv = new DataView(this.memory.buffer);
              dv.setInt32(lpsz + 0, (hdc as any).viewportExtX || 1, true);
              dv.setInt32(lpsz + 4, (hdc as any).viewportExtY || 1, true);
            }
            (hdc as any).viewportExtX = x;
            (hdc as any).viewportExtY = y;
          }
          return 1;
        },
        SetWindowOrgEx: (hdcHandle: number, x: number, y: number, lppt: number) => {
          const hdc = this.hdcMap.get(hdcHandle);
          if (hdc) {
            if (this.memory && lppt) {
              const dv = new DataView(this.memory.buffer);
              dv.setInt32(lppt + 0, (hdc as any).windowOrgX || 0, true);
              dv.setInt32(lppt + 4, (hdc as any).windowOrgY || 0, true);
            }
            (hdc as any).windowOrgX = x;
            (hdc as any).windowOrgY = y;
          }
          return 1;
        },
        SetViewportOrgEx: (hdcHandle: number, x: number, y: number, lppt: number) => {
          const hdc = this.hdcMap.get(hdcHandle);
          if (hdc) {
            if (this.memory && lppt) {
              const dv = new DataView(this.memory.buffer);
              dv.setInt32(lppt + 0, (hdc as any).viewportOrgX || 0, true);
              dv.setInt32(lppt + 4, (hdc as any).viewportOrgY || 0, true);
            }
            (hdc as any).viewportOrgX = x;
            (hdc as any).viewportOrgY = y;
          }
          return 1;
        },
        DPtoLP: (hdcHandle: number, lppt: number, c: number) => {
          if (!this.memory || !lppt || c <= 0) return 1;
          const hdc = this.hdcMap.get(hdcHandle);
          if (!hdc) return 1;
          const wExtX = (hdc as any).windowExtX || 1;
          const wExtY = (hdc as any).windowExtY || 1;
          const vExtX = (hdc as any).viewportExtX || 1;
          const vExtY = (hdc as any).viewportExtY || 1;
          const wOrgX = (hdc as any).windowOrgX || 0;
          const wOrgY = (hdc as any).windowOrgY || 0;
          const vOrgX = (hdc as any).viewportOrgX || 0;
          const vOrgY = (hdc as any).viewportOrgY || 0;

          const dv = new DataView(this.memory.buffer);
          for (let i = 0; i < c; i++) {
            const x = dv.getInt32(lppt + i * 8, true);
            const y = dv.getInt32(lppt + i * 8 + 4, true);
            const lx = Math.round(((x - vOrgX) * wExtX) / vExtX + wOrgX);
            const ly = Math.round(((y - vOrgY) * wExtY) / vExtY + wOrgY);
            dv.setInt32(lppt + i * 8, lx, true);
            dv.setInt32(lppt + i * 8 + 4, ly, true);
          }
          return 1;
        },
        LPtoDP: (hdcHandle: number, lppt: number, c: number) => {
          if (!this.memory || !lppt || c <= 0) return 1;
          const hdc = this.hdcMap.get(hdcHandle);
          if (!hdc) return 1;
          const wExtX = (hdc as any).windowExtX || 1;
          const wExtY = (hdc as any).windowExtY || 1;
          const vExtX = (hdc as any).viewportExtX || 1;
          const vExtY = (hdc as any).viewportExtY || 1;
          const wOrgX = (hdc as any).windowOrgX || 0;
          const wOrgY = (hdc as any).windowOrgY || 0;
          const vOrgX = (hdc as any).viewportOrgX || 0;
          const vOrgY = (hdc as any).viewportOrgY || 0;

          const dv = new DataView(this.memory.buffer);
          for (let i = 0; i < c; i++) {
            const lx = dv.getInt32(lppt + i * 8, true);
            const ly = dv.getInt32(lppt + i * 8 + 4, true);
            const x = Math.round(((lx - wOrgX) * vExtX) / wExtX + vOrgX);
            const y = Math.round(((ly - wOrgY) * vExtY) / wExtY + vOrgY);
            dv.setInt32(lppt + i * 8, x, true);
            dv.setInt32(lppt + i * 8 + 4, y, true);
          }
          return 1;
        },

        Polyline: (hdcHandle: number, apt: number, cpt: number) => {
          if (!this.memory || cpt <= 1) return 0;
          const hdc = this.hdcMap.get(hdcHandle);
          const ctx = hdc?.ctx;
          if (!ctx) return 1;

          const view = new DataView(this.memory.buffer);
          if ((hdc as any).svgRecorder) {
            const pts: { x: number; y: number }[] = [];
            for (let i = 0; i < cpt; i++) {
              pts.push({ x: view.getInt32(apt + i * 8, true), y: view.getInt32(apt + i * 8 + 4, true) });
            }
            (hdc as any).svgRecorder.recordPolyline(pts);
          }

          ctx.beginPath();
          const startX = view.getInt32(apt, true);
          const startY = view.getInt32(apt + 4, true);
          ctx.moveTo(startX, startY);

          for (let i = 1; i < cpt; i++) {
            const x = view.getInt32(apt + i * 8, true);
            const y = view.getInt32(apt + i * 8 + 4, true);
            ctx.lineTo(x, y);
          }
          ctx.strokeStyle = hdc.penColor;
          ctx.lineWidth = hdc.penWidth;
          ctx.stroke();
          return 1;
        },

        Polygon: (hdcHandle: number, apt: number, cpt: number) => {
          if (!this.memory || cpt < 3) return 0;
          const hdc = this.hdcMap.get(hdcHandle);
          const ctx = hdc?.ctx;
          if (!ctx) return 1;

          const view = new DataView(this.memory.buffer);
          if ((hdc as any).svgRecorder) {
            const pts: { x: number; y: number }[] = [];
            for (let i = 0; i < cpt; i++) {
              pts.push({ x: view.getInt32(apt + i * 8, true), y: view.getInt32(apt + i * 8 + 4, true) });
            }
            (hdc as any).svgRecorder.recordPolygon(pts);
          }

          ctx.beginPath();
          const startX = view.getInt32(apt, true);
          const startY = view.getInt32(apt + 4, true);
          ctx.moveTo(startX, startY);

          for (let i = 1; i < cpt; i++) {
            const x = view.getInt32(apt + i * 8, true);
            const y = view.getInt32(apt + i * 8 + 4, true);
            ctx.lineTo(x, y);
          }
          ctx.closePath();
          if (hdc.brushColor !== "transparent") {
            ctx.fillStyle = hdc.brushColor;
            ctx.fill();
          }
          ctx.strokeStyle = hdc.penColor;
          ctx.lineWidth = hdc.penWidth;
          ctx.stroke();
          return 1;
        },

        PolyPolygon: (hdcHandle: number, apt: number, asz: number, csz: number) => {
          if (!this.memory || csz <= 0) return 0;
          const view = new DataView(this.memory.buffer);
          let currentPt = apt;
          for (let i = 0; i < csz; i++) {
            const count = view.getInt32(asz + i * 4, true);
            this.getImportObject(); // stub check
            currentPt += count * 8;
          }
          return 1;
        },

        PolyBezier: (hdcHandle: number, apt: number, cpt: number) => {
          if (!this.memory || cpt < 4) return 0;
          const hdc = this.hdcMap.get(hdcHandle);
          const ctx = hdc?.ctx;
          if (!ctx) return 1;

          const view = new DataView(this.memory.buffer);
          if ((hdc as any).svgRecorder) {
            const pts: { x: number; y: number }[] = [];
            for (let i = 0; i < cpt; i++) {
              pts.push({ x: view.getInt32(apt + i * 8, true), y: view.getInt32(apt + i * 8 + 4, true) });
            }
            (hdc as any).svgRecorder.recordPolyBezier(pts);
          }

          ctx.beginPath();
          const startX = view.getInt32(apt, true);
          const startY = view.getInt32(apt + 4, true);
          ctx.moveTo(startX, startY);

          for (let i = 1; i < cpt; i += 3) {
            const cp1x = view.getInt32(apt + i * 8, true);
            const cp1y = view.getInt32(apt + i * 8 + 4, true);
            const cp2x = view.getInt32(apt + (i + 1) * 8, true);
            const cp2y = view.getInt32(apt + (i + 1) * 8 + 4, true);
            const endx = view.getInt32(apt + (i + 2) * 8, true);
            const endy = view.getInt32(apt + (i + 2) * 8 + 4, true);
            ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, endx, endy);
          }
          ctx.strokeStyle = hdc.penColor;
          ctx.lineWidth = hdc.penWidth;
          ctx.stroke();
          return 1;
        },

        RoundRect: (
          hdcHandle: number,
          left: number,
          top: number,
          right: number,
          bottom: number,
          width: number,
          height: number
        ) => {
          const hdc = this.hdcMap.get(hdcHandle);
          const ctx = hdc?.ctx;
          if (!ctx) return 1;

          const w = right - left;
          const h = bottom - top;
          const r = Math.min(width, height) / 2;

          ctx.beginPath();
          ctx.roundRect ? ctx.roundRect(left, top, w, h, r) : ctx.rect(left, top, w, h);
          if (hdc.brushColor !== "transparent") {
            ctx.fillStyle = hdc.brushColor;
            ctx.fill();
          }
          ctx.strokeStyle = hdc.penColor;
          ctx.lineWidth = hdc.penWidth;
          ctx.stroke();
          return 1;
        },

        Arc: (
          hdcHandle: number,
          x1: number,
          y1: number,
          x2: number,
          y2: number,
          _x3: number,
          _y3: number,
          _x4: number,
          _y4: number
        ) => {
          const hdc = this.hdcMap.get(hdcHandle);
          const ctx = hdc?.ctx;
          if (!ctx) return 1;

          const cx = (x1 + x2) / 2;
          const cy = (y1 + y2) / 2;
          const rx = Math.abs(x2 - x1) / 2;
          const ry = Math.abs(y2 - y1) / 2;

          ctx.beginPath();
          ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
          ctx.strokeStyle = hdc.penColor;
          ctx.lineWidth = hdc.penWidth;
          ctx.stroke();
          return 1;
        },

        Chord: (hdcHandle: number, x1: number, y1: number, x2: number, y2: number) => {
          return Ellipse(this.hdcMap.get(hdcHandle)!, x1, y1, x2, y2) ? 1 : 0;
        },

        Pie: (hdcHandle: number, x1: number, y1: number, x2: number, y2: number) => {
          return Ellipse(this.hdcMap.get(hdcHandle)!, x1, y1, x2, y2) ? 1 : 0;
        },

        SetPolyFillMode: (_hdcHandle: number, _mode: number) => {
          logWasmStub("SetPolyFillMode", _hdcHandle, _mode);
          return 1;
        },
        CreateRectRgn: (_x1: number, _y1: number, _x2: number, _y2: number) => {
          logWasmStub("CreateRectRgn", _x1, _y1, _x2, _y2);
          return ++this.nextGdiHandle;
        },
        CreateEllipticRgn: (_x1: number, _y1: number, _x2: number, _y2: number) => {
          logWasmStub("CreateEllipticRgn", _x1, _y1, _x2, _y2);
          return ++this.nextGdiHandle;
        },
        CombineRgn: (_hrgnDest: number, _hrgnSrc1: number, _hrgnSrc2: number, _fnCombineMode: number) => {
          logWasmStub("CombineRgn", _hrgnDest, _hrgnSrc1, _hrgnSrc2, _fnCombineMode);
          return 1;
        },
        SelectClipRgn: (_hdcHandle: number, _hrgn: number) => {
          logWasmStub("SelectClipRgn", _hdcHandle, _hrgn);
          return 1;
        },

        SaveDC: (hdcHandle: number) => {
          const hdc = this.hdcMap.get(hdcHandle);
          if (hdc) {
            hdc.ctx?.save();
            if (!(hdc as any).stateStack) (hdc as any).stateStack = [];
            (hdc as any).stateStack.push({
              selectedFontHandle: (hdc as any).selectedFontHandle,
              selectedFont: (hdc as any).selectedFont,
              selectedPenHandle: (hdc as any).selectedPenHandle,
              currentPen: hdc.currentPen,
              selectedBrushHandle: (hdc as any).selectedBrushHandle,
              currentBrush: hdc.currentBrush,
              textColor: hdc.textColor,
              bkColor: hdc.bkColor,
              textAlign: (hdc as any).textAlign,
              graphicsMode: (hdc as any).graphicsMode,
              windowExtX: (hdc as any).windowExtX,
              windowExtY: (hdc as any).windowExtY,
              viewportExtX: (hdc as any).viewportExtX,
              viewportExtY: (hdc as any).viewportExtY,
              windowOrgX: (hdc as any).windowOrgX,
              windowOrgY: (hdc as any).windowOrgY,
              viewportOrgX: (hdc as any).viewportOrgX,
              viewportOrgY: (hdc as any).viewportOrgY,
            });
            return (hdc as any).stateStack.length;
          }
          return 1;
        },

        RestoreDC: (hdcHandle: number, _nSavedDC: number) => {
          const hdc = this.hdcMap.get(hdcHandle);
          if (hdc) {
            hdc.ctx?.restore();
            if ((hdc as any).stateStack?.length > 0) {
              const state = (hdc as any).stateStack.pop();
              if (state) {
                Object.assign(hdc, state);
              }
            }
          }
          return 1;
        },

        CreateCaret: (_hWnd: number, _hBitmap: number, _nWidth: number, _nHeight: number) => {
          logWasmStub("CreateCaret", _hWnd, _hBitmap, _nWidth, _nHeight);
          return 1;
        },
        SetCaretPos: (_x: number, _y: number) => {
          logWasmStub("SetCaretPos", _x, _y);
          return 1;
        },
        ShowCaret: (_hWnd: number) => {
          logWasmStub("ShowCaret", _hWnd);
          return 1;
        },
        HideCaret: (_hWnd: number) => {
          logWasmStub("HideCaret", _hWnd);
          return 1;
        },
        DestroyCaret: () => {
          logWasmStub("DestroyCaret");
          return 1;
        },

        SetBkMode: (hdcHandle: number, mode: number) => {
          const hdc = this.hdcMap.get(hdcHandle);
          if (hdc) hdc.bkMode = mode;
          return mode;
        },

        GetKeyNameTextA: (_lParam: number, lpString: number, cchSize: number) => {
          if (this.memory && lpString && cchSize > 0) {
            const text = "Key";
            const bytes = new TextEncoder().encode(text);
            const heap = new Uint8Array(this.memory.buffer);
            const toWrite = Math.min(bytes.length, cchSize - 1);
            heap.set(bytes.subarray(0, toWrite), lpString);
            heap[lpString + toWrite] = 0;
            return toWrite;
          }
          return 0;
        },

        LineTo: (hdcHandle: number, x: number, y: number) => {
          const hdc = this.hdcMap.get(hdcHandle);
          if (!hdc) return 0;
          if ((hdc as any).svgRecorder) {
            (hdc as any).svgRecorder.recordLineTo(x, y);
          }
          if ((hdc as any).pathActive && hdc.ctx) {
            hdc.ctx.lineTo(x, y);
            hdc.currentPoint.x = x;
            hdc.currentPoint.y = y;
            return 1;
          }
          return LineTo(hdc, x, y) ? 1 : 0;
        },

        Rectangle: (
          hdcHandle: number,
          left: number,
          top: number,
          right: number,
          bottom: number
        ) => {
          const hdc = this.hdcMap.get(hdcHandle);
          if (!hdc) return 0;
          if ((hdc as any).svgRecorder) {
            (hdc as any).svgRecorder.recordRectangle(left, top, right, bottom);
          }
          return Rectangle(hdc, left, top, right, bottom) ? 1 : 0;
        },

        Ellipse: (
          hdcHandle: number,
          left: number,
          top: number,
          right: number,
          bottom: number
        ) => {
          const hdc = this.hdcMap.get(hdcHandle);
          if (!hdc) return 0;
          if ((hdc as any).svgRecorder) {
            (hdc as any).svgRecorder.recordEllipse(left, top, right, bottom);
          }
          return Ellipse(hdc, left, top, right, bottom) ? 1 : 0;
        },

        TextOutA: (
          hdcHandle: number,
          x: number,
          y: number,
          lpString: number,
          c: number
        ) => {
          const hdc = this.hdcMap.get(hdcHandle);
          if (!hdc) return 0;
          let text = this.readCString(lpString);
          if (c >= 0 && text.length > c) {
            text = text.substring(0, c);
          }
          if ((hdc as any).svgRecorder) {
            (hdc as any).svgRecorder.recordTextOut(x, y, text);
          }
          if ((hdc as any).pathActive) {
            if (!(hdc as any).pathText) (hdc as any).pathText = [];
            (hdc as any).pathText.push({ text, x, y });
            return 1;
          }
          return TextOut(hdc, x, y, text) ? 1 : 0;
        },

        SetTextColor: (hdcHandle: number, color: number) => {
          const hdc = this.hdcMap.get(hdcHandle);
          if (!hdc) return 0;
          const rgb = this.colorRefToRgb(color);
          if ((hdc as any).svgRecorder) {
            (hdc as any).svgRecorder.setTextColor(rgb);
          }
          SetTextColor(hdc, rgb);
          return color;
        },

        CreateSolidBrush: (color: number) => {
          const brush = CreateSolidBrush(this.colorRefToRgb(color));
          const handle = ++this.nextGdiHandle;
          this.gdiMap.set(handle, brush);
          return handle;
        },

        CreateFontA: () => ++this.nextGdiHandle,

        CreatePen: (iStyle: number, cWidth: number, color: number) => {
          const pen = CreatePen(iStyle, cWidth, this.colorRefToRgb(color));
          const handle = ++this.nextGdiHandle;
          this.gdiMap.set(handle, pen);
          return handle;
        },

        GetStockObject: (i: number): number => {
          let obj: any;
          switch (i) {
            case 0: // WHITE_BRUSH
              obj = CreateSolidBrush("#ffffff");
              break;
            case 1: // LTGRAY_BRUSH
              obj = CreateSolidBrush("#c0c0c0");
              break;
            case 2: // GRAY_BRUSH
              obj = CreateSolidBrush("#808080");
              break;
            case 3: // DKGRAY_BRUSH
              obj = CreateSolidBrush("#404040");
              break;
            case 4: // BLACK_BRUSH
              obj = CreateSolidBrush("#000000");
              break;
            case 5: // NULL_BRUSH / HOLLOW_BRUSH
              obj = { type: "brush" as const, color: "transparent" };
              break;
            case 6: // WHITE_PEN
              obj = CreatePen(0, 1, "#ffffff");
              break;
            case 7: // BLACK_PEN
              obj = CreatePen(0, 1, "#000000");
              break;
            case 10: // OEM_FIXED_FONT
            case 11: // ANSI_FIXED_FONT
            case 12: // ANSI_VAR_FONT
            case 13: // SYSTEM_FONT
            case 14: // DEVICE_DEFAULT_FONT
            case 16: // SYSTEM_FIXED_FONT
              obj = { type: "font" as const, faceName: "MS Sans Serif", height: 16, weight: 400, italic: false };
              break;
            default:
              obj = CreateSolidBrush("#ffffff");
          }
          const handle = ++this.nextGdiHandle;
          this.gdiMap.set(handle, obj);
          return handle;
        },

        SelectObject: (hdcHandle: number, hObj: number) => {
          const hdc = this.hdcMap.get(hdcHandle);
          const obj = this.gdiMap.get(hObj);
          if (!hdc || !obj) return 0;
          if ((obj.type === "bitmap" || obj.type === "DIBSECTION") && obj.canvas) {
            if (obj.type === "DIBSECTION" && this.memory && obj.ctx) {
              const canvas = renderDibToCanvas(this.memory.buffer, obj.pbmiPtr, obj.pBits);
              if (canvas) {
                obj.ctx.drawImage(canvas, 0, 0);
              }
            }
            hdc.canvas = obj.canvas;
            hdc.ctx = obj.ctx;
          }
          if (obj.type === "font") {
            const prev = (hdc as any).selectedFontHandle || 10;
            (hdc as any).selectedFontHandle = hObj;
            (hdc as any).selectedFont = obj;
            if (hdc.ctx) {
              const fontStyle = obj.italic ? "italic " : "";
              const fontWeight = obj.weight >= 700 ? "bold " : "";
              const fontSize = Math.abs(obj.height) || 12;
              hdc.ctx.font = `${fontStyle}${fontWeight}${fontSize}px "${obj.faceName || "MS Sans Serif"}", sans-serif`;
            }
            return prev;
          }
          if (obj.type === "pen") {
            const prev = (hdc as any).selectedPenHandle || 6;
            (hdc as any).selectedPenHandle = hObj;
            hdc.currentPen = obj;
            if ((hdc as any).svgRecorder) {
              (hdc as any).svgRecorder.setPen(obj.color || "#000000", obj.width || 1);
            }
            return prev;
          }
          if (obj.type === "brush") {
            const prev = (hdc as any).selectedBrushHandle || 0;
            (hdc as any).selectedBrushHandle = hObj;
            hdc.currentBrush = obj;
            if ((hdc as any).svgRecorder) {
              (hdc as any).svgRecorder.setBrush(obj.color || "#ffffff");
            }
            return prev;
          }
          SelectObject(hdc, obj);
          return hObj;
        },

        DeleteObject: (ho: number) => {
          this.gdiMap.delete(ho);
          return 1;
        },

        FillRect: (hdcHandle: number, lpRect: number, hBrushHandle: number) => {
          if (!this.memory || !lpRect) return 0;
          const view = new DataView(this.memory.buffer);
          const left = view.getInt32(lpRect, true);
          const top = view.getInt32(lpRect + 4, true);
          const right = view.getInt32(lpRect + 8, true);
          const bottom = view.getInt32(lpRect + 12, true);
          const rc: RECT = { left, top, right, bottom };

          const hdc = this.hdcMap.get(hdcHandle);
          if (hdc) {
            const brush = this.gdiMap.get(hBrushHandle) ?? {
              type: "brush" as const,
              color: this.colorRefToRgb(hBrushHandle),
            };
            return FillRect(hdc, rc, brush) ? 1 : 0;
          }
          return 1;
        },

        DrawTextA: (
          hdcHandle: number,
          lpString: number,
          nCount: number,
          lpRect: number,
          uFormat: number
        ) => {
          if (!this.memory || !lpRect || !lpString) return 0;

          let text = this.readCString(lpString, "DrawTextA");
          if (nCount > 0 && nCount < text.length) {
            text = text.substring(0, nCount);
          }

          const view = new DataView(this.memory.buffer);
          const left = view.getInt32(lpRect, true);
          const top = view.getInt32(lpRect + 4, true);
          const right = view.getInt32(lpRect + 8, true);
          const bottom = view.getInt32(lpRect + 12, true);
          const rectWidth = right - left;
          const rectHeight = bottom - top;

          const hdc = this.hdcMap.get(hdcHandle);
          const ctx = hdc?.ctx;
          if (ctx) {
            ctx.save();
            ctx.font = '12px "MS Sans Serif", "Pixelated MS Sans Serif", Tahoma, sans-serif';
            ctx.fillStyle = hdc.textColor;
          }

          const measureWidth = (str: string) => {
            if (ctx) return ctx.measureText(str).width;
            return str.length * 7;
          };

          const lineHeight = 16;
          const isSingleLine = !!(uFormat & 0x20); // DT_SINGLELINE
          const isCenter = !!(uFormat & 0x01); // DT_CENTER
          const isRight = !!(uFormat & 0x02); // DT_RIGHT
          const isVCenter = !!(uFormat & 0x04); // DT_VCENTER
          const isBottom = !!(uFormat & 0x08); // DT_BOTTOM
          const isWordBreak = !!(uFormat & 0x10); // DT_WORDBREAK
          const isCalcRect = !!(uFormat & 0x400); // DT_CALCRECT

          let lines: string[] = [];
          if (isSingleLine) {
            lines = [text.replace(/[\r\n]+/g, " ")];
          } else if (isWordBreak) {
            const words = text.split(/\s+/);
            let curLine = "";
            for (const w of words) {
              const testLine = curLine ? `${curLine} ${w}` : w;
              if (rectWidth > 0 && measureWidth(testLine) > rectWidth && curLine) {
                lines.push(curLine);
                curLine = w;
              } else {
                curLine = testLine;
              }
            }
            if (curLine) lines.push(curLine);
          } else {
            lines = text.split(/\r?\n/);
          }

          const totalHeight = lines.length * lineHeight;

          if (isCalcRect) {
            let maxW = 0;
            for (const l of lines) {
              const w = measureWidth(l);
              if (w > maxW) maxW = w;
            }
            view.setInt32(lpRect + 8, left + Math.ceil(maxW), true);
            view.setInt32(lpRect + 12, top + totalHeight, true);
            if (ctx) ctx.restore();
            return totalHeight;
          }

          if (ctx) {
            let startY = top;
            if (isVCenter) {
              startY = top + Math.max(0, Math.floor((rectHeight - totalHeight) / 2));
            } else if (isBottom) {
              startY = bottom - totalHeight;
            }

            ctx.textBaseline = "top";

            for (let i = 0; i < lines.length; i++) {
              const line = lines[i];
              const lineWidth = measureWidth(line);
              let x = left;
              if (isCenter) {
                x = left + Math.floor((rectWidth - lineWidth) / 2);
              } else if (isRight) {
                x = right - lineWidth;
              }
              ctx.fillText(line, x, startY + i * lineHeight);
            }

            ctx.restore();
          }

          return totalHeight;
        },

        // --- COM / DCOM APIs ---
        CoInitialize: (_pvReserved: number) => {
          return comRuntime.CoInitialize();
        },

        CoInitializeEx: (_pvReserved: number, dwCoInit: number) => {
          return comRuntime.CoInitializeEx(null, dwCoInit);
        },

        CoUninitialize: () => {
          comRuntime.CoUninitialize();
        },

        CoCreateInstance: (
          rclsidPtr: number,
          _pUnkOuter: number,
          dwClsContext: number,
          riidPtr: number,
          ppvPtr: number
        ) => {
          if (!this.memory || !ppvPtr) return E_POINTER;
          const clsidStr = this.readGuidFromMemory(rclsidPtr);
          const riidStr = this.readGuidFromMemory(riidPtr) || IID_IUnknown;

          const res = comRuntime.CoCreateInstance(clsidStr, null, dwClsContext || CLSCTX_ALL, riidStr);
          if (res.hr !== S_OK || !res.ppv) {
            const view = new DataView(this.memory.buffer);
            view.setUint32(ppvPtr, 0, true);
            return res.hr;
          }

          const proxyPtr = this.allocateWasmComProxy(res.ppv);
          const view = new DataView(this.memory.buffer);
          view.setUint32(ppvPtr, proxyPtr, true);
          return S_OK;
        },

        CoCreateInstanceEx: (
          rclsidPtr: number,
          punkOuter: number,
          dwClsCtx: number,
          _pServerInfoPtr: number,
          cmq: number,
          pResultsPtr: number
        ) => {
          if (!this.memory || !pResultsPtr) return E_POINTER;
          const view = new DataView(this.memory.buffer);
          let allOk = true;

          for (let i = 0; i < cmq; i++) {
            const offset = pResultsPtr + i * 12;
            const pIIDPtr = view.getUint32(offset, true);
            const riidStr = this.readGuidFromMemory(pIIDPtr) || IID_IUnknown;
            const clsidStr = this.readGuidFromMemory(rclsidPtr);

            const res = comRuntime.CoCreateInstance(clsidStr, null, dwClsCtx || CLSCTX_ALL, riidStr);
            if (res.hr === S_OK && res.ppv) {
              const proxyPtr = this.allocateWasmComProxy(res.ppv);
              view.setUint32(offset + 4, proxyPtr, true);
              view.setInt32(offset + 8, S_OK, true);
            } else {
              view.setUint32(offset + 4, 0, true);
              view.setInt32(offset + 8, res.hr, true);
              allOk = false;
            }
          }

          return allOk ? S_OK : 1; // S_FALSE if some failed
        },

        // --- Chapter 07: Mouse Input & Window Helpers ---
        SetROP2: (hdcHandle: number, rop2: number) => {
          const prev = this.hdcRop2.get(hdcHandle) ?? 13;
          this.hdcRop2.set(hdcHandle, rop2);
          const hdc = this.hdcMap.get(hdcHandle);
          if (hdc?.ctx) {
            if (rop2 === 6 || rop2 === 7) {
              hdc.ctx.globalCompositeOperation = "difference";
            } else {
              hdc.ctx.globalCompositeOperation = "source-over";
            }
          }
          return prev;
        },

        GetROP2: (hdcHandle: number) => {
          return this.hdcRop2.get(hdcHandle) ?? 13;
        },

        SetCapture: (hWnd: number) => {
          const prev = this.capturedHwnd;
          this.capturedHwnd = hWnd;
          return prev ?? 0;
        },

        ReleaseCapture: () => {
          this.capturedHwnd = null;
          return 1;
        },

        GetCapture: () => {
          return this.capturedHwnd ?? 0;
        },

        GetCursorPos: (lpPoint: number) => {
          if (!this.memory || !lpPoint) return 0;
          const view = new DataView(this.memory.buffer);
          view.setInt32(lpPoint, this.cursorPos.x, true);
          view.setInt32(lpPoint + 4, this.cursorPos.y, true);
          return 1;
        },

        SetCursorPos: (x: number, y: number) => {
          this.cursorPos = { x, y };
          return 1;
        },

        ScreenToClient: (hWnd: number, lpPoint: number) => {
          if (!this.memory || !lpPoint) return 0;
          const win = kernel.getWindow(hWnd);
          const view = new DataView(this.memory.buffer);
          const x = view.getInt32(lpPoint, true);
          const y = view.getInt32(lpPoint + 4, true);
          const offsetX = win ? win.x : 0;
          const offsetY = win ? win.y : 0;
          view.setInt32(lpPoint, x - offsetX, true);
          view.setInt32(lpPoint + 4, y - offsetY, true);
          return 1;
        },

        ClientToScreen: (hWnd: number, lpPoint: number) => {
          if (!this.memory || !lpPoint) return 0;
          const win = kernel.getWindow(hWnd);
          const view = new DataView(this.memory.buffer);
          const x = view.getInt32(lpPoint, true);
          const y = view.getInt32(lpPoint + 4, true);
          const offsetX = win ? win.x : 0;
          const offsetY = win ? win.y : 0;
          view.setInt32(lpPoint, x + offsetX, true);
          view.setInt32(lpPoint + 4, y + offsetY, true);
          return 1;
        },

        GetWindowLongA: (hWnd: number, nIndex: number) => {
          const win = kernel.getWindow(hWnd);
          if (nIndex === -16) {
            return win ? win.style : 0;
          }
          if (nIndex === -20) {
            return win ? win.exStyle : 0;
          }
          if (nIndex === -12) {
            return win ? (win.menuId ?? 0) : 0;
          }
          if (nIndex === -6) {
            return 0x400000;
          }
          if (nIndex === -8) {
            return win ? (win.parentHwnd ?? win.ownerHwnd ?? 0) : 0;
          }
          return this.windowLongs.get(`${hWnd}:${nIndex}`) ?? 0;
        },

        SetWindowLongA: (hWnd: number, nIndex: number, dwNewLong: number) => {
          const win = kernel.getWindow(hWnd);
          const oldVal = (win32Imports as any).GetWindowLongA(hWnd, nIndex);
          if (nIndex === -16 && win) {
            win.style = dwNewLong;
          } else if (nIndex === -20 && win) {
            win.exStyle = dwNewLong;
          } else if (nIndex === -12 && win) {
            win.menuId = dwNewLong;
          } else if (nIndex === -8 && win) {
            win.parentHwnd = dwNewLong;
          } else {
            this.windowLongs.set(`${hWnd}:${nIndex}`, dwNewLong);
          }
          return oldVal;
        },

        GetWindowLong: (hWnd: number, nIndex: number) => (win32Imports as any).GetWindowLongA(hWnd, nIndex),
        SetWindowLong: (hWnd: number, nIndex: number, dwNewLong: number) => (win32Imports as any).SetWindowLongA(hWnd, nIndex, dwNewLong),

        MoveWindow: (
          hWnd: number,
          x: number,
          y: number,
          nWidth: number,
          nHeight: number,
          bRepaint: number
        ) => {
          return kernel.MoveWindow(hWnd, x, y, nWidth, nHeight, Boolean(bRepaint)) ? 1 : 0;
        },

        SetFocus: (hWnd: number) => {
          const prev = kernel.activeHwnd;
          kernel.activeHwnd = hWnd;
          if (prev && prev !== hWnd) {
            kernel.SendMessage(prev, 0x0008, hWnd, 0); // WM_KILLFOCUS
          }
          kernel.SendMessage(hWnd, 0x0007, prev ?? 0, 0); // WM_SETFOCUS
          return prev ?? 0;
        },

        GetFocus: () => {
          return kernel.activeHwnd ?? 0;
        },

        GetDlgItem: (hDlg: number, nIDDlgItem: number) => {
          const child = kernel.windows.find(
            (w) => w.parentHwnd === hDlg && w.menuId === nIDDlgItem
          );
          return child ? child.hwnd : 0;
        },

        GetParent: (hWnd: number) => {
          const win = kernel.getWindow(hWnd);
          return win ? (win.parentHwnd ?? win.ownerHwnd ?? 0) : 0;
        },

        GetWindow: (hWnd: number, uCmd: number) => {
          const win = kernel.getWindow(hWnd);
          if (!win) return 0;
          if (uCmd === 5 /* GW_CHILD */) {
            const child = kernel.windows.find((w) => w.parentHwnd === hWnd);
            return child ? child.hwnd : 0;
          }
          if (uCmd === 4 /* GW_OWNER */) {
            return win.ownerHwnd ?? 0;
          }
          const siblings = kernel.windows.filter((w) => w.parentHwnd === win.parentHwnd);
          if (uCmd === 0 /* GW_HWNDFIRST */) {
            return siblings[0]?.hwnd ?? 0;
          }
          if (uCmd === 1 /* GW_HWNDLAST */) {
            return siblings[siblings.length - 1]?.hwnd ?? 0;
          }
          if (uCmd === 2 /* GW_HWNDNEXT */) {
            const idx = siblings.findIndex((w) => w.hwnd === hWnd);
            return idx >= 0 && idx + 1 < siblings.length ? siblings[idx + 1].hwnd : 0;
          }
          if (uCmd === 3 /* GW_HWNDPREV */) {
            const idx = siblings.findIndex((w) => w.hwnd === hWnd);
            return idx > 0 ? siblings[idx - 1].hwnd : 0;
          }
          return 0;
        },

        IsWindow: (hWnd: number) => (kernel.getWindow(hWnd) ? 1 : 0),

        EnumChildWindows: (hWndParent: number, lpEnumFunc: number, lParam: number) => {
          if (!lpEnumFunc || !this.table) return 0;
          const cb = this.table.get(lpEnumFunc);
          if (!cb) return 0;
          const children = kernel.windows.filter((w) => w.parentHwnd === hWndParent);
          for (const child of [...children]) {
            if (kernel.getWindow(child.hwnd)) {
              const res = cb(child.hwnd, lParam);
              if (!res) break;
            }
          }
          return 1;
        },

        TranslateMDISysAccel: (_hWndClient: number, _lpMsg: number) => 0,

        DrawMenuBar: (_hWnd: number) => 1,

        SetPixel: (hdcHandle: number, x: number, y: number, crColor: number) => {
          const hdc = this.hdcMap.get(hdcHandle);
          if (hdc?.ctx) {
            hdc.ctx.fillStyle = this.colorRefToRgb(crColor);
            hdc.ctx.fillRect(x, y, 1, 1);
          }
          return crColor;
        },

        InvertRect: (hdcHandle: number, lprc: number) => {
          if (!this.memory || !lprc) return 0;
          const hdc = this.hdcMap.get(hdcHandle);
          const ctx = hdc?.ctx;
          if (!ctx) return 1;
          const view = new DataView(this.memory.buffer);
          const left = view.getInt32(lprc, true);
          const top = view.getInt32(lprc + 4, true);
          const right = view.getInt32(lprc + 8, true);
          const bottom = view.getInt32(lprc + 12, true);
          ctx.save();
          ctx.globalCompositeOperation = "difference";
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(left, top, right - left, bottom - top);
          ctx.restore();
          return 1;
        },

        DrawFocusRect: (hdcHandle: number, lprc: number) => {
          if (!this.memory || !lprc) return 0;
          const hdc = this.hdcMap.get(hdcHandle);
          const ctx = hdc?.ctx;
          if (!ctx) return 1;
          const view = new DataView(this.memory.buffer);
          const left = view.getInt32(lprc, true);
          const top = view.getInt32(lprc + 4, true);
          const right = view.getInt32(lprc + 8, true);
          const bottom = view.getInt32(lprc + 12, true);
          ctx.save();
          ctx.setLineDash([1, 1]);
          ctx.strokeStyle = "#000000";
          ctx.lineWidth = 1;
          ctx.strokeRect(left + 0.5, top + 0.5, right - left - 1, bottom - top - 1);
          ctx.restore();
          return 1;
        },

        SystemParametersInfoA: (
          uiAction: number,
          _uiParam: number,
          pvParam: number,
          _fWinIni: number
        ) => {
          if (uiAction === 104) { // SPI_GETWHEELSCROLLLINES
            if (this.memory && pvParam) {
              const view = new DataView(this.memory.buffer);
              view.setUint32(pvParam, 3, true);
            }
            return 1;
          }
          return 1;
        },

        SystemParametersInfo: (
          uiAction: number,
          uiParam: number,
          pvParam: number,
          fWinIni: number
        ) => (win32Imports as any).SystemParametersInfoA(uiAction, uiParam, pvParam, fWinIni),

        // --- Chapter 08: Timers, Date/Time & Display DCs ---
        GetLocalTime: (lpSystemTime: number) => {
          if (!this.memory || !lpSystemTime) return;
          const now = new Date();
          const view = new DataView(this.memory.buffer);
          view.setUint16(lpSystemTime, now.getFullYear(), true);
          view.setUint16(lpSystemTime + 2, now.getMonth() + 1, true);
          view.setUint16(lpSystemTime + 4, now.getDay(), true);
          view.setUint16(lpSystemTime + 6, now.getDate(), true);
          view.setUint16(lpSystemTime + 8, now.getHours(), true);
          view.setUint16(lpSystemTime + 10, now.getMinutes(), true);
          view.setUint16(lpSystemTime + 12, now.getSeconds(), true);
          view.setUint16(lpSystemTime + 14, now.getMilliseconds(), true);
        },

        GetSystemTime: (lpSystemTime: number) => {
          if (!this.memory || !lpSystemTime) return;
          const now = new Date();
          const view = new DataView(this.memory.buffer);
          view.setUint16(lpSystemTime, now.getUTCFullYear(), true);
          view.setUint16(lpSystemTime + 2, now.getUTCMonth() + 1, true);
          view.setUint16(lpSystemTime + 4, now.getUTCDay(), true);
          view.setUint16(lpSystemTime + 6, now.getUTCDate(), true);
          view.setUint16(lpSystemTime + 8, now.getUTCHours(), true);
          view.setUint16(lpSystemTime + 10, now.getUTCMinutes(), true);
          view.setUint16(lpSystemTime + 12, now.getUTCSeconds(), true);
          view.setUint16(lpSystemTime + 14, now.getUTCMilliseconds(), true);
        },

        GetLocaleInfoA: (
          _Locale: number,
          LCType: number,
          lpLCData: number,
          cchData: number
        ) => {
          let str = "";
          if (LCType === 0x23) { // LOCALE_ITIME
            str = "1";
          } else if (LCType === 0x25) { // LOCALE_ITLZERO
            str = "1";
          } else {
            str = "0";
          }
          return this.writeCString(lpLCData, str, cchData);
        },
        GetLocaleInfo: (_Locale: number, LCType: number, lpLCData: number, cchData: number) =>
          (win32Imports as any).GetLocaleInfoA(_Locale, LCType, lpLCData, cchData),

        CreateICA: () => (win32Imports as any).CreateDCA(),
        CreateIC: () => (win32Imports as any).CreateICA(),

        CreateDCA: () => {
          const canvas = typeof document !== "undefined" ? document.createElement("canvas") : ({} as any);
          const ctx = canvas.getContext ? canvas.getContext("2d") : null;
          const hdc = new HDC(0 as any, canvas, ctx as any);
          const handle = ++this.nextHdcHandle;
          this.hdcMap.set(handle, hdc);
          return handle;
        },
        CreateDC: () => (win32Imports as any).CreateDCA(),

        DeleteDC: (hdcHandle: number) => {
          this.hdcMap.delete(hdcHandle);
          return 1;
        },

        GetPixel: (hdcHandle: number, x: number, y: number) => {
          const hdc = this.hdcMap.get(hdcHandle);
          const ctx = hdc?.ctx;
          if (ctx) {
            try {
              const pixel = ctx.getImageData(x, y, 1, 1).data;
              return (pixel[0] & 0xff) | ((pixel[1] & 0xff) << 8) | ((pixel[2] & 0xff) << 16);
            } catch {
              return 0;
            }
          }
          return 0x00ffffff; // default white
        },

        GetSysColor: (nIndex: number) => {
          switch (nIndex) {
            case 5: // COLOR_WINDOW
              return 0x00ffffff; // white
            case 8: // COLOR_WINDOWTEXT
              return 0x00000000; // black
            case 15: // COLOR_BTNFACE
              return 0x00c0c0c0; // silver
            case 16: // COLOR_BTNSHADOW
              return 0x00808080; // gray
            case 20: // COLOR_BTNHIGHLIGHT
              return 0x00ffffff; // white
            case 13: // COLOR_HIGHLIGHT
              return 0x00800000; // dark blue
            case 14: // COLOR_HIGHLIGHTTEXT
              return 0x00ffffff; // white
            default:
              return 0x00c0c0c0;
          }
        },

        OffsetWindowOrgEx: (_hdcHandle: number, _dx: number, _dy: number, _lppt: number) => 1,
        OffsetViewportOrgEx: (_hdcHandle: number, _dx: number, _dy: number, _lppt: number) => 1,

        // --- Chapter 09: Child Window Controls, Files & Environment ---
        GetDialogBaseUnits: () => (16 << 16) | 8,

        ValidateRect: (_hWnd: number, _lpRect: number) => 1,

        SetClassLongA: (_hWnd: number, _nIndex: number, dwNewLong: number) => dwNewLong,
        SetClassLong: (hWnd: number, nIndex: number, dwNewLong: number) =>
          (win32Imports as any).SetClassLongA(hWnd, nIndex, dwNewLong),

        GetKeyState: (_nVirtKey: number) => 0,

        CallWindowProcA: (
          lpPrevWndFunc: number,
          hWnd: number,
          Msg: number,
          wParam: number,
          lParam: number
        ) => {
          if (lpPrevWndFunc && this.table) {
            const targetFn = this.table.get(lpPrevWndFunc);
            if (typeof targetFn === "function") {
              return targetFn(hWnd, Msg, wParam, lParam);
            }
          }
          return DefWindowProc(hWnd, Msg, wParam, lParam);
        },
        CallWindowProc: (
          lpPrevWndFunc: number,
          hWnd: number,
          Msg: number,
          wParam: number,
          lParam: number
        ) => (win32Imports as any).CallWindowProcA(lpPrevWndFunc, hWnd, Msg, wParam, lParam),

        GetWindowRect: (hWnd: number, lpRect: number) => {
          if (!this.memory || !lpRect) return 0;
          const win = kernel.getWindow(hWnd);
          const x = win ? win.x : 0;
          const y = win ? win.y : 0;
          const w = win ? win.width : 500;
          const h = win ? win.height : 350;
          const view = new DataView(this.memory.buffer);
          view.setInt32(lpRect, x, true);
          view.setInt32(lpRect + 4, y, true);
          view.setInt32(lpRect + 8, x + w, true);
          view.setInt32(lpRect + 12, y + h, true);
          return 1;
        },

        FrameRect: (hdcHandle: number, lprc: number, _hbr: number) => {
          if (!this.memory || !lprc) return 0;
          const hdc = this.hdcMap.get(hdcHandle);
          const ctx = hdc?.ctx;
          if (!ctx) return 1;
          const view = new DataView(this.memory.buffer);
          const left = view.getInt32(lprc, true);
          const top = view.getInt32(lprc + 4, true);
          const right = view.getInt32(lprc + 8, true);
          const bottom = view.getInt32(lprc + 12, true);
          ctx.strokeRect(left, top, right - left, bottom - top);
          return 1;
        },

        SetBkColor: (hdcHandle: number, color: number) => {
          const hdc = this.hdcMap.get(hdcHandle);
          if (hdc) {
            SetBkColor(hdc, this.colorRefToRgb(color));
          }
          return color;
        },

        GetEnvironmentStringsA: () => {
          const envStr = "PATH=C:\\WINDOWS\\SYSTEM32\0SYSTEMROOT=C:\\WINDOWS\0USERNAME=Administrator\0\0";
          const bytes = new TextEncoder().encode(envStr);
          const ptr = this.allocateMemory(bytes.length);
          if (this.memory) {
            const u8 = new Uint8Array(this.memory.buffer);
            u8.set(bytes, ptr);
          }
          return ptr;
        },
        GetEnvironmentStrings: () => (win32Imports as any).GetEnvironmentStringsA(),

        FreeEnvironmentStringsA: (_p: number) => 1,
        FreeEnvironmentStrings: (p: number) => (win32Imports as any).FreeEnvironmentStringsA(p),

        GetEnvironmentVariableA: (lpName: number, lpBuffer: number, nSize: number) => {
          const name = this.readCString(lpName);
          let val = "C:\\WINDOWS";
          if (name.toUpperCase() === "PATH") val = "C:\\WINDOWS\\SYSTEM32";
          else if (name.toUpperCase() === "USERNAME") val = "Administrator";
          return this.writeCString(lpBuffer, val, nSize);
        },
        GetEnvironmentVariable: (lpName: number, lpBuffer: number, nSize: number) =>
          (win32Imports as any).GetEnvironmentVariableA(lpName, lpBuffer, nSize),

        GetCurrentDirectoryA: (nBufferLength: number, lpBuffer: number) => {
          return this.writeCString(lpBuffer, "C:\\", nBufferLength);
        },
        GetCurrentDirectory: (nBufferLength: number, lpBuffer: number) =>
          (win32Imports as any).GetCurrentDirectoryA(nBufferLength, lpBuffer),

        SetCurrentDirectoryA: (_lpPathName: number) => 1,
        SetCurrentDirectory: (lpPathName: number) => (win32Imports as any).SetCurrentDirectoryA(lpPathName),

        CreateFileA: (
          lpFileName: number,
          _dwDesiredAccess: number,
          _dwShareMode: number,
          _lpSecurityAttributes: number,
          _dwCreationDisposition: number,
          _dwFlagsAndAttributes: number,
          _hTemplateFile: number
        ) => {
          const fileName = this.readCString(lpFileName);
          if (fileName.includes("nonexistent") || fileName.includes("fail")) {
            return -1; // INVALID_HANDLE_VALUE
          }
          const handle = ++this.nextGdiHandle;
          let data: Uint8Array;
          if (fileName.toLowerCase().endsWith(".bmp")) {
            const isTopDown = fileName.toLowerCase().includes("td");
            data = createSyntheticBmp(220, 240, isTopDown);
          } else {
            const mockContent = "Programming Windows by Charles Petzold (5th Edition)\nSample File Output\n";
            data = new TextEncoder().encode(mockContent);
          }
          this.openFileMap.set(handle, { fileName, data, position: 0 });
          return handle;
        },
        CreateFile: (...args: any[]) => (win32Imports as any).CreateFileA(...args),

        ReadFile: (
          hFile: number,
          lpBuffer: number,
          nNumberOfBytesToRead: number,
          lpNumberOfBytesRead: number,
          _lpOverlapped: number
        ) => {
          const file = this.openFileMap.get(hFile);
          let toRead = 0;
          if (file && this.memory) {
            toRead = Math.min(nNumberOfBytesToRead, Math.max(0, file.data.byteLength - file.position));
            const dst = new Uint8Array(this.memory.buffer, lpBuffer, toRead);
            dst.set(file.data.subarray(file.position, file.position + toRead));
            file.position += toRead;
          } else if (this.memory) {
            const mockContent = "Programming Windows by Charles Petzold (5th Edition)\nSample File Output\n";
            toRead = this.writeCString(lpBuffer, mockContent, nNumberOfBytesToRead);
          }
          if (this.memory && lpNumberOfBytesRead) {
            const view = new DataView(this.memory.buffer);
            view.setUint32(lpNumberOfBytesRead, toRead, true);
          }
          return 1;
        },

        CloseHandle: (hObject: number) => {
          this.openFileMap.delete(hObject);
          return 1;
        },

        // --- Chapter 10: Menus, Accelerators & Resources ---
        DestroyWindow: (hWnd: number) => (DestroyWindow(hWnd) ? 1 : 0),

        CreateMenu: () => ++this.nextGdiHandle,
        CreatePopupMenu: () => ++this.nextGdiHandle,

        AppendMenuA: (
          _hMenu: number,
          _uFlags: number,
          _uIDNewItem: number,
          _lpNewItem: number
        ) => 1,
        AppendMenu: (...args: any[]) => (win32Imports as any).AppendMenuA(...args),

        InsertMenuA: (
          _hMenu: number,
          _uPosition: number,
          _uFlags: number,
          _uIDNewItem: number,
          _lpNewItem: number
        ) => 1,
        InsertMenu: (...args: any[]) => (win32Imports as any).InsertMenuA(...args),

        ModifyMenuA: (
          _hMnu: number,
          _uPosition: number,
          _uFlags: number,
          _uIDNewItem: number,
          _lpItem: number
        ) => 1,
        ModifyMenu: (...args: any[]) => (win32Imports as any).ModifyMenuA(...args),

        DeleteMenu: (_hMenu: number, _uPosition: number, _uFlags: number) => 1,
        DestroyMenu: (_hMenu: number) => 1,

        SetMenu: (_hWnd: number, _hMenu: number) => 1,
        GetMenu: (_hWnd: number) => ++this.nextGdiHandle,
        GetSubMenu: (_hMenu: number, _nPos: number) => ++this.nextGdiHandle,
        GetSystemMenu: (_hWnd: number, _bRevert: number) => ++this.nextGdiHandle,

        TrackPopupMenu: (
          _hMenu: number,
          _uFlags: number,
          _x: number,
          _y: number,
          _nReserved: number,
          _hWnd: number,
          _prcRect: number
        ) => 1,

        EnableMenuItem: (_hMenu: number, _uIDEnableItem: number, _uEnable: number) => 1,
        CheckMenuItem: (_hMenu: number, _uIDCheckItem: number, _uCheck: number) => 0,

        LoadMenuA: (_hInstance: number, _lpMenuName: number) => ++this.nextGdiHandle,
        LoadMenu: (...args: any[]) => (win32Imports as any).LoadMenuA(...args),

        LoadAcceleratorsA: (_hInstance: number, _lpTableName: number) => ++this.nextGdiHandle,
        LoadAccelerators: (...args: any[]) => (win32Imports as any).LoadAcceleratorsA(...args),

        TranslateAcceleratorA: (_hWnd: number, _hAccTable: number, _lpMsg: number) => 0,
        TranslateAccelerator: (...args: any[]) => (win32Imports as any).TranslateAcceleratorA(...args),

        FindResourceA: (_hModule: number, _lpName: number, _lpType: number) => ++this.nextGdiHandle,
        FindResource: (...args: any[]) => (win32Imports as any).FindResourceA(...args),

        LoadResource: (_hModule: number, _hResInfo: number) => ++this.nextGdiHandle,

        LockResource: (_hResData: number) => {
          if (!this.poePoemPtr) {
            const poem =
              "It was many and many a year ago,\n" +
              "   In a kingdom by the sea,\n" +
              "That a maiden there lived whom you may know\n" +
              "   By the name of Annabel Lee;\n" +
              "And this maiden she lived with no other thought\n" +
              "   Than to love and be loved by me.\n" +
              " \n" +
              "I was a child and she was a child\n" +
              "   In this kingdom by the sea,\n" +
              "But we loved with a love that was more than love --\n" +
              "   I and my Annabel Lee --\n" +
              "With a love that the winged seraphs of Heaven\n" +
              "   Coveted her and me.\n" +
              "\\\n";
            const bytes = new TextEncoder().encode(poem);
            this.poePoemPtr = this.allocateMemory(bytes.length + 1);
            if (this.memory && this.poePoemPtr) {
              const u8 = new Uint8Array(this.memory.buffer);
              u8.set(bytes, this.poePoemPtr);
              u8[this.poePoemPtr + bytes.length] = 0;
            }
          }
          return this.poePoemPtr;
        },

        SizeofResource: (_hModule: number, _hResInfo: number) => 1024,
        FreeResource: (_hResData: number) => 1,

        LoadStringA: (
          _hInstance: number,
          uID: number,
          lpBuffer: number,
          cchBufferMax: number
        ) => {
          let str = "PoePoem";
          if (uID === 1) str = "PoePoem";
          else if (uID === 2) str = "\"Annabel Lee\" by Edgar Allan Poe";
          else if (uID === 3) str = "This program requires Windows NT!";
          else str = `String#${uID}`;
          return this.writeCString(lpBuffer, str, cchBufferMax);
        },
        LoadString: (...args: any[]) => (win32Imports as any).LoadStringA(...args),

        DrawIcon: (hdcHandle: number, x: number, y: number, _hIcon: number) => {
          const hdc = this.hdcMap.get(hdcHandle);
          const ctx = hdc?.ctx;
          if (ctx) {
            ctx.save();
            ctx.fillStyle = "#008080";
            ctx.fillRect(x + 2, y + 2, 28, 28);
            ctx.strokeStyle = "#ffffff";
            ctx.strokeRect(x + 2, y + 2, 28, 28);
            ctx.restore();
          }
          return 1;
        },

        // --- Chapter 11: Dialog Boxes & Common Dialogs ---
        DialogBoxParamA: (
          _hInstance: number,
          _lpTemplateName: number,
          _hWndParent: number,
          _lpDialogFunc: number,
          _dwInitParam: number
        ) => 1,
        DialogBoxParam: (...args: any[]) => (win32Imports as any).DialogBoxParamA(...args),
        DialogBoxA: (...args: any[]) => (win32Imports as any).DialogBoxParamA(...args),
        DialogBox: (...args: any[]) => (win32Imports as any).DialogBoxParamA(...args),

        CreateDialogParamA: (
          _hInstance: number,
          _lpTemplateName: number,
          _hWndParent: number,
          _lpDialogFunc: number,
          _dwInitParam: number
        ) => ++this.nextGdiHandle,
        CreateDialogParam: (...args: any[]) => (win32Imports as any).CreateDialogParamA(...args),
        CreateDialogA: (...args: any[]) => (win32Imports as any).CreateDialogParamA(...args),
        CreateDialog: (...args: any[]) => (win32Imports as any).CreateDialogParamA(...args),

        EndDialog: (_hDlg: number, _nResult: number) => 1,

        IsDialogMessageA: (_hDlg: number, _lpMsg: number) => 0,
        IsDialogMessage: (...args: any[]) => (win32Imports as any).IsDialogMessageA(...args),

        CheckRadioButton: (
          _hDlg: number,
          _nIDFirstButton: number,
          _nIDLastButton: number,
          _nIDCheckButton: number
        ) => 1,

        CheckDlgButton: (_hDlg: number, _nIDButton: number, _uCheck: number) => 1,
        IsDlgButtonChecked: (_hDlg: number, _nIDButton: number) => 1,

        SetDlgItemInt: (
          _hDlg: number,
          _nIDDlgItem: number,
          _uValue: number,
          _bSigned: number
        ) => 1,

        GetDlgItemInt: (
          _hDlg: number,
          _nIDDlgItem: number,
          _lpTranslated: number,
          _bSigned: number
        ) => 0,

        SetDlgItemTextA: (_hDlg: number, _nIDDlgItem: number, _lpString: number) => 1,
        SetDlgItemText: (...args: any[]) => (win32Imports as any).SetDlgItemTextA(...args),

        GetDlgItemTextA: (_hDlg: number, _nIDDlgItem: number, lpString: number, cchMax: number) =>
          this.writeCString(lpString, "", cchMax),
        GetDlgItemText: (...args: any[]) => (win32Imports as any).GetDlgItemTextA(...args),

        SendDlgItemMessageA: (
          _hDlg: number,
          _nIDDlgItem: number,
          _Msg: number,
          _wParam: number,
          _lParam: number
        ) => 0,
        SendDlgItemMessage: (...args: any[]) => (win32Imports as any).SendDlgItemMessageA(...args),

        CreateFontIndirectA: (lplf: number) => {
          const handle = ++this.nextGdiHandle;
          let logFontBytes: Uint8Array | null = null;
          let faceName = "MS Sans Serif";
          let height = 16;
          let weight = 400;
          let italic = false;
          if (this.memory && lplf) {
            logFontBytes = new Uint8Array(60);
            logFontBytes.set(new Uint8Array(this.memory.buffer, lplf, 60));
            const dv = new DataView(this.memory.buffer);
            height = dv.getInt32(lplf + 0, true);
            weight = dv.getInt32(lplf + 16, true);
            italic = dv.getUint8(lplf + 20) !== 0;
            faceName = this.readCString(lplf + 28) || "MS Sans Serif";
          }
          const fontObj = {
            type: "font" as const,
            faceName,
            height,
            weight,
            italic,
            raw: logFontBytes,
          };
          this.gdiMap.set(handle, fontObj);
          return handle;
        },
        CreateFontIndirect: (...args: any[]) => (win32Imports as any).CreateFontIndirectA(...args),

        GetObjectA: (hgdiobj: number, cbBuffer: number, lpvObject: number) => {
          if (!this.memory || !lpvObject) return 0;
          const obj = this.gdiMap.get(hgdiobj);
          if (obj && (obj.type === "bitmap" || obj.type === "DIBSECTION" || obj.width !== undefined)) {
            const width = obj.width || 64;
            const height = obj.height || 64;
            const widthBytes = obj.rowBytes || Math.ceil(width / 8);
            const view = new DataView(this.memory.buffer);
            if (cbBuffer >= 24) {
              view.setInt32(lpvObject + 0, 0, true);          // bmType
              view.setInt32(lpvObject + 4, width, true);      // bmWidth
              view.setInt32(lpvObject + 8, height, true);     // bmHeight
              view.setInt32(lpvObject + 12, widthBytes, true);// bmWidthBytes
              view.setUint16(lpvObject + 16, obj.planes || 1, true);        // bmPlanes
              view.setUint16(lpvObject + 18, obj.bitsPixel || obj.bitCount || 1, true); // bmBitsPixel
              view.setUint32(lpvObject + 20, obj.pBits || 0, true);        // bmBits
              return 24;
            }
          }
          if (obj && obj.type === "font" && obj.raw) {
            const copyLen = Math.min(cbBuffer, obj.raw.length);
            new Uint8Array(this.memory.buffer, lpvObject, copyLen).set(obj.raw.subarray(0, copyLen));
            return copyLen;
          }
          return 0;
        },
        GetObject: (...args: any[]) => (win32Imports as any).GetObjectA(...args),

        WriteFile: (
          hFile: number,
          lpBuffer: number,
          nNumberOfBytesToWrite: number,
          lpNumberOfBytesWritten: number,
          _lpOverlapped: number
        ) => {
          const file = this.openFileMap.get(hFile);
          if (file && this.memory) {
            const src = new Uint8Array(this.memory.buffer, lpBuffer, nNumberOfBytesToWrite);
            const neededLen = file.position + nNumberOfBytesToWrite;
            if (neededLen > file.data.byteLength) {
              const newBuf = new Uint8Array(neededLen);
              newBuf.set(file.data);
              file.data = newBuf;
            }
            file.data.set(src, file.position);
            file.position += nNumberOfBytesToWrite;
          }
          if (this.memory && lpNumberOfBytesWritten) {
            const view = new DataView(this.memory.buffer);
            view.setUint32(lpNumberOfBytesWritten, nNumberOfBytesToWrite, true);
          }
          return 1;
        },

        GetWindowTextLengthA: (_hWnd: number) => 0,
        GetWindowTextLength: (...args: any[]) => (win32Imports as any).GetWindowTextLengthA(...args),

        RegisterWindowMessageA: (_lpString: number) => 0xc000,
        RegisterWindowMessage: (...args: any[]) =>
          (win32Imports as any).RegisterWindowMessageA(...args),

        Sleep: (_dwMilliseconds: number) => {},

        GetFileSize: (hFile: number, lpFileSizeHigh: number) => {
          const file = this.openFileMap.get(hFile);
          const size = file ? file.data.byteLength : 1024;
          if (lpFileSizeHigh && this.memory) {
            new DataView(this.memory.buffer).setUint32(lpFileSizeHigh, 0, true);
          }
          return size;
        },
        IsTextUnicode: (_lpv: number, _iSize: number, _lpiResult: number) => 0,

        WideCharToMultiByte: (
          _CodePage: number,
          _dwFlags: number,
          _lpWideCharStr: number,
          _cchWideChar: number,
          _lpMultiByteStr: number,
          _cbMultiByte: number,
          _lpDefaultChar: number,
          _lpUsedDefaultChar: number
        ) => 0,

        MultiByteToWideChar: (
          _CodePage: number,
          _dwFlags: number,
          _lpMultiByteStr: number,
          _cbMultiByte: number,
          _lpWideCharStr: number,
          _cchWideChar: number
        ) => 0,

        ChooseColorA: (_lpcc: number) => 1,
        ChooseColor: (...args: any[]) => (win32Imports as any).ChooseColorA(...args),

        ChooseFontA: (_lpcf: number) => 1,
        ChooseFont: (...args: any[]) => (win32Imports as any).ChooseFontA(...args),

        GetOpenFileNameA: (lpofn: number) => {
          if (this.memory && lpofn) {
            const view = new DataView(this.memory.buffer);
            const lpstrFilter = view.getUint32(lpofn + 12, true);
            const lpstrDefExt = view.getUint32(lpofn + 60, true);
            const filterStr = lpstrFilter ? this.readCString(lpstrFilter).toLowerCase() : "";
            const defExtStr = lpstrDefExt ? this.readCString(lpstrDefExt).toLowerCase() : "";
            let defaultFile = "Apollo11.bmp";
            if (filterStr.includes("emf") || defExtStr.includes("emf")) {
              defaultFile = "emf8.emf";
            } else if (filterStr.includes("wmf") || defExtStr.includes("wmf")) {
              defaultFile = "metafile.wmf";
            }
            const lpstrFile = view.getUint32(lpofn + 28, true);
            const nMaxFile = view.getUint32(lpofn + 32, true) || 260;
            if (lpstrFile) {
              this.writeCString(lpstrFile, defaultFile, nMaxFile);
            }
            const lpstrFileTitle = view.getUint32(lpofn + 36, true);
            const nMaxFileTitle = view.getUint32(lpofn + 40, true) || 260;
            if (lpstrFileTitle) {
              this.writeCString(lpstrFileTitle, defaultFile, nMaxFileTitle);
            }
          }
          return 1;
        },
        GetOpenFileName: (...args: any[]) => (win32Imports as any).GetOpenFileNameA(...args),

        GetSaveFileNameA: (lpofn: number) => {
          if (this.memory && lpofn) {
            const view = new DataView(this.memory.buffer);
            const lpstrFile = view.getUint32(lpofn + 28, true);
            const nMaxFile = view.getUint32(lpofn + 32, true) || 260;
            if (lpstrFile) {
              this.writeCString(lpstrFile, "Apollo11.bmp", nMaxFile);
            }
            const lpstrFileTitle = view.getUint32(lpofn + 36, true);
            const nMaxFileTitle = view.getUint32(lpofn + 40, true) || 260;
            if (lpstrFileTitle) {
              this.writeCString(lpstrFileTitle, "Apollo11.bmp", nMaxFileTitle);
            }
          }
          return 1;
        },
        GetSaveFileName: (...args: any[]) => (win32Imports as any).GetSaveFileNameA(...args),

        FindTextA: (_lpfr: number) => ++this.nextGdiHandle,
        FindText: (...args: any[]) => (win32Imports as any).FindTextA(...args),

        ReplaceTextA: (_lpfr: number) => ++this.nextGdiHandle,
        ReplaceText: (...args: any[]) => (win32Imports as any).ReplaceTextA(...args),

        // --- Chapter 12: Clipboard & Global Memory ---
        GlobalAlloc: (uFlags: number, dwBytes: number) => {
          const ptr = this.allocateMemory(dwBytes);
          if (!ptr) return 0;
          if (uFlags & 0x0040) { // GMEM_ZEROINIT
            if (this.memory) {
              new Uint8Array(this.memory.buffer, ptr, dwBytes).fill(0);
            }
          }
          this.globalAllocMap.set(ptr, { size: dwBytes, flags: uFlags, locked: 0 });
          return ptr;
        },

        GlobalLock: (hMem: number) => {
          const block = this.globalAllocMap.get(hMem);
          if (block) block.locked++;
          return hMem;
        },

        GlobalUnlock: (hMem: number) => {
          const block = this.globalAllocMap.get(hMem);
          if (block && block.locked > 0) block.locked--;
          return 0;
        },

        GlobalSize: (hMem: number) => {
          const block = this.globalAllocMap.get(hMem);
          return block ? block.size : 0;
        },

        GlobalFree: (hMem: number) => {
          this.globalAllocMap.delete(hMem);
          return 0;
        },

        OpenClipboard: (hWndNewOwner: number) => {
          systemClipboardOpenHwnd = hWndNewOwner;
          return 1;
        },

        CloseClipboard: () => {
          systemClipboardOpenHwnd = 0;
          return 1;
        },

        EmptyClipboard: () => {
          systemClipboardData.clear();
          systemClipboardOwner = systemClipboardOpenHwnd;
          return 1;
        },

        IsClipboardFormatAvailable: (format: number) => {
          if (format === 1 /* CF_TEXT */ || format === 13 /* CF_UNICODETEXT */) {
            return systemClipboardData.has(1) || systemClipboardData.has(13) ? 1 : 0;
          }
          return systemClipboardData.has(format) ? 1 : 0;
        },

        GetClipboardData: (uFormat: number) => {
          let bytes = systemClipboardData.get(uFormat);
          if (!bytes) {
            // Automatic text conversion between CF_TEXT (1) and CF_UNICODETEXT (13)
            if (uFormat === 1 && systemClipboardData.has(13)) {
              const u16Bytes = systemClipboardData.get(13)!;
              const u16 = new Uint16Array(u16Bytes.buffer, u16Bytes.byteOffset, Math.floor(u16Bytes.byteLength / 2));
              const ansi = new Uint8Array(u16.length + 1);
              for (let i = 0; i < u16.length; i++) {
                ansi[i] = u16[i] <= 0xFF ? u16[i] : 63; // '?'
              }
              bytes = ansi;
            } else if (uFormat === 13 && systemClipboardData.has(1)) {
              const ansi = systemClipboardData.get(1)!;
              const u16 = new Uint16Array(ansi.length + 1);
              for (let i = 0; i < ansi.length; i++) {
                u16[i] = ansi[i];
              }
              bytes = new Uint8Array(u16.buffer, u16.byteOffset, u16.byteLength);
            }
          }

          if (!bytes || !this.memory) return 0;

          const ptr = this.allocateMemory(bytes.byteLength);
          new Uint8Array(this.memory.buffer, ptr, bytes.byteLength).set(bytes);
          this.globalAllocMap.set(ptr, { size: bytes.byteLength, flags: 0, locked: 0 });
          return ptr;
        },

        SetClipboardData: (uFormat: number, hMem: number) => {
          if (!this.memory) return 0;
          let size = 0;
          const block = this.globalAllocMap.get(hMem);
          if (block) {
            size = block.size;
          } else if (uFormat === 1) { // CF_TEXT: scan for null terminator
            const view = new Uint8Array(this.memory.buffer, hMem);
            while (size < view.length && view[size] !== 0) size++;
            size++; // include null terminator
          } else if (uFormat === 13) { // CF_UNICODETEXT: scan for UTF-16 null
            const view = new Uint16Array(this.memory.buffer, hMem);
            while (size < view.length && view[size] !== 0) size++;
            size = (size + 1) * 2;
          } else {
            size = 256;
          }

          const srcBytes = new Uint8Array(this.memory.buffer, hMem, size);
          const copy = new Uint8Array(size);
          copy.set(srcBytes);
          systemClipboardData.set(uFormat, copy);

          // Broadcast WM_DRAWCLIPBOARD (0x0308) to clipboard viewer chain
          if (systemClipboardViewers.length > 0) {
            const topViewer = systemClipboardViewers[systemClipboardViewers.length - 1];
            SendMessage(topViewer.hwnd, 0x0308, 0, 0);
          }

          return hMem;
        },

        SetClipboardViewer: (hWndNewViewer: number) => {
          const prevViewerHwnd = systemClipboardViewers.length > 0 
            ? systemClipboardViewers[systemClipboardViewers.length - 1].hwnd 
            : 0;
          systemClipboardViewers.push({ runtime: this, hwnd: hWndNewViewer });
          return prevViewerHwnd;
        },

        ChangeClipboardChain: (hWndRemove: number, hWndNewNext: number) => {
          const idx = systemClipboardViewers.findIndex(v => v.hwnd === hWndRemove);
          if (idx !== -1) {
            systemClipboardViewers.splice(idx, 1);
          }
          if (systemClipboardViewers.length > 0) {
            const topViewer = systemClipboardViewers[systemClipboardViewers.length - 1];
            SendMessage(topViewer.hwnd, 0x030D, hWndRemove, hWndNewNext); // WM_CHANGECBCHAIN
          }
          return 1;
        },

        // --- Chapter 13: Printing & Spooler ---
        GetVersion: () => 0xc0000004, // Windows 98 (bit 31 set)

        EnableWindow: (_hWnd: number, _bEnable: number) => 1,

        GetMenuItemCount: (_hMenu: number) => 1,

        GetMenuStringA: (
          _hMenu: number,
          _uIDItem: number,
          lpString: number,
          cchMax: number,
          _flags: number
        ) => {
          return this.writeCString(lpString, "Generic / Text Only", cchMax);
        },
        GetMenuString: (...args: any[]) => (win32Imports as any).GetMenuStringA(...args),

        EnumPrintersA: (
          _Flags: number,
          _Name: number,
          Level: number,
          pPrinterEnum: number,
          cbBuf: number,
          pcbNeeded: number,
          pcReturned: number
        ) => {
          if (!this.memory) return 0;
          const printerName = "Generic / Text Only";
          const portName = "LPT1:";
          const headerSize = Level === 5 ? 20 : 12;
          const nameBytes = printerName.length + 1;
          const portBytes = portName.length + 1;
          const needed = headerSize + nameBytes + portBytes;

          if (pcbNeeded) {
            new DataView(this.memory.buffer).setUint32(pcbNeeded, needed, true);
          }

          if (!pPrinterEnum || cbBuf < needed) {
            if (pcReturned) {
              new DataView(this.memory.buffer).setUint32(pcReturned, 0, true);
            }
            return 0;
          }

          const dv = new DataView(this.memory.buffer);
          const strOffsetName = pPrinterEnum + headerSize;
          const strOffsetPort = strOffsetName + nameBytes;

          this.writeCString(strOffsetName, printerName, nameBytes);
          this.writeCString(strOffsetPort, portName, portBytes);

          if (Level === 5) {
            dv.setUint32(pPrinterEnum + 0, strOffsetName, true); // pPrinterName
            dv.setUint32(pPrinterEnum + 4, strOffsetPort, true); // pPortName
            dv.setUint32(pPrinterEnum + 8, 0, true);            // Attributes
            dv.setUint32(pPrinterEnum + 12, 0, true);           // DeviceNotSelectedTimeout
            dv.setUint32(pPrinterEnum + 16, 0, true);           // TransmissionRetryTimeout
          } else {
            dv.setUint32(pPrinterEnum + 0, strOffsetName, true); // pPrinterName
            dv.setUint32(pPrinterEnum + 4, 0, true);             // pServerName
            dv.setUint32(pPrinterEnum + 8, 0, true);             // Attributes
          }

          if (pcReturned) {
            dv.setUint32(pcReturned, 1, true);
          }
          return 1;
        },
        EnumPrinters: (...args: any[]) => (win32Imports as any).EnumPrintersA(...args),

        OpenPrinterA: (_pPrinterName: number, phPrinter: number, _pDefault: number) => {
          if (this.memory && phPrinter) {
            new DataView(this.memory.buffer).setUint32(phPrinter, ++this.nextGdiHandle, true);
          }
          return 1;
        },
        OpenPrinter: (...args: any[]) => (win32Imports as any).OpenPrinterA(...args),

        ClosePrinter: (_hPrinter: number) => 1,
        PrinterProperties: (_hWnd: number, _hPrinter: number) => 1,

        PrintDlgA: (lppd: number) => {
          if (!this.memory || !lppd) return 1;
          const dv = new DataView(this.memory.buffer);
          const flags = dv.getUint32(lppd + 20, true);
          if ((flags & 0x00000100 /* PD_RETURNDC */) || (flags & 0x00000200 /* PD_RETURNIC */)) {
            const printerHdc = (win32Imports as any).CreateDCA();
            dv.setUint32(lppd + 16, printerHdc, true);
          }
          return 1;
        },
        PrintDlg: (...args: any[]) => (win32Imports as any).PrintDlgA(...args),

        StartDocA: (_hdcHandle: number, _lpdi: number) => 1,
        StartDoc: (...args: any[]) => (win32Imports as any).StartDocA(...args),

        StartPage: (_hdcHandle: number) => 1,
        EndPage: (_hdcHandle: number) => 1,
        EndDoc: (_hdcHandle: number) => 1,
        AbortDoc: (_hdcHandle: number) => 1,
        SetAbortProc: (_hdcHandle: number, _lpAbortProc: number) => 1,

        // --- Chapter 14: Bitmaps & Bitblts ---
        BitBlt: (
          hdcDestHandle: number,
          xDest: number,
          yDest: number,
          wDest: number,
          hDest: number,
          hdcSrcHandle: number,
          xSrc: number,
          ySrc: number,
          _rop: number
        ) => {
          const hdcDest = this.hdcMap.get(hdcDestHandle);
          const hdcSrc = this.hdcMap.get(hdcSrcHandle);
          if (hdcDest?.ctx && hdcSrc?.canvas) {
            try {
              hdcDest.ctx.drawImage(
                hdcSrc.canvas,
                xSrc, ySrc, wDest, hDest,
                xDest, yDest, wDest, hDest
              );
            } catch {
              // ignore
            }
          }
          return 1;
        },

        StretchBlt: (
          hdcDestHandle: number,
          xDest: number,
          yDest: number,
          wDest: number,
          hDest: number,
          hdcSrcHandle: number,
          xSrc: number,
          ySrc: number,
          wSrc: number,
          hSrc: number,
          _rop: number
        ) => {
          const hdcDest = this.hdcMap.get(hdcDestHandle);
          const hdcSrc = this.hdcMap.get(hdcSrcHandle);
          if (hdcDest?.ctx && hdcSrc?.canvas) {
            try {
              hdcDest.ctx.drawImage(
                hdcSrc.canvas,
                xSrc, ySrc, wSrc, hSrc,
                xDest, yDest, wDest, hDest
              );
            } catch {
              // ignore
            }
          }
          return 1;
        },

        PatBlt: (
          hdcHandle: number,
          x: number,
          y: number,
          w: number,
          h: number,
          rop: number
        ) => {
          const hdc = this.hdcMap.get(hdcHandle);
          if (hdc?.ctx) {
            hdc.ctx.save();
            let fillStyle = hdc.currentBrush?.color || "#000000";
            if (rop === 0x00000042 /* WHITENESS */) {
              fillStyle = "#ffffff";
            } else if (rop === 0x00000062 /* BLACKNESS */) {
              fillStyle = "#000000";
            } else if (rop === 0x00550009 /* DSTINVERT */) {
              hdc.ctx.globalCompositeOperation = "difference";
              fillStyle = "#ffffff";
            }
            hdc.ctx.fillStyle = fillStyle;
            hdc.ctx.fillRect(x, y, w, h);
            hdc.ctx.restore();
          }
          if ((hdc as any)?.svgRecorder) {
            (hdc as any).svgRecorder.recordRectangle(x, y, x + w, y + h);
          }
          return 1;
        },

        CreateCompatibleDC: (hdcHandle: number) => {
          const srcHdc = this.hdcMap.get(hdcHandle);
          const width = srcHdc?.canvas?.width || 800;
          const height = srcHdc?.canvas?.height || 600;
          let canvas: any = null;
          let ctx: any = null;
          if (typeof document !== "undefined") {
            canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            ctx = canvas.getContext("2d");
          }
          const handle = ++this.nextHdcHandle;
          const memHdc = new HDC(0 as any, canvas, ctx);
          this.hdcMap.set(handle, memHdc);
          return handle;
        },

        CreateCompatibleBitmap: (_hdcHandle: number, cx: number, cy: number) => {
          const handle = ++this.nextGdiHandle;
          let canvas: any = null;
          let ctx: any = null;
          if (typeof document !== "undefined") {
            canvas = document.createElement("canvas");
            canvas.width = cx || 1;
            canvas.height = cy || 1;
            ctx = canvas.getContext("2d");
          }
          this.gdiMap.set(handle, {
            type: "bitmap",
            width: cx,
            height: cy,
            canvas,
            ctx,
          });
          return handle;
        },

        CreateBitmap: (nWidth: number, nHeight: number, nPlanes: number, nBitCount: number, _lpBits: number) => {
          const handle = ++this.nextGdiHandle;
          this.gdiMap.set(handle, {
            type: "bitmap",
            width: nWidth,
            height: nHeight,
            planes: nPlanes,
            bitsPixel: nBitCount,
          });
          return handle;
        },

        CreateBitmapIndirect: (pbm: number) => {
          const handle = ++this.nextGdiHandle;
          let width = 64;
          let height = 64;
          if (this.memory && pbm) {
            const view = new DataView(this.memory.buffer);
            width = view.getInt32(pbm + 4, true) || 64;
            height = view.getInt32(pbm + 8, true) || 64;
          }
          this.gdiMap.set(handle, {
            type: "bitmap",
            width,
            height,
          });
          return handle;
        },

        GetWindowDC: (hWnd: number) => (win32Imports as any).GetDC(hWnd),
        GetDCEx: (hWnd: number, _hrgnClip: number, _flags: number) => (win32Imports as any).GetDC(hWnd),

        LoadBitmapA: (_hInstance: number, _lpBitmapName: number) => {
          const handle = ++this.nextGdiHandle;
          let canvas: any = null;
          let ctx: any = null;
          if (typeof document !== "undefined") {
            canvas = document.createElement("canvas");
            canvas.width = 32;
            canvas.height = 32;
            ctx = canvas.getContext("2d");
          }
          this.gdiMap.set(handle, { type: "bitmap", width: 32, height: 32, canvas, ctx });
          return handle;
        },
        LoadBitmap: (...args: any[]) => (win32Imports as any).LoadBitmapA(...args),

        CreateHatchBrush: (_iHatch: number, color: number) => (win32Imports as any).CreateSolidBrush(color),
        CreatePatternBrush: (_hbm: number) => (win32Imports as any).CreateSolidBrush(0x008080),

        SetStretchBltMode: (_hdcHandle: number, _mode: number) => 1,
        GetStretchBltMode: (_hdcHandle: number) => 1,

        LockWindowUpdate: (_hWndLock: number) => 1,
        GetDesktopWindow: () => 0,

        EnumDisplaySettingsA: (_lpszDeviceName: number, iModeNum: number, lpDevMode: number) => {
          if (iModeNum > 0 || !this.memory || !lpDevMode) return 0;
          const dv = new DataView(this.memory.buffer);
          dv.setUint32(lpDevMode + 108, 1024, true); // dmPelsWidth
          dv.setUint32(lpDevMode + 112, 768, true);  // dmPelsHeight
          return 1;
        },
        EnumDisplaySettings: (...args: any[]) => (win32Imports as any).EnumDisplaySettingsA(...args),

        GetTextExtentPoint32A: (hdcHandle: number, _lpString: number, c: number, lpsz: number) => {
          if (this.memory && lpsz) {
            const hdc = this.hdcMap.get(hdcHandle);
            const fontObj = (hdc as any)?.selectedFont;
            const height = fontObj && Math.abs(fontObj.height) ? Math.abs(fontObj.height) : 16;
            const charWidth = Math.round(height * 0.5) || 8;
            const count = c > 0 ? c : 1;
            const dv = new DataView(this.memory.buffer);
            dv.setInt32(lpsz + 0, count * charWidth, true); // cx
            dv.setInt32(lpsz + 4, height, true);            // cy
          }
          return 1;
        },
        GetTextExtentPoint32W: (hdcHandle: number, _lpString: number, c: number, lpsz: number) => {
          if (this.memory && lpsz) {
            const hdc = this.hdcMap.get(hdcHandle);
            const fontObj = (hdc as any)?.selectedFont;
            const height = fontObj && Math.abs(fontObj.height) ? Math.abs(fontObj.height) : 16;
            const charWidth = Math.round(height * 0.5) || 8;
            const count = c > 0 ? c : 1;
            const dv = new DataView(this.memory.buffer);
            dv.setInt32(lpsz + 0, count * charWidth, true); // cx
            dv.setInt32(lpsz + 4, height, true);            // cy
          }
          return 1;
        },
        GetTextExtentPoint32: (...args: any[]) => (win32Imports as any).GetTextExtentPoint32A(...args),

        LoadLibraryA: (_lpLibFileName: number) => 0x1000,
        LoadLibraryW: (_lpLibFileName: number) => 0x1000,
        LoadLibrary: (...args: any[]) => (win32Imports as any).LoadLibraryA(...args),
        FreeLibrary: (_hModule: number) => 1,
        GetProcAddress: (_hModule: number, _lpProcName: number) => 0,

        GetTickCount: () => Date.now() & 0xffffffff,

        GetMenuItemInfoA: (
          _hMenu: number,
          _item: number,
          _fByPosition: number,
          lpmii: number
        ) => {
          if (this.memory && lpmii) {
            const dv = new DataView(this.memory.buffer);
            dv.setUint32(lpmii + 20, 0, true); // hSubMenu
            dv.setUint32(lpmii + 36, ++this.nextGdiHandle, true); // dwTypeData
          }
          return 1;
        },
        GetMenuItemInfo: (...args: any[]) => (win32Imports as any).GetMenuItemInfoA(...args),

        // --- Chapter 15: Device-Independent Bitmaps (DIBs) ---
        SetDIBitsToDevice: (
          hdcHandle: number,
          xDest: number,
          yDest: number,
          w: number,
          h: number,
          xSrc: number,
          ySrc: number,
          uStartScan: number,
          cScanLines: number,
          lpvBits: number,
          lpbmi: number,
          _fuColorUse: number
        ) => {
          const hdc = this.hdcMap.get(hdcHandle);
          if (!hdc || !hdc.ctx || !this.memory) return 0;
          const view = new DataView(this.memory.buffer);
          const info = parseDibInfo(view, lpbmi);

          if (cScanLines >= info.height && uStartScan === 0) {
            const canvas = renderDibToCanvas(this.memory.buffer, lpbmi, lpvBits);
            if (canvas) {
              hdc.ctx.drawImage(canvas, xSrc, ySrc, w, h, xDest, yDest, w, h);
            }
          } else {
            // Partial scan lines (e.g. SeqDisp line-by-line)
            const rowBytes = Math.floor(((info.width * info.bitCount + 31) & ~31) / 8);
            const canvas = document.createElement("canvas");
            canvas.width = Math.max(1, info.width);
            canvas.height = Math.max(1, cScanLines);
            const ctx = canvas.getContext("2d");
            if (ctx) {
              const imgData = ctx.createImageData(info.width, cScanLines);
              const dst = imgData.data;
              const isCore = info.biSize === 12;
              const paletteEntrySize = isCore ? 3 : 4;
              const paletteU8 = new Uint8Array(this.memory.buffer, info.palettePtr, info.numColors * paletteEntrySize);
              const srcU8 = new Uint8Array(this.memory.buffer);

              for (let line = 0; line < cScanLines; line++) {
                const srcRowOffset = lpvBits + line * rowBytes;
                const dstRowOffset = line * (info.width * 4);
                if (info.bitCount === 8) {
                  for (let x = 0; x < info.width; x++) {
                    const palEntry = srcU8[srcRowOffset + x];
                    const palIdx = palEntry * paletteEntrySize;
                    const dstIdx = dstRowOffset + x * 4;
                    dst[dstIdx + 0] = paletteU8[palIdx + 2];
                    dst[dstIdx + 1] = paletteU8[palIdx + 1];
                    dst[dstIdx + 2] = paletteU8[palIdx + 0];
                    dst[dstIdx + 3] = 255;
                  }
                } else if (info.bitCount === 24) {
                  for (let x = 0; x < info.width; x++) {
                    const sIdx = srcRowOffset + x * 3;
                    const dIdx = dstRowOffset + x * 4;
                    dst[dIdx + 0] = srcU8[sIdx + 2];
                    dst[dIdx + 1] = srcU8[sIdx + 1];
                    dst[dIdx + 2] = srcU8[sIdx + 0];
                    dst[dIdx + 3] = 255;
                  }
                }
              }
              ctx.putImageData(imgData, 0, 0);
              const targetY = yDest + (info.isTopDown ? uStartScan : (info.height - 1 - uStartScan)) - ySrc;
              hdc.ctx.drawImage(canvas, xDest, targetY);
            }
          }
          return cScanLines;
        },

        StretchDIBits: (
          hdcHandle: number,
          xDest: number,
          yDest: number,
          DestWidth: number,
          DestHeight: number,
          xSrc: number,
          ySrc: number,
          SrcWidth: number,
          SrcHeight: number,
          lpBits: number,
          lpbmi: number,
          _iUsage: number,
          _rop: number
        ) => {
          const hdc = this.hdcMap.get(hdcHandle);
          if (!hdc || !hdc.ctx || !this.memory) return 0;
          const canvas = renderDibToCanvas(this.memory.buffer, lpbmi, lpBits);
          if (canvas) {
            hdc.ctx.drawImage(
              canvas,
              xSrc,
              ySrc,
              SrcWidth,
              SrcHeight,
              xDest,
              yDest,
              DestWidth,
              DestHeight
            );
          }
          return DestHeight;
        },

        CreateDIBSection: (
          _hdcHandle: number,
          pbmiPtr: number,
          _usage: number,
          ppvBitsPtr: number,
          _hSection: number,
          _offset: number
        ) => {
          if (!this.memory) return 0;
          const view = new DataView(this.memory.buffer);
          const info = parseDibInfo(view, pbmiPtr);
          const rowBytes = Math.floor(((info.width * info.bitCount + 31) & ~31) / 8);
          const totalBytes = rowBytes * info.height;

          const pBits = this.allocateMemory(totalBytes);
          if (ppvBitsPtr) {
            view.setUint32(ppvBitsPtr, pBits, true);
          }

          const hBitmap = ++this.nextGdiHandle;
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, info.width);
          canvas.height = Math.max(1, info.height);
          this.gdiMap.set(hBitmap, {
            type: "DIBSECTION",
            width: info.width,
            height: info.height,
            bitCount: info.bitCount,
            rowBytes,
            pBits,
            pbmiPtr,
            canvas,
            ctx: canvas.getContext("2d"),
          });
          return hBitmap;
        },

        CreateDIBitmap: (
          _hdcHandle: number,
          pbmihPtr: number,
          fdwInit: number,
          lpbInit: number,
          lpbmi: number,
          _fuUsage: number
        ) => {
          if (!this.memory) return 0;
          const view = new DataView(this.memory.buffer);
          const info = parseDibInfo(view, lpbmi || pbmihPtr);
          let canvas: HTMLCanvasElement | null = null;
          if ((fdwInit & 4) && lpbInit) {
            canvas = renderDibToCanvas(this.memory.buffer, lpbmi || pbmihPtr, lpbInit);
          }
          if (!canvas) {
            canvas = document.createElement("canvas");
            canvas.width = Math.max(1, info.width || 100);
            canvas.height = Math.max(1, info.height || 100);
          }
          const hBitmap = ++this.nextGdiHandle;
          this.gdiMap.set(hBitmap, {
            type: "bitmap",
            width: canvas.width,
            height: canvas.height,
            canvas,
            ctx: canvas.getContext("2d"),
          });
          return hBitmap;
        },

        SetDIBits: (
          _hdc: number,
          hbm: number,
          _start: number,
          cLines: number,
          lpBits: number,
          lpbmi: number,
          _ColorUse: number
        ) => {
          const obj = this.gdiMap.get(hbm);
          if (obj && obj.ctx && this.memory) {
            const canvas = renderDibToCanvas(this.memory.buffer, lpbmi, lpBits);
            if (canvas) {
              obj.ctx.drawImage(canvas, 0, 0);
            }
          }
          return cLines;
        },

        GetDIBits: (
          _hdc: number,
          _hbm: number,
          _start: number,
          cLines: number,
          _lpBits: number,
          _lpbmi: number,
          _usage: number
        ) => cLines,

        SetFilePointer: (
          hFile: number,
          lDistanceToMove: number,
          _lpDistanceToMoveHigh: number,
          dwMoveMethod: number
        ) => {
          const file = this.openFileMap.get(hFile);
          if (!file) return -1;
          if (dwMoveMethod === 0) { // FILE_BEGIN
            file.position = lDistanceToMove;
          } else if (dwMoveMethod === 1) { // FILE_CURRENT
            file.position += lDistanceToMove;
          } else if (dwMoveMethod === 2) { // FILE_END
            file.position = file.data.byteLength + lDistanceToMove;
          }
          return file.position;
        },

        DeleteFileA: (_lpFileName: number) => 1,
        DeleteFile: (...args: any[]) => (win32Imports as any).DeleteFileA(...args),

        // --- Chapter 16: The Palette Manager ---
        CreatePalette: (plp: number) => {
          const handle = ++this.nextGdiHandle;
          const entries: { r: number; g: number; b: number; flags: number }[] = [];
          if (this.memory && plp) {
            const view = new DataView(this.memory.buffer);
            const count = view.getUint16(plp + 2, true);
            for (let i = 0; i < count; i++) {
              const offset = plp + 4 + i * 4;
              entries.push({
                r: view.getUint8(offset + 0),
                g: view.getUint8(offset + 1),
                b: view.getUint8(offset + 2),
                flags: view.getUint8(offset + 3),
              });
            }
          }
          this.gdiMap.set(handle, { type: "palette", entries });
          return handle;
        },

        CreateHalftonePalette: (_hdc: number) => {
          const handle = ++this.nextGdiHandle;
          const entries: { r: number; g: number; b: number; flags: number }[] = [];
          for (let i = 0; i < 256; i++) {
            entries.push({ r: i, g: i, b: i, flags: 0 });
          }
          this.gdiMap.set(handle, { type: "palette", entries });
          return handle;
        },

        SelectPalette: (hdcHandle: number, hpal: number, _bForceBkgd: number) => {
          const hdc = this.hdcMap.get(hdcHandle);
          if (hdc) {
            const prev = (hdc as any).hPalette || 0;
            (hdc as any).hPalette = hpal;
            return prev || hpal;
          }
          return hpal;
        },

        RealizePalette: (hdcHandle: number) => {
          const hdc = this.hdcMap.get(hdcHandle);
          const pal = hdc ? this.gdiMap.get((hdc as any).hPalette) : null;
          return pal && pal.entries ? pal.entries.length : 256;
        },

        GetSystemPaletteEntries: (
          _hdc: number,
          iStart: number,
          cEntries: number,
          ppe: number
        ) => {
          if (!this.memory || !ppe) return 0;
          const view = new DataView(this.memory.buffer);
          const count = Math.min(cEntries, 256 - iStart);
          for (let i = 0; i < count; i++) {
            const idx = iStart + i;
            const offset = ppe + i * 4;
            view.setUint8(offset + 0, idx);
            view.setUint8(offset + 1, idx);
            view.setUint8(offset + 2, idx);
            view.setUint8(offset + 3, 0);
          }
          return count;
        },

        GetPaletteEntries: (
          hpal: number,
          iStart: number,
          cEntries: number,
          ppe: number
        ) => {
          if (!this.memory || !ppe) return 0;
          const pal = this.gdiMap.get(hpal);
          const entries = pal?.entries || [];
          const count = Math.min(cEntries, Math.max(0, entries.length - iStart));
          const view = new DataView(this.memory.buffer);
          for (let i = 0; i < count; i++) {
            const e = entries[iStart + i] || { r: 0, g: 0, b: 0, flags: 0 };
            const offset = ppe + i * 4;
            view.setUint8(offset + 0, e.r);
            view.setUint8(offset + 1, e.g);
            view.setUint8(offset + 2, e.b);
            view.setUint8(offset + 3, e.flags);
          }
          return count;
        },

        SetPaletteEntries: (
          hpal: number,
          iStart: number,
          cEntries: number,
          ppe: number
        ) => {
          if (!this.memory || !ppe) return 0;
          const pal = this.gdiMap.get(hpal);
          if (!pal || !pal.entries) return 0;
          const view = new DataView(this.memory.buffer);
          for (let i = 0; i < cEntries; i++) {
            const offset = ppe + i * 4;
            pal.entries[iStart + i] = {
              r: view.getUint8(offset + 0),
              g: view.getUint8(offset + 1),
              b: view.getUint8(offset + 2),
              flags: view.getUint8(offset + 3),
            };
          }
          return cEntries;
        },

        AnimatePalette: (
          hpal: number,
          iStart: number,
          cEntries: number,
          ppe: number
        ) => {
          if (!this.memory || !ppe) return 0;
          const pal = this.gdiMap.get(hpal);
          if (!pal || !pal.entries) return 0;
          const view = new DataView(this.memory.buffer);
          for (let i = 0; i < cEntries; i++) {
            const offset = ppe + i * 4;
            pal.entries[iStart + i] = {
              r: view.getUint8(offset + 0),
              g: view.getUint8(offset + 1),
              b: view.getUint8(offset + 2),
              flags: view.getUint8(offset + 3),
            };
          }
          return 1;
        },

        UpdateColors: (_hdc: number) => 1,

        GetNearestPaletteIndex: (_hpal: number, cr: number) => {
          return (cr & 0xff);
        },

        GetDIBColorTable: (
          _hdcHandle: number,
          iStart: number,
          cEntries: number,
          prgb: number
        ) => {
          if (!this.memory || !prgb) return 0;
          const view = new DataView(this.memory.buffer);
          for (let i = 0; i < cEntries; i++) {
            const offset = prgb + i * 4;
            const val = iStart + i;
            view.setUint8(offset + 0, val);
            view.setUint8(offset + 1, val);
            view.setUint8(offset + 2, val);
            view.setUint8(offset + 3, 0);
          }
          return cEntries;
        },

        SetDIBColorTable: (
          _hdc: number,
          _iStart: number,
          cEntries: number,
          _prgb: number
        ) => cEntries,

        SetBrushOrgEx: (
          _hdc: number,
          _x: number,
          _y: number,
          lppt: number
        ) => {
          if (lppt && this.memory) {
            const view = new DataView(this.memory.buffer);
            view.setInt32(lppt + 0, 0, true);
            view.setInt32(lppt + 4, 0, true);
          }
          return 1;
        },

        // --- Chapter 17: Text, Fonts, Paths, and Advanced GDI ---

        ExtCreatePen: (
          iPenStyle: number,
          cWidth: number,
          plbrush: number,
          _cStyle: number,
          _pstyle: number
        ) => {
          let color = "#000000";
          if (this.memory && plbrush) {
            const dv = new DataView(this.memory.buffer);
            const lbColor = dv.getUint32(plbrush + 4, true);
            color = this.colorRefToRgb(lbColor);
          }
          let lineCap: CanvasLineCap = "round";
          const endcap = iPenStyle & 0x00000f00;
          if (endcap === 0x00000100) lineCap = "square";
          else if (endcap === 0x00000200) lineCap = "butt";

          let lineJoin: CanvasLineJoin = "round";
          const join = iPenStyle & 0x0000f000;
          if (join === 0x00001000) lineJoin = "bevel";
          else if (join === 0x00002000) lineJoin = "miter";

          const pen = {
            type: "pen" as const,
            style: iPenStyle,
            width: cWidth,
            color,
            lineCap,
            lineJoin,
          };
          const handle = ++this.nextGdiHandle;
          this.gdiMap.set(handle, pen);
          return handle;
        },

        BeginPath: (hdcHandle: number) => {
          const hdc = this.hdcMap.get(hdcHandle);
          if (hdc) {
            (hdc as any).pathActive = true;
            (hdc as any).pathText = [];
            hdc.ctx?.beginPath();
          }
          return 1;
        },

        EndPath: (hdcHandle: number) => {
          const hdc = this.hdcMap.get(hdcHandle);
          if (hdc) {
            (hdc as any).pathActive = false;
          }
          return 1;
        },

        StrokePath: (hdcHandle: number) => {
          const hdc = this.hdcMap.get(hdcHandle);
          if (hdc?.ctx) {
            hdc.ctx.save();
            if (hdc.currentPen) {
              hdc.ctx.strokeStyle = hdc.currentPen.color || "#000000";
              hdc.ctx.lineWidth = hdc.currentPen.width || 1;
              if ((hdc.currentPen as any).lineCap) hdc.ctx.lineCap = (hdc.currentPen as any).lineCap;
              if ((hdc.currentPen as any).lineJoin) hdc.ctx.lineJoin = (hdc.currentPen as any).lineJoin;
            }
            hdc.ctx.stroke();
            if ((hdc as any).pathText) {
              for (const item of (hdc as any).pathText) {
                hdc.ctx.save();
                const fontObj = (hdc as any).selectedFont;
                if (fontObj) {
                  const fontStyle = fontObj.italic ? "italic " : "";
                  const fontWeight = fontObj.weight >= 700 ? "bold " : "";
                  const fontSize = Math.abs(fontObj.height) || 12;
                  hdc.ctx.font = `${fontStyle}${fontWeight}${fontSize}px "${fontObj.faceName || "MS Sans Serif"}", sans-serif`;
                }
                hdc.ctx.strokeStyle = hdc.currentPen?.color || "#000000";
                hdc.ctx.lineWidth = hdc.currentPen?.width || 1;
                hdc.ctx.strokeText(item.text, item.x, item.y);
                hdc.ctx.restore();
              }
              (hdc as any).pathText = [];
            }
            hdc.ctx.restore();
          }
          return 1;
        },

        FillPath: (hdcHandle: number) => {
          const hdc = this.hdcMap.get(hdcHandle);
          if (hdc?.ctx) {
            hdc.ctx.save();
            if (hdc.currentBrush) {
              hdc.ctx.fillStyle = hdc.currentBrush.color || "#000000";
            }
            hdc.ctx.fill();
            if ((hdc as any).pathText) {
              for (const item of (hdc as any).pathText) {
                hdc.ctx.save();
                const fontObj = (hdc as any).selectedFont;
                if (fontObj) {
                  const fontStyle = fontObj.italic ? "italic " : "";
                  const fontWeight = fontObj.weight >= 700 ? "bold " : "";
                  const fontSize = Math.abs(fontObj.height) || 12;
                  hdc.ctx.font = `${fontStyle}${fontWeight}${fontSize}px "${fontObj.faceName || "MS Sans Serif"}", sans-serif`;
                }
                hdc.ctx.fillStyle = hdc.currentBrush?.color || "#000000";
                hdc.ctx.fillText(item.text, item.x, item.y);
                hdc.ctx.restore();
              }
              (hdc as any).pathText = [];
            }
            hdc.ctx.restore();
          }
          return 1;
        },

        StrokeAndFillPath: (hdcHandle: number) => {
          const hdc = this.hdcMap.get(hdcHandle);
          if (hdc?.ctx) {
            hdc.ctx.save();
            if (hdc.currentBrush) {
              hdc.ctx.fillStyle = hdc.currentBrush.color || "#000000";
            }
            hdc.ctx.fill();
            if (hdc.currentPen) {
              hdc.ctx.strokeStyle = hdc.currentPen.color || "#000000";
              hdc.ctx.lineWidth = hdc.currentPen.width || 1;
              if ((hdc.currentPen as any).lineCap) hdc.ctx.lineCap = (hdc.currentPen as any).lineCap;
              if ((hdc.currentPen as any).lineJoin) hdc.ctx.lineJoin = (hdc.currentPen as any).lineJoin;
            }
            hdc.ctx.stroke();
            if ((hdc as any).pathText) {
              for (const item of (hdc as any).pathText) {
                hdc.ctx.save();
                const fontObj = (hdc as any).selectedFont;
                if (fontObj) {
                  const fontStyle = fontObj.italic ? "italic " : "";
                  const fontWeight = fontObj.weight >= 700 ? "bold " : "";
                  const fontSize = Math.abs(fontObj.height) || 12;
                  hdc.ctx.font = `${fontStyle}${fontWeight}${fontSize}px "${fontObj.faceName || "MS Sans Serif"}", sans-serif`;
                }
                hdc.ctx.fillStyle = hdc.currentBrush?.color || "#000000";
                hdc.ctx.fillText(item.text, item.x, item.y);
                hdc.ctx.strokeStyle = hdc.currentPen?.color || "#000000";
                hdc.ctx.lineWidth = hdc.currentPen?.width || 1;
                hdc.ctx.strokeText(item.text, item.x, item.y);
                hdc.ctx.restore();
              }
              (hdc as any).pathText = [];
            }
            hdc.ctx.restore();
          }
          return 1;
        },

        SelectClipPath: (hdcHandle: number, _iMode: number) => {
          const hdc = this.hdcMap.get(hdcHandle);
          if (hdc?.ctx) {
            hdc.ctx.clip();
          }
          return 1;
        },

        SetGraphicsMode: (hdcHandle: number, iMode: number) => {
          const hdc = this.hdcMap.get(hdcHandle);
          const old = (hdc as any)?.graphicsMode || 1;
          if (hdc) (hdc as any).graphicsMode = iMode;
          return old;
        },

        ModifyWorldTransform: (hdcHandle: number, lpXform: number, iMode: number) => {
          const hdc = this.hdcMap.get(hdcHandle);
          if (!hdc?.ctx) return 1;
          if (iMode === 1 || !lpXform) {
            hdc.ctx.resetTransform ? hdc.ctx.resetTransform() : hdc.ctx.setTransform(1, 0, 0, 1, 0, 0);
          } else if (this.memory && lpXform) {
            const dv = new DataView(this.memory.buffer);
            const eM11 = dv.getFloat32(lpXform + 0, true);
            const eM12 = dv.getFloat32(lpXform + 4, true);
            const eM21 = dv.getFloat32(lpXform + 8, true);
            const eM22 = dv.getFloat32(lpXform + 12, true);
            const eDx = dv.getFloat32(lpXform + 16, true);
            const eDy = dv.getFloat32(lpXform + 20, true);
            hdc.ctx.transform(eM11, eM12, eM21, eM22, eDx, eDy);
          }
          return 1;
        },

        SetWorldTransform: (hdcHandle: number, lpXform: number) => {
          const hdc = this.hdcMap.get(hdcHandle);
          if (hdc?.ctx && this.memory && lpXform) {
            const dv = new DataView(this.memory.buffer);
            const eM11 = dv.getFloat32(lpXform + 0, true);
            const eM12 = dv.getFloat32(lpXform + 4, true);
            const eM21 = dv.getFloat32(lpXform + 8, true);
            const eM22 = dv.getFloat32(lpXform + 12, true);
            const eDx = dv.getFloat32(lpXform + 16, true);
            const eDy = dv.getFloat32(lpXform + 20, true);
            hdc.ctx.setTransform(eM11, eM12, eM21, eM22, eDx, eDy);
          }
          return 1;
        },

        GetWorldTransform: (_hdcHandle: number, lpXform: number) => {
          if (this.memory && lpXform) {
            const dv = new DataView(this.memory.buffer);
            dv.setFloat32(lpXform + 0, 1.0, true);
            dv.setFloat32(lpXform + 4, 0.0, true);
            dv.setFloat32(lpXform + 8, 0.0, true);
            dv.setFloat32(lpXform + 12, 1.0, true);
            dv.setFloat32(lpXform + 16, 0.0, true);
            dv.setFloat32(lpXform + 20, 0.0, true);
          }
          return 1;
        },

        SetTextJustification: (hdcHandle: number, nBreakExtra: number, nBreakCount: number) => {
          const hdc = this.hdcMap.get(hdcHandle);
          if (hdc) {
            (hdc as any).breakExtra = nBreakExtra;
            (hdc as any).breakCount = nBreakCount;
          }
          return 1;
        },

        GetCurrentObject: (hdcHandle: number, uObjectType: number) => {
          const hdc = this.hdcMap.get(hdcHandle);
          if (hdc) {
            if (uObjectType === 6) return (hdc as any).selectedFontHandle || 10;
            if (uObjectType === 1) return (hdc as any).selectedPenHandle || 6;
            if (uObjectType === 2) return (hdc as any).selectedBrushHandle || 0;
            if (uObjectType === 7) return (hdc as any).selectedBitmapHandle || 0;
          }
          return 0;
        },

        GetOutlineTextMetricsA: (_hdcHandle: number, _cjCopy: number, potm: number) => {
          if (!this.memory || !potm) return 204;
          const view = new DataView(this.memory.buffer);
          view.setUint32(potm + 0, 204, true);  // otmSize
          view.setInt32(potm + 4, 16, true);    // tmHeight
          view.setInt32(potm + 8, 13, true);    // tmAscent
          view.setInt32(potm + 12, 3, true);    // tmDescent
          view.setUint32(potm + 92, 2048, true);// otmEMSquare
          view.setInt32(potm + 96, 1854, true); // otmAscent
          view.setInt32(potm + 100, -434, true);// otmDescent
          view.setUint32(potm + 104, 0, true);  // otmLineGap
          view.setUint32(potm + 108, 1456, true);// otmsCapEmHeight
          view.setUint32(potm + 112, 1062, true);// otmsXHeight
          return 204;
        },
        GetOutlineTextMetrics: (...args: any[]) => (win32Imports as any).GetOutlineTextMetricsA(...args),

        GetCharWidthA: (_hdcHandle: number, uFirst: number, uLast: number, piWidths: number) => {
          if (!this.memory || !piWidths || uLast < uFirst) return 0;
          const dv = new DataView(this.memory.buffer);
          const count = uLast - uFirst + 1;
          for (let i = 0; i < count; i++) {
            const ch = uFirst + i;
            let width = 1000;
            if (ch === 32) width = 500;
            else if (ch === 105 || ch === 108 || ch === 106 || ch === 46 || ch === 44 || ch === 58 || ch === 59 || ch === 33) width = 500;
            else if (ch === 109 || ch === 119 || ch === 77 || ch === 87) width = 1600;
            else if (ch >= 65 && ch <= 90) width = 1200;
            dv.setInt32(piWidths + i * 4, width, true);
          }
          return 1;
        },
        GetCharWidth: (...args: any[]) => (win32Imports as any).GetCharWidthA(...args),

        SetMapperFlags: (hdcHandle: number, flags: number) => {
          const hdc = this.hdcMap.get(hdcHandle);
          const old = (hdc as any)?.mapperFlags || 0;
          if (hdc) (hdc as any).mapperFlags = flags;
          return old;
        },

        TextOutW: (hdcHandle: number, x: number, y: number, lpString: number, c: number) => {
          const hdc = this.hdcMap.get(hdcHandle);
          if (!hdc || !this.memory || !lpString) return 0;
          const dv = new DataView(this.memory.buffer);
          let str = "";
          const len = c >= 0 ? c : 0;
          for (let i = 0; i < len; i++) {
            str += String.fromCharCode(dv.getUint16(lpString + i * 2, true));
          }
          if ((hdc as any).pathActive) {
            if (!(hdc as any).pathText) (hdc as any).pathText = [];
            (hdc as any).pathText.push({ text: str, x, y });
            return 1;
          }
          return TextOut(hdc, x, y, str) ? 1 : 0;
        },

        // --- Chapter 18: Metafiles and Enhanced Metafiles (EMF) ---

        CreateMetaFileA: (lpFilename: number) => {
          const name = lpFilename ? this.readCString(lpFilename) : null;
          const canvas = typeof document !== "undefined" ? document.createElement("canvas") : ({} as any);
          canvas.width = 1000;
          canvas.height = 1000;
          const ctx = canvas.getContext ? canvas.getContext("2d") : null;
          const hdc = new HDC(0 as any, canvas, ctx as any);
          (hdc as any).isMetafile = true;
          (hdc as any).metafileName = name;
          (hdc as any).svgRecorder = new MetafileSvgRecorder("metafile", name);
          const handle = ++this.nextHdcHandle;
          this.hdcMap.set(handle, hdc);
          return handle;
        },
        CreateMetaFile: (...args: any[]) => (win32Imports as any).CreateMetaFileA(...args),

        CloseMetaFile: (hdcHandle: number) => {
          const hdc = this.hdcMap.get(hdcHandle);
          const handle = ++this.nextGdiHandle;
          const recorder = (hdc as any)?.svgRecorder as MetafileSvgRecorder | undefined;
          const metafile = recorder ? recorder.close() : new SvgMetafile("metafile", undefined, undefined, (hdc as any)?.metafileName);
          const hmfObj = {
            type: "metafile",
            canvas: metafile.canvas,
            ctx: metafile.ctx,
            name: (hdc as any)?.metafileName,
            bounds: metafile.bounds,
            metafile,
            toSvg: (w?: number, h?: number) => metafile.toSvg(w, h),
          };
          this.gdiMap.set(handle, hmfObj);
          this.metafileMap.set(handle, hmfObj);
          if (hmfObj.name) {
            Win32WasmRuntime.sharedEmfFiles.set(this.normalizeMetafileName(hmfObj.name), hmfObj);
          }
          this.hdcMap.delete(hdcHandle);
          return handle;
        },

        PlayMetaFile: (hdcHandle: number, hmfHandle: number) => {
          const hdc = this.hdcMap.get(hdcHandle);
          const hmf = this.metafileMap.get(hmfHandle) || this.gdiMap.get(hmfHandle);
          if (hdc?.ctx && hmf) {
            const wExtX = (hdc as any).windowExtX;
            const wExtY = (hdc as any).windowExtY;
            const vExtX = (hdc as any).viewportExtX;
            const vExtY = (hdc as any).viewportExtY;
            const wOrgX = (hdc as any).windowOrgX || 0;
            const wOrgY = (hdc as any).windowOrgY || 0;
            const vOrgX = (hdc as any).viewportOrgX || 0;
            const vOrgY = (hdc as any).viewportOrgY || 0;

            let destRect: MetafileBounds | undefined;
            if (wExtX && wExtY && vExtX && vExtY) {
              const b = hmf.bounds || hmf.metafile?.bounds || { left: 0, top: 0, right: 100, bottom: 100 };
              const left = Math.round(((b.left - wOrgX) * vExtX) / wExtX + vOrgX);
              const top = Math.round(((b.top - wOrgY) * vExtY) / wExtY + vOrgY);
              const right = Math.round(((b.right - wOrgX) * vExtX) / wExtX + vOrgX);
              const bottom = Math.round(((b.bottom - wOrgY) * vExtY) / wExtY + vOrgY);
              destRect = { left, top, right, bottom };
            }

            if (hmf.metafile) {
              hmf.metafile.renderToCanvas(hdc.ctx, destRect);
            } else if (hmf.canvas) {
              if (destRect) {
                hdc.ctx.drawImage(
                  hmf.canvas,
                  destRect.left,
                  destRect.top,
                  destRect.right - destRect.left,
                  destRect.bottom - destRect.top
                );
              } else {
                hdc.ctx.drawImage(hmf.canvas, 0, 0);
              }
            }
          }
          return 1;
        },

        DeleteMetaFile: (hmfHandle: number) => {
          this.metafileMap.delete(hmfHandle);
          this.gdiMap.delete(hmfHandle);
          return 1;
        },

        CreateEnhMetaFileA: (
          _hdcRefHandle: number,
          lpFilename: number,
          lpRect: number,
          lpDescription: number
        ) => {
          const name = lpFilename ? this.readCString(lpFilename) : null;
          const desc = lpDescription ? this.readCString(lpDescription) : null;
          let bounds: MetafileBounds = { left: 0, top: 0, right: 1024, bottom: 768 };
          if (lpRect && this.memory) {
            const dv = new DataView(this.memory.buffer);
            bounds = {
              left: dv.getInt32(lpRect + 0, true),
              top: dv.getInt32(lpRect + 4, true),
              right: dv.getInt32(lpRect + 8, true),
              bottom: dv.getInt32(lpRect + 12, true),
            };
          }
          const canvas = typeof document !== "undefined" ? document.createElement("canvas") : ({} as any);
          canvas.width = Math.max(1, Math.abs(bounds.right - bounds.left)) || 1024;
          canvas.height = Math.max(1, Math.abs(bounds.bottom - bounds.top)) || 768;
          const ctx = canvas.getContext ? canvas.getContext("2d") : null;
          const hdc = new HDC(0 as any, canvas, ctx as any);
          (hdc as any).isEnhMetafile = true;
          (hdc as any).emfName = name;
          (hdc as any).emfDescription = desc;
          (hdc as any).svgRecorder = new MetafileSvgRecorder("enhmetafile", name, desc, bounds);
          const handle = ++this.nextHdcHandle;
          this.hdcMap.set(handle, hdc);
          return handle;
        },
        CreateEnhMetaFile: (...args: any[]) => (win32Imports as any).CreateEnhMetaFileA(...args),

        CloseEnhMetaFile: (hdcHandle: number) => {
          const hdc = this.hdcMap.get(hdcHandle);
          const handle = ++this.nextGdiHandle;
          const recorder = (hdc as any)?.svgRecorder as MetafileSvgRecorder | undefined;
          const metafile = recorder ? recorder.close() : new SvgMetafile("enhmetafile", undefined, undefined, (hdc as any)?.emfName, (hdc as any)?.emfDescription);
          const hemfObj = {
            type: "enhmetafile",
            canvas: metafile.canvas,
            ctx: metafile.ctx,
            name: (hdc as any)?.emfName,
            description: (hdc as any)?.emfDescription,
            bounds: metafile.bounds,
            frame: metafile.frame,
            metafile,
            toSvg: (w?: number, h?: number) => metafile.toSvg(w, h),
          };
          this.gdiMap.set(handle, hemfObj);
          this.metafileMap.set(handle, hemfObj);
          if (hemfObj.name) {
            Win32WasmRuntime.sharedEmfFiles.set(this.normalizeMetafileName(hemfObj.name), hemfObj);
          }
          this.hdcMap.delete(hdcHandle);
          return handle;
        },

        PlayEnhMetaFile: (hdcHandle: number, hemfHandle: number, lpRect: number) => {
          const hdc = this.hdcMap.get(hdcHandle);
          const hemf = this.metafileMap.get(hemfHandle) || this.gdiMap.get(hemfHandle);
          if (hdc?.ctx && hemf) {
            let destRect: MetafileBounds | undefined;
            if (lpRect && this.memory) {
              const dv = new DataView(this.memory.buffer);
              const left = dv.getInt32(lpRect + 0, true);
              const top = dv.getInt32(lpRect + 4, true);
              const right = dv.getInt32(lpRect + 8, true);
              const bottom = dv.getInt32(lpRect + 12, true);
              destRect = { left, top, right, bottom };
            }
            if (destRect && (destRect.right <= destRect.left || destRect.bottom <= destRect.top)) {
              const canvas = hdc.canvas;
              if (canvas && canvas.width > 0 && canvas.height > 0) {
                destRect = { left: 0, top: 0, right: canvas.width, bottom: canvas.height };
              } else {
                destRect = undefined;
              }
            }
            if (hemf.metafile) {
              hemf.metafile.renderToCanvas(hdc.ctx, destRect);
            } else if (hemf.canvas) {
              if (destRect) {
                hdc.ctx.drawImage(hemf.canvas, destRect.left, destRect.top, destRect.right - destRect.left, destRect.bottom - destRect.top);
              } else {
                hdc.ctx.drawImage(hemf.canvas, 0, 0);
              }
            }
          }
          return 1;
        },

        DeleteEnhMetaFile: (hemfHandle: number) => {
          this.metafileMap.delete(hemfHandle);
          this.gdiMap.delete(hemfHandle);
          return 1;
        },

        GetEnhMetaFileA: (lpFilename: number) => {
          const name = lpFilename ? this.readCString(lpFilename) : "";
          const norm = this.normalizeMetafileName(name);
          let hemf = Win32WasmRuntime.sharedEmfFiles.get(norm);
          if (!hemf) {
            hemf = this.createSampleEmf(norm);
            Win32WasmRuntime.sharedEmfFiles.set(norm, hemf);
          }
          const handle = ++this.nextGdiHandle;
          this.gdiMap.set(handle, hemf);
          this.metafileMap.set(handle, hemf);
          return handle;
        },
        GetEnhMetaFile: (...args: any[]) => (win32Imports as any).GetEnhMetaFileA(...args),

        GetEnhMetaFileHeader: (hemfHandle: number, _cbBuffer: number, lpemh: number) => {
          if (!this.memory || !lpemh) return 108;
          const hemf = this.metafileMap.get(hemfHandle) || this.gdiMap.get(hemfHandle);
          const dv = new DataView(this.memory.buffer);
          dv.setUint32(lpemh + 0, 1, true); // iType: EMR_HEADER
          dv.setUint32(lpemh + 4, 108, true); // nSize: 108
          const b = hemf?.bounds || hemf?.metafile?.bounds || { left: 0, top: 0, right: 600, bottom: 200 };
          dv.setInt32(lpemh + 8, b.left, true);
          dv.setInt32(lpemh + 12, b.top, true);
          dv.setInt32(lpemh + 16, b.right, true);
          dv.setInt32(lpemh + 20, b.bottom, true);
          const f = hemf?.frame || hemf?.metafile?.frame || { left: 0, top: 0, right: 15240, bottom: 5080 };
          dv.setInt32(lpemh + 24, f.left, true);
          dv.setInt32(lpemh + 28, f.top, true);
          dv.setInt32(lpemh + 32, f.right, true);
          dv.setInt32(lpemh + 36, f.bottom, true);
          dv.setUint32(lpemh + 40, 0x464d4520, true); // ENHMETA_SIGNATURE
          dv.setUint32(lpemh + 44, 0x00010000, true);
          dv.setUint32(lpemh + 48, 4096, true);
          dv.setUint32(lpemh + 52, 10, true);
          dv.setUint16(lpemh + 56, 5, true);
          dv.setUint16(lpemh + 58, 0, true);
          dv.setUint32(lpemh + 60, 0, true);
          dv.setUint32(lpemh + 64, 0, true);
          dv.setUint32(lpemh + 68, 0, true);
          dv.setInt32(lpemh + 72, 1024, true);
          dv.setInt32(lpemh + 76, 768, true);
          dv.setInt32(lpemh + 80, 320, true);
          dv.setInt32(lpemh + 84, 240, true);
          return 108;
        },

        GetEnhMetaFileDescriptionA: (
          hemfHandle: number,
          cchBuffer: number,
          lpDescription: number
        ) => {
          const hemf = this.metafileMap.get(hemfHandle) || this.gdiMap.get(hemfHandle);
          const desc = hemf?.description || hemf?.metafile?.description || "EMF Demo\0Charles Petzold\0";
          if (!lpDescription || cchBuffer === 0) return desc.length;
          if (this.memory) {
            const bytes = new TextEncoder().encode(desc);
            const heap = new Uint8Array(this.memory.buffer);
            const toWrite = Math.min(bytes.length, cchBuffer - 1);
            heap.set(bytes.subarray(0, toWrite), lpDescription);
            heap[lpDescription + toWrite] = 0;
            return toWrite;
          }
          return 0;
        },
        GetEnhMetaFileDescription: (...args: any[]) =>
          (win32Imports as any).GetEnhMetaFileDescriptionA(...args),

        GetEnhMetaFilePaletteEntries: (
          _hemfHandle: number,
          _cEntries: number,
          _ppe: number
        ) => 0,

        CopyEnhMetaFileA: (hemfSrcHandle: number, lpFilename: number) => {
          const src = this.metafileMap.get(hemfSrcHandle) || this.gdiMap.get(hemfSrcHandle);
          const handle = ++this.nextGdiHandle;
          const copy = { ...src, name: lpFilename ? this.readCString(lpFilename) : null };
          this.gdiMap.set(handle, copy);
          this.metafileMap.set(handle, copy);
          return handle;
        },
        CopyEnhMetaFile: (...args: any[]) => (win32Imports as any).CopyEnhMetaFileA(...args),

        EnumEnhMetaFile: (
          hdcHandle: number,
          hemfHandle: number,
          lpEnhMetaFunc: number,
          lpData: number,
          _lpRect: number
        ) => {
          if (!this.table) return 1;
          const fn = this.table.get(lpEnhMetaFunc);
          if (typeof fn !== "function") return 1;

          const hemf = this.metafileMap.get(hemfHandle) || this.gdiMap.get(hemfHandle);
          const rawBytes: Uint8Array | undefined = hemf?.metafile?.rawBytes;

          if (rawBytes && rawBytes.byteLength >= 8) {
            const dv = new DataView(rawBytes.buffer, rawBytes.byteOffset, rawBytes.byteLength);
            const handleTableBuf = this.allocateMemory(256);
            let off = 0;
            while (off + 8 <= rawBytes.byteLength) {
              const recType = dv.getUint32(off + 0, true);
              const recSize = dv.getUint32(off + 4, true);
              if (recSize < 8 || off + recSize > rawBytes.byteLength) break;

              const recordBuf = this.allocateMemory(recSize);
              if (this.memory) {
                new Uint8Array(this.memory.buffer).set(
                  rawBytes.subarray(off, off + recSize),
                  recordBuf
                );
              }
              const cont = fn(hdcHandle, handleTableBuf, recordBuf, 1, lpData);
              if (!cont || recType === 14 /* EMR_EOF */) break;
              off += recSize;
            }
            return 1;
          }

          const recordBuf = this.allocateMemory(64);
          const handleTableBuf = this.allocateMemory(32);
          const dv = new DataView(this.memory!.buffer);

          // Record 1: EMR_HEADER (1)
          dv.setUint32(recordBuf + 0, 1, true); // iType
          dv.setUint32(recordBuf + 4, 32, true); // nSize
          let cont = fn(hdcHandle, handleTableBuf, recordBuf, 1, lpData);
          if (!cont) return 1;

          // Record 2: EMR_RECTANGLE (43)
          dv.setUint32(recordBuf + 0, 43, true); // iType
          dv.setUint32(recordBuf + 4, 24, true); // nSize
          dv.setInt32(recordBuf + 8, 100, true); // left
          dv.setInt32(recordBuf + 12, 100, true); // top
          dv.setInt32(recordBuf + 16, 200, true); // right
          dv.setInt32(recordBuf + 20, 200, true); // bottom
          cont = fn(hdcHandle, handleTableBuf, recordBuf, 1, lpData);
          if (!cont) return 1;

          // Record 3: EMR_EOF (14)
          dv.setUint32(recordBuf + 0, 14, true); // iType
          dv.setUint32(recordBuf + 4, 20, true); // nSize
          fn(hdcHandle, handleTableBuf, recordBuf, 1, lpData);
          return 1;
        },

        PlayEnhMetaFileRecord: (
          hdcHandle: number,
          _lpht: number,
          lpmr: number,
          _cht: number
        ) => {
          if (!this.memory || !lpmr) return 1;
          const dv = new DataView(this.memory.buffer);
          const iType = dv.getUint32(lpmr + 0, true);
          const hdc = this.hdcMap.get(hdcHandle);
          if (!hdc) return 1;

          if (iType === 43 /* EMR_RECTANGLE */) {
            const left = dv.getInt32(lpmr + 8, true);
            const top = dv.getInt32(lpmr + 12, true);
            const right = dv.getInt32(lpmr + 16, true);
            const bottom = dv.getInt32(lpmr + 20, true);
            Rectangle(hdc, left, top, right, bottom);
          } else if (iType === 42 /* EMR_ELLIPSE */) {
            const left = dv.getInt32(lpmr + 8, true);
            const top = dv.getInt32(lpmr + 12, true);
            const right = dv.getInt32(lpmr + 16, true);
            const bottom = dv.getInt32(lpmr + 20, true);
            Ellipse(hdc, left, top, right, bottom);
          } else if (iType === 27 /* EMR_MOVETOEX */) {
            const x = dv.getInt32(lpmr + 8, true);
            const y = dv.getInt32(lpmr + 12, true);
            MoveToEx(hdc, x, y);
          } else if (iType === 54 /* EMR_LINETO */) {
            const x = dv.getInt32(lpmr + 8, true);
            const y = dv.getInt32(lpmr + 12, true);
            LineTo(hdc, x, y);
          } else if (iType === 24 /* EMR_SETTEXTCOLOR */) {
            const crColor = dv.getUint32(lpmr + 8, true);
            SetTextColor(hdc, this.colorRefToRgb(crColor));
          } else if (iType === 84 /* EMR_EXTTEXTOUTW */ || iType === 83 /* EMR_EXTTEXTOUTA */) {
            const x = dv.getInt32(lpmr + 36, true);
            const y = dv.getInt32(lpmr + 40, true);
            const cChars = dv.getUint32(lpmr + 44, true);
            const offString = dv.getUint32(lpmr + 48, true);
            if (cChars > 0 && offString > 0) {
              const strStart = lpmr + offString;
              let text = "";
              if (iType === 84) {
                const chars: string[] = [];
                for (let i = 0; i < cChars; i++) {
                  chars.push(String.fromCharCode(dv.getUint16(strStart + i * 2, true)));
                }
                text = chars.join("");
              } else {
                const bytes = new Uint8Array(this.memory.buffer, strStart, cChars);
                text = new TextDecoder().decode(bytes);
              }
              TextOut(hdc, x, y, text);
            }
          }
          return 1;
        },

        CreateEventA: (
          _lpEventAttributes: number,
          bManualReset: number,
          bInitialState: number,
          _lpName: number
        ) => {
          const handle = ++this.nextEventHandle;
          this.eventMap.set(handle, {
            manualReset: bManualReset !== 0,
            signaled: bInitialState !== 0,
          });
          return handle;
        },

        SetEvent: (hEvent: number) => {
          const ev = this.eventMap.get(hEvent);
          if (ev) {
            ev.signaled = true;
            this.notifyEventWaiters(hEvent);
            return 1;
          }
          return 0;
        },

        ResetEvent: (hEvent: number) => {
          const ev = this.eventMap.get(hEvent);
          if (ev) {
            ev.signaled = false;
            return 1;
          }
          return 0;
        },

        PulseEvent: (hEvent: number) => {
          const ev = this.eventMap.get(hEvent);
          if (ev) {
            ev.signaled = true;
            this.notifyEventWaiters(hEvent);
            ev.signaled = false;
            return 1;
          }
          return 0;
        },

        WaitForSingleObject: (hHandle: number, _dwMilliseconds: number) => {
          const ev = this.eventMap.get(hHandle);
          if (ev) {
            if (ev.signaled) {
              if (!ev.manualReset) {
                ev.signaled = false;
              }
              return 0; // WAIT_OBJECT_0
            }
            return 0x00000102; // WAIT_TIMEOUT
          }
          return 0;
        },

        _beginthread: (startAddress: number, _stackSize: number, argList: number) => {
          const threadId = ++this.nextThreadId;
          logWasmStub("_beginthread", startAddress, _stackSize, argList);
          if (!this.table) return threadId;
          const fn = this.table.get(startAddress);
          if (typeof fn === "function") {
            const threadInfo = {
              fnIdx: startAddress,
              arg: argList,
              active: true,
              iterationCount: 0,
            };
            this.activeThreads.set(threadId, threadInfo);
            const runThread = () => {
              if (!threadInfo.active) return;
              this.currentThreadInfo = threadInfo;
              try {
                fn(argList);
              } catch (e: any) {
                if (e && e.isThreadYield) {
                  if (threadInfo.active) {
                    (threadInfo as any).timerId = setTimeout(runThread, 30);
                  }
                } else {
                  console.error("Thread execution error:", e);
                }
              } finally {
                this.currentThreadInfo = null;
              }
            };
            (threadInfo as any).timerId = setTimeout(runThread, 10);
          }
          return threadId;
        },

        _endthread: () => {
          logWasmStub("_endthread");
        },

        _wasm_thread_step: () => {
          return 0;
        },

        // ====================================================================
        // Chapter 22 & 23: Multimedia, Winsock & WinINet
        // ====================================================================
        waveOutOpen: (phwo: number, uDeviceID: number, pwfx: number, dwCallback: number, dwInstance: number, fdwOpen: number) => {
          logWasmStub("waveOutOpen", phwo, uDeviceID);
          if (this.memory && phwo) {
            new DataView(this.memory.buffer).setUint32(phwo, 1, true);
          }
          return 0;
        },
        waveOutClose: (hwo: number) => {
          logWasmStub("waveOutClose", hwo);
          return 0;
        },
        waveOutPrepareHeader: (hwo: number, pwh: number, cbwh: number) => {
          if (this.memory && pwh) {
            const view = new DataView(this.memory.buffer);
            const flags = view.getUint32(pwh + 16, true);
            view.setUint32(pwh + 16, flags | 2 /* WHDR_PREPARED */, true);
          }
          return 0;
        },
        waveOutUnprepareHeader: (hwo: number, pwh: number, cbwh: number) => {
          if (this.memory && pwh) {
            const view = new DataView(this.memory.buffer);
            const flags = view.getUint32(pwh + 16, true);
            view.setUint32(pwh + 16, flags & ~2, true);
          }
          return 0;
        },
        waveOutWrite: (hwo: number, pwh: number, cbwh: number) => {
          if (this.memory && pwh) {
            const view = new DataView(this.memory.buffer);
            const flags = view.getUint32(pwh + 16, true);
            view.setUint32(pwh + 16, flags | 1 /* WHDR_DONE */, true);
          }
          return 0;
        },
        waveOutPause: (hwo: number) => 0,
        waveOutRestart: (hwo: number) => 0,
        waveOutReset: (hwo: number) => 0,

        waveInOpen: (phwi: number, uDeviceID: number, pwfx: number, dwCallback: number, dwInstance: number, fdwOpen: number) => {
          logWasmStub("waveInOpen", phwi, uDeviceID);
          if (this.memory && phwi) {
            new DataView(this.memory.buffer).setUint32(phwi, 1, true);
          }
          return 0;
        },
        waveInClose: (hwi: number) => 0,
        waveInPrepareHeader: (hwi: number, pwh: number, cbwh: number) => {
          if (this.memory && pwh) {
            const view = new DataView(this.memory.buffer);
            const flags = view.getUint32(pwh + 16, true);
            view.setUint32(pwh + 16, flags | 2 /* WHDR_PREPARED */, true);
          }
          return 0;
        },
        waveInUnprepareHeader: (hwi: number, pwh: number, cbwh: number) => {
          if (this.memory && pwh) {
            const view = new DataView(this.memory.buffer);
            const flags = view.getUint32(pwh + 16, true);
            view.setUint32(pwh + 16, flags & ~2, true);
          }
          return 0;
        },
        waveInAddBuffer: (hwi: number, pwh: number, cbwh: number) => 0,
        waveInStart: (hwi: number) => 0,
        waveInStop: (hwi: number) => 0,
        waveInReset: (hwi: number) => 0,

        midiOutOpen: (phmo: number, uDeviceID: number, dwCallback: number, dwInstance: number, fdwOpen: number) => {
          logWasmStub("midiOutOpen", phmo, uDeviceID);
          if (this.memory && phmo) {
            new DataView(this.memory.buffer).setUint32(phmo, 1, true);
          }
          return 0;
        },
        midiOutClose: (hmo: number) => 0,
        midiOutReset: (hmo: number) => 0,
        midiOutShortMsg: (hmo: number, dwMsg: number) => 0,
        midiOutGetNumDevs: () => 1,
        midiOutGetDevCapsA: (uDeviceID: number, pmoc: number, cbmoc: number) => {
          if (pmoc && this.memory) {
            this.writeCString(pmoc + 8, "WASM MIDI Synth", 32);
          }
          return 0;
        },
        midiOutGetDevCapsW: (uDeviceID: number, pmoc: number, cbmoc: number) => 0,

        timeGetTime: () => Math.floor(performance.now()),
        timeGetDevCaps: (ptc: number, cbtc: number) => {
          if (ptc && this.memory) {
            const view = new DataView(this.memory.buffer);
            view.setUint32(ptc, 1, true);
            view.setUint32(ptc + 4, 1000, true);
          }
          return 0;
        },
        timeBeginPeriod: (uPeriod: number) => 0,
        timeEndPeriod: (uPeriod: number) => 0,
        timeSetEvent: (uDelay: number, uResolution: number, lpTimeProc: number, dwUser: number, fuEvent: number) => {
          const timerId = ++this.nextTimerId;
          if (this.table && lpTimeProc) {
            const fn = this.table.get(lpTimeProc);
            if (typeof fn === "function") {
              const timer = setInterval(() => {
                try {
                  fn(timerId, 0, dwUser, 0, 0);
                } catch {
                  clearInterval(timer);
                }
              }, Math.max(uDelay, 15));
              this.timerMap.set(timerId, timer as any);
            }
          }
          return timerId;
        },
        timeKillEvent: (uTimerID: number) => {
          if (this.timerMap.has(uTimerID)) {
            clearInterval(this.timerMap.get(uTimerID));
            this.timerMap.delete(uTimerID);
          }
          return 0;
        },

        mmioOpenA: (szFilename: number, lpmmioinfo: number, fdwOpen: number) => 1,
        mmioClose: (hmmio: number, fuClose: number) => 0,
        mmioCreateChunk: (hmmio: number, pmmcki: number, fuCreate: number) => 0,
        mmioAscend: (hmmio: number, pmmcki: number, fuAscend: number) => 0,
        mmioDescend: (hmmio: number, pmmcki: number, pmmckiParent: number, fuDescend: number) => 0,
        mmioRead: (hmmio: number, pch: number, cch: number) => cch,
        mmioWrite: (hmmio: number, pch: number, cch: number) => cch,
        mmioStringToFOURCCA: (sz: number, uFlags: number) => {
          const str = this.readCString(sz);
          const c0 = (str.charCodeAt(0) || 0) & 0xff;
          const c1 = (str.charCodeAt(1) || 0) & 0xff;
          const c2 = (str.charCodeAt(2) || 0) & 0xff;
          const c3 = (str.charCodeAt(3) || 0) & 0xff;
          return c0 | (c1 << 8) | (c2 << 16) | (c3 << 24);
        },

        mciSendStringA: (lpstrCommand: number, lpstrReturnString: number, uReturnLength: number, hwndCallback: number) => 0,
        mciGetErrorStringA: (mcierr: number, pszText: number, cchText: number) => {
          if (pszText && cchText > 0) {
            this.writeCString(pszText, "No error", cchText);
          }
          return 1;
        },
        mciSendCommandA: (mciId: number, uMsg: number, dwParam1: number, dwParam2: number) => {
          if (uMsg === 0x0803 /* MCI_OPEN */ && dwParam2 && this.memory) {
            new DataView(this.memory.buffer).setUint16(dwParam2 + 4, 1, true); // wDeviceID
          }
          return 0;
        },

        WSAStartup: (wVersionRequired: number, lpWSAData: number) => {
          logWasmStub("WSAStartup", wVersionRequired, lpWSAData);
          if (lpWSAData && this.memory) {
            const view = new DataView(this.memory.buffer);
            view.setUint16(lpWSAData, wVersionRequired, true);
            view.setUint16(lpWSAData + 2, wVersionRequired, true);
            this.writeCString(lpWSAData + 4, "WASM Winsock 2.0", 256);
            this.writeCString(lpWSAData + 261, "Running", 128);
            view.setUint16(lpWSAData + 390, 32, true);
            view.setUint16(lpWSAData + 392, 1024, true);
          }
          return 0;
        },
        WSACleanup: () => 0,
        WSAGetLastError: () => 0,
        socket: (af: number, type: number, protocol: number) => 100,
        closesocket: (s: number) => 0,
        connect: (s: number, name: number, namelen: number) => 0,
        send: (s: number, buf: number, len: number, flags: number) => len,
        recv: (s: number, buf: number, len: number, flags: number) => {
          if (buf && this.memory && len >= 4) {
            const nowSec1900 = Math.floor(Date.now() / 1000) + 2208988800;
            new DataView(this.memory.buffer).setUint32(buf, nowSec1900, false); // network order (big endian)
            return 4;
          }
          return 0;
        },
        WSAAsyncSelect: (s: number, hWnd: number, wMsg: number, lEvent: number) => {
          setTimeout(() => {
            if (hWnd) {
              const lParam = 1; // FD_READ event, no error
              PostMessage(hWnd, wMsg, s, lParam);
            }
          }, 50);
          return 0;
        },
        inet_addr: (cp: number) => 0x0100007f, // 127.0.0.1
        htons: (val: number) => ((val & 0xff) << 8) | ((val >> 8) & 0xff),
        htonl: (val: number) => (((val & 0xff) << 24) | ((val & 0xff00) << 8) | ((val >> 8) & 0xff00) | ((val >> 24) & 0xff)) >>> 0,
        ntohs: (val: number) => ((val & 0xff) << 8) | ((val >> 8) & 0xff),
        ntohl: (val: number) => (((val & 0xff) << 24) | ((val & 0xff00) << 8) | ((val >> 8) & 0xff00) | ((val >> 24) & 0xff)) >>> 0,
        gethostbyname: (name: number) => 0,

        InternetOpenA: (lpszAgent: number, dwAccessType: number, lpszProxy: number, lpszProxyBypass: number, dwFlags: number) => 1,
        InternetConnectA: (hInternet: number, lpszServerName: number, nServerPort: number, lpszUserName: number, lpszPassword: number, dwService: number, dwFlags: number, dwContext: number) => 2,
        InternetCloseHandle: (hInternet: number) => 1,
        InternetReadFile: (hFile: number, lpBuffer: number, dwNumberOfBytesToRead: number, lpdwNumberOfBytesRead: number) => {
          if (lpdwNumberOfBytesRead && this.memory) {
            new DataView(this.memory.buffer).setUint32(lpdwNumberOfBytesRead, 0, true);
          }
          return 1;
        },
        FtpSetCurrentDirectoryA: (hConnect: number, lpszDirectory: number) => 1,
        FtpFindFirstFileA: (hConnect: number, lpszSearchFile: number, lpFindFileData: number, dwFlags: number, dwContext: number) => 0,
        InternetFindNextFileA: (hFind: number, lpvFindData: number) => 0,
        FtpOpenFileA: (hConnect: number, lpszFileName: number, dwAccess: number, dwFlags: number, dwContext: number) => 3,
        FtpGetFileA: (hConnect: number, lpszRemoteFile: number, lpszNewFile: number, fFailIfExists: number, dwFlagsAndAttributes: number, dwFlags: number, dwContext: number) => 1,

        FileTimeToSystemTime: (lpFileTime: number, lpSystemTime: number) => {
          if (!lpFileTime || !lpSystemTime || !this.memory) return 0;
          const view = new DataView(this.memory.buffer);
          const low = view.getUint32(lpFileTime, true);
          const high = view.getUint32(lpFileTime + 4, true);
          const fileTimeMs = (BigInt(high) << 32n | BigInt(low)) / 10000n - 11644473600000n;
          const d = new Date(Number(fileTimeMs));
          view.setUint16(lpSystemTime, d.getUTCFullYear(), true);
          view.setUint16(lpSystemTime + 2, d.getUTCMonth() + 1, true);
          view.setUint16(lpSystemTime + 4, d.getUTCDay(), true);
          view.setUint16(lpSystemTime + 6, d.getUTCDate(), true);
          view.setUint16(lpSystemTime + 8, d.getUTCHours(), true);
          view.setUint16(lpSystemTime + 10, d.getUTCMinutes(), true);
          view.setUint16(lpSystemTime + 12, d.getUTCSeconds(), true);
          view.setUint16(lpSystemTime + 14, d.getUTCMilliseconds(), true);
          return 1;
        },
        SetSystemTime: (lpSystemTime: number) => 1,
        GetDateFormatA: (Locale: number, dwFlags: number, lpDate: number, lpFormat: number, lpDateStr: number, cchDate: number) => {
          const str = new Date().toLocaleDateString();
          if (lpDateStr && cchDate > 0) {
            this.writeCString(lpDateStr, str, cchDate);
          }
          return str.length + 1;
        },
        GetTimeFormatA: (Locale: number, dwFlags: number, lpTime: number, lpFormat: number, lpTimeStr: number, cchTime: number) => {
          const str = new Date().toLocaleTimeString();
          if (lpTimeStr && cchTime > 0) {
            this.writeCString(lpTimeStr, str, cchTime);
          }
          return str.length + 1;
        },
        SetForegroundWindow: (hWnd: number) => 1,
        IsWindowEnabled: (hWnd: number) => 1,
        GetDriveTypeA: (lpRootPathName: number) => 3 /* DRIVE_FIXED */,
        GetLastError: () => 0,
        FindFirstFileA: (lpFileName: number, lpFindFileData: number) => 0,
        FindNextFileA: (hFindFile: number, lpFindFileData: number) => 0,
        FindClose: (hFindFile: number) => 1,
        GetCurrentPositionEx: (hdc: number, lppt: number) => {
          if (lppt && this.memory) {
            const info = this.hdcMap.get(hdc);
            const view = new DataView(this.memory.buffer);
            view.setInt32(lppt, info ? info.currentPoint.x : 0, true);
            view.setInt32(lppt + 4, info ? info.currentPoint.y : 0, true);
          }
          return 1;
        },
        SetWindowPos: (hWnd: number, hWndInsertAfter: number, X: number, Y: number, cx: number, cy: number, uFlags: number) => {
          kernel.MoveWindow(hWnd, X, Y, cx, cy, true);
          return 1;
        },
        AdjustWindowRect: (lpRect: number, dwStyle: number, bMenu: number) => 1,
        GetFileAttributesA: (lpFileName: number) => 0x80 /* FILE_ATTRIBUTE_NORMAL */,
        SystemTimeToFileTime: (lpSystemTime: number, lpFileTime: number) => 1,
        InitCommonControlsEx: (picce: number) => 1,
        InitCommonControls: () => {},
      };

    return {
      win32: win32Imports,
      env: win32Imports,
    };
  }

  public async instantiate(
    wasmSource: BufferSource | WebAssembly.Module
  ): Promise<WebAssembly.Instance> {
    const imports = this.getImportObject();
    let instance: WebAssembly.Instance;

    if (wasmSource instanceof WebAssembly.Module) {
      instance = await WebAssembly.instantiate(wasmSource, imports);
    } else {
      const res = await WebAssembly.instantiate(wasmSource, imports);
      instance = res.instance;
    }

    this.instance = instance;
    this.memory = instance.exports.memory as WebAssembly.Memory;
    this.table = instance.exports.__indirect_function_table as WebAssembly.Table;

    activeWasmRuntimes.add(this);

    return instance;
  }

  public destroy(): void {
    activeWasmRuntimes.delete(this);
    for (let i = systemClipboardViewers.length - 1; i >= 0; i--) {
      if (systemClipboardViewers[i].runtime === this) {
        systemClipboardViewers.splice(i, 1);
      }
    }
    this.hdcMap.clear();
    this.gdiMap.clear();
    this.comObjectMap.clear();
    this.registeredClasses.clear();
    this.globalAllocMap.clear();
    this.openFileMap.clear();
    this.poePoemPtr = 0;
    for (const [, t] of this.activeThreads) {
      t.active = false;
      if ((t as any).timerId) clearTimeout((t as any).timerId);
    }
    this.activeThreads.clear();
    for (const [, timer] of this.timerMap) {
      clearInterval(timer);
    }
    this.timerMap.clear();
    this.eventMap.clear();
  }

  public getStats(): WasmRuntimeStats {
    const memorySizeBytes = this.memory ? this.memory.buffer.byteLength : 0;
    const memoryPages = memorySizeBytes / 65536;
    const tableLength = this.table ? this.table.length : 0;
    const tableEntries: WasmTableEntryInfo[] = [];

    if (this.table) {
      for (let i = 0; i < Math.min(tableLength, 64); i++) {
        try {
          const item = this.table.get(i);
          tableEntries.push({
            index: i,
            isCallable: typeof item === "function",
          });
        } catch {
          tableEntries.push({
            index: i,
            isCallable: false,
          });
        }
      }
    }

    return {
      memorySizeBytes,
      memoryPages,
      tableLength,
      tableEntries,
      stringLogs: [...this.stringLogs],
      registeredWndProcIndices: [...this.registeredWndProcIndices],
      activeHdcCount: this.hdcMap.size,
      activeGdiObjectCount: this.gdiMap.size,
    };
  }

  public runWinMain(hInstance = 0, lpCmdLine = ""): number {
    if (!this.instance) {
      throw new Error("Wasm instance not instantiated yet");
    }

    const winMain = this.instance.exports.WinMain as Function;
    if (typeof winMain !== "function") {
      throw new Error("WASM module does not export WinMain function");
    }

    return winMain(hInstance, 0, 0, 5);
  }
}
