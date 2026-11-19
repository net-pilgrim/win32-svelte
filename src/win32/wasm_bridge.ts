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

  constructor() {}

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
    const win32Imports = {
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

          const hwnd = kernel.CreateWindowEx(
            dwExStyle,
            className,
            windowName,
            dwStyle,
            x,
            y,
            nWidth,
            nHeight,
            hWndParent === 0 ? null : hWndParent,
            hMenu === 0 ? null : hMenu,
            null,
            null,
            localWndProc
          );

          // For top-level C windows, attach canvas support for GDI drawing
          const win = kernel.getWindow(hwnd);
          if (win && !hWndParent) {
            win.customProps = {
              ...(win.customProps ?? {}),
              hasCanvas: true,
            };
          }

          return hwnd;
        },

        ShowWindow: (hwnd: number, nCmdShow: number) => {
          ShowWindow(hwnd, nCmdShow);
          return 1;
        },

        UpdateWindow: (_hwnd: number) => {
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

        PostQuitMessage: (nExitCode: number) => {
          PostQuitMessage(nExitCode);
        },

        SendMessageA: (
          hwnd: number,
          Msg: number,
          wParam: number,
          lParam: number
        ) => {
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
          const canvas = GetWindowCanvas(hwnd);
          const win = kernel.getWindow(hwnd);
          const w = canvas ? canvas.width : (win?.width ?? 0);
          const h = canvas ? canvas.height : (win?.height ?? 0);
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

        MessageBeep: (uType: number) => {
          MessageBeep(uType);
          return 1;
        },

        SetTimer: (
          hWnd: number,
          nIDEvent: number,
          uElapse: number,
          _lpTimerFunc: number
        ) => {
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
          return MoveToEx(hdc, x, y) ? 1 : 0;
        },

        LineTo: (hdcHandle: number, x: number, y: number) => {
          const hdc = this.hdcMap.get(hdcHandle);
          if (!hdc) return 0;
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
          return Ellipse(hdc, left, top, right, bottom) ? 1 : 0;
        },

        TextOutA: (
          hdcHandle: number,
          x: number,
          y: number,
          lpString: number,
          _c: number
        ) => {
          const hdc = this.hdcMap.get(hdcHandle);
          if (!hdc) return 0;
          const text = this.readCString(lpString);
          return TextOut(hdc, x, y, text) ? 1 : 0;
        },

        SetTextColor: (hdcHandle: number, color: number) => {
          const hdc = this.hdcMap.get(hdcHandle);
          if (!hdc) return 0;
          SetTextColor(hdc, this.colorRefToRgb(color));
          return color;
        },

        CreateSolidBrush: (color: number) => {
          const brush = CreateSolidBrush(this.colorRefToRgb(color));
          const handle = ++this.nextGdiHandle;
          this.gdiMap.set(handle, brush);
          return handle;
        },

        CreatePen: (iStyle: number, cWidth: number, color: number) => {
          const pen = CreatePen(iStyle, cWidth, this.colorRefToRgb(color));
          const handle = ++this.nextGdiHandle;
          this.gdiMap.set(handle, pen);
          return handle;
        },

        SelectObject: (hdcHandle: number, hObj: number) => {
          const hdc = this.hdcMap.get(hdcHandle);
          const obj = this.gdiMap.get(hObj);
          if (!hdc || !obj) return 0;
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
    this.hdcMap.clear();
    this.gdiMap.clear();
    this.comObjectMap.clear();
    this.registeredClasses.clear();
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
