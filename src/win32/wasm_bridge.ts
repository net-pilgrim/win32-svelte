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
  private capturedHwnd: number | null = null;
  private cursorPos = { x: 100, y: 100 };
  private windowLongs = new Map<string, number>();
  private hdcRop2 = new Map<number, number>();
  private poePoemPtr = 0;

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
            if (!hWndParent || localWndProc) {
              win.customProps = {
                ...(win.customProps ?? {}),
                hasCanvas: true,
              };
            }
          }

          return hwnd;
        },

        ShowWindow: (hwnd: number, nCmdShow: number) => {
          ShowWindow(hwnd, nCmdShow);
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
          _lpMsg: number,
          _hWnd: number,
          _wMsgFilterMin: number,
          _wMsgFilterMax: number,
          _wRemoveMsg: number
        ) => {
          return 0;
        },

        SetCursor: (_hCursor: number) => 1,
        ShowCursor: (_bShow: number) => 1,

        TranslateMessage: (_lpMsg: number) => 0,

        DispatchMessageA: (_lpMsg: number) => 0,

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

        GetSystemMetrics: (nIndex: number): number => {
          switch (nIndex) {
            case 0: // SM_CXSCREEN
              return typeof window !== "undefined" ? window.innerWidth : 1024;
            case 1: // SM_CYSCREEN
              return typeof window !== "undefined" ? window.innerHeight : 768;
            case 2: // SM_CXVSCROLL
            case 3: // SM_CYHSCROLL
              return 16;
            case 4: // SM_CYCAPTION
              return 19;
            case 5: // SM_CXBORDER
            case 6: // SM_CYBORDER
              return 1;
            case 7: // SM_CXFIXEDFRAME
            case 8: // SM_CYFIXEDFRAME
              return 3;
            case 9: // SM_CYVTHUMB
            case 10: // SM_CXHTHUMB
              return 16;
            case 11: // SM_CXICON
            case 12: // SM_CYICON
            case 13: // SM_CXCURSOR
            case 14: // SM_CYCURSOR
              return 32;
            case 15: // SM_CYMENU
              return 19;
            case 16: // SM_CXFULLSCREEN
              return typeof window !== "undefined" ? window.innerWidth : 1024;
            case 17: // SM_CYFULLSCREEN
              return typeof window !== "undefined" ? window.innerHeight - 28 : 740;
            case 19: // SM_MOUSEPRESENT
              return 1;
            case 20: // SM_CYVSCROLL
            case 21: // SM_CXHSCROLL
              return 16;
            case 23: // SM_SWAPBUTTON
              return 0;
            case 28: // SM_CXMIN
            case 29: // SM_CYMIN
              return 100;
            case 30: // SM_CXSIZE
            case 31: // SM_CYSIZE
              return 16;
            case 32: // SM_CXSIZEFRAME
            case 33: // SM_CYSIZEFRAME
              return 4;
            case 43: // SM_CMOUSEBUTTONS
              return 2;
            case 45: // SM_CXEDGE
            case 46: // SM_CYEDGE
              return 2;
            case 49: // SM_CXSMICON
            case 50: // SM_CYSMICON
              return 16;
            case 51: // SM_CYSMCAPTION
              return 15;
            case 52: // SM_CXSMSIZE
            case 53: // SM_CYSMSIZE
              return 15;
            case 54: // SM_CXMENUSIZE
            case 55: // SM_CYMENUSIZE
              return 18;
            case 80: // SM_CMONITORS
              return 1;
            case 81: // SM_SAMEDISPLAYFORMAT
              return 1;
            default:
              return 0; // Standard stub fallback
          }
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
          return 1;
        },

        GetTextMetricsA: (_hdcHandle: number, lpTm: number) => {
          if (!this.memory || !lpTm) return 0;
          const view = new DataView(this.memory.buffer);
          view.setInt32(lpTm + 0, 16, true);  // tmHeight
          view.setInt32(lpTm + 4, 13, true);  // tmAscent
          view.setInt32(lpTm + 8, 3, true);   // tmDescent
          view.setInt32(lpTm + 12, 3, true);  // tmInternalLeading
          view.setInt32(lpTm + 16, 0, true);  // tmExternalLeading
          view.setInt32(lpTm + 20, 8, true);  // tmAveCharWidth
          view.setInt32(lpTm + 24, 16, true); // tmMaxCharWidth
          view.setInt32(lpTm + 28, 400, true);// tmWeight (FW_NORMAL)
          view.setInt32(lpTm + 32, 0, true);  // tmOverhang
          view.setInt32(lpTm + 36, 96, true); // tmDigitizedAspectX
          view.setInt32(lpTm + 40, 96, true); // tmDigitizedAspectY
          view.setUint8(lpTm + 44, 32);       // tmFirstChar
          view.setUint8(lpTm + 45, 126);      // tmLastChar
          view.setUint8(lpTm + 46, 32);       // tmDefaultChar
          view.setUint8(lpTm + 47, 32);       // tmBreakChar
          view.setUint8(lpTm + 48, 0);        // tmItalic
          view.setUint8(lpTm + 49, 0);        // tmUnderlined
          view.setUint8(lpTm + 50, 0);        // tmStruckOut
          view.setUint8(lpTm + 51, 1);        // tmPitchAndFamily (variable pitch)
          view.setUint8(lpTm + 52, 0);        // tmCharSet (ANSI_CHARSET)
          return 1;
        },

        GetTextFaceA: (_hdcHandle: number, c: number, lpName: number) => {
          if (this.memory && lpName && c > 0) {
            const face = "MS Sans Serif";
            const bytes = new TextEncoder().encode(face);
            const heap = new Uint8Array(this.memory.buffer);
            const toWrite = Math.min(bytes.length, c - 1);
            heap.set(bytes.subarray(0, toWrite), lpName);
            heap[lpName + toWrite] = 0;
            return toWrite;
          }
          return 0;
        },

        SetTextAlign: (_hdcHandle: number, _align: number) => {
          return 0; // Previous alignment TA_LEFT | TA_TOP
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
          return MoveToEx(hdc, x, y) ? 1 : 0;
        },

        GetDeviceCaps: (_hdcHandle: number, nIndex: number): number => {
          switch (nIndex) {
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
            case 40: // ASPECTX
            case 42: // ASPECTY
              return 36;
            case 44: // ASPECTXY
              return 51;
            case 88: // LOGPIXELSX
            case 90: // LOGPIXELSY
              return 96;
            default:
              return 1;
          }
        },

        SetMapMode: (_hdcHandle: number, _iMode: number) => 1,
        GetMapMode: (_hdcHandle: number) => 1,
        SetWindowExtEx: (_hdcHandle: number, _x: number, _y: number, _lpsz: number) => 1,
        SetViewportExtEx: (_hdcHandle: number, _x: number, _y: number, _lpsz: number) => 1,
        SetWindowOrgEx: (_hdcHandle: number, _x: number, _y: number, _lppt: number) => 1,
        SetViewportOrgEx: (_hdcHandle: number, _x: number, _y: number, _lppt: number) => 1,
        DPtoLP: (_hdcHandle: number, _lppt: number, _c: number) => 1,
        LPtoDP: (_hdcHandle: number, _lppt: number, _c: number) => 1,

        Polyline: (hdcHandle: number, apt: number, cpt: number) => {
          if (!this.memory || cpt <= 1) return 0;
          const hdc = this.hdcMap.get(hdcHandle);
          const ctx = hdc?.ctx;
          if (!ctx) return 1;

          const view = new DataView(this.memory.buffer);
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

        SetPolyFillMode: (_hdcHandle: number, _mode: number) => 1,
        CreateRectRgn: (_x1: number, _y1: number, _x2: number, _y2: number) => ++this.nextGdiHandle,
        CreateEllipticRgn: (_x1: number, _y1: number, _x2: number, _y2: number) => ++this.nextGdiHandle,
        CombineRgn: (_hrgnDest: number, _hrgnSrc1: number, _hrgnSrc2: number, _fnCombineMode: number) => 1,
        SelectClipRgn: (_hdcHandle: number, _hrgn: number) => 1,

        SaveDC: (hdcHandle: number) => {
          const hdc = this.hdcMap.get(hdcHandle);
          hdc?.ctx.save();
          return 1;
        },

        RestoreDC: (hdcHandle: number, _nSavedDC: number) => {
          const hdc = this.hdcMap.get(hdcHandle);
          hdc?.ctx.restore();
          return 1;
        },

        CreateCaret: (_hWnd: number, _hBitmap: number, _nWidth: number, _nHeight: number) => 1,
        SetCaretPos: (_x: number, _y: number) => 1,
        ShowCaret: (_hWnd: number) => 1,
        HideCaret: (_hWnd: number) => 1,
        DestroyCaret: () => 1,
        GetFocus: () => 1,

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

        CreateICA: () => {
          return ++this.nextHdcHandle;
        },
        CreateIC: () => (win32Imports as any).CreateICA(),

        CreateDCA: () => {
          return ++this.nextHdcHandle;
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
          return ++this.nextGdiHandle;
        },
        CreateFile: (...args: any[]) => (win32Imports as any).CreateFileA(...args),

        ReadFile: (
          _hFile: number,
          lpBuffer: number,
          nNumberOfBytesToRead: number,
          lpNumberOfBytesRead: number,
          _lpOverlapped: number
        ) => {
          const mockContent = "Programming Windows by Charles Petzold (5th Edition)\nSample File Output\n";
          const written = this.writeCString(lpBuffer, mockContent, nNumberOfBytesToRead);
          if (this.memory && lpNumberOfBytesRead) {
            const view = new DataView(this.memory.buffer);
            view.setUint32(lpNumberOfBytesRead, written, true);
          }
          return 1;
        },

        CloseHandle: (_hObject: number) => 1,

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

        IsClipboardFormatAvailable: (_format: number) => 1,

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

        CreateFontIndirectA: (_lplf: number) => ++this.nextGdiHandle,
        CreateFontIndirect: (...args: any[]) => (win32Imports as any).CreateFontIndirectA(...args),

        GetObjectA: (_hgdiobj: number, _cbBuffer: number, _lpvObject: number) => 0,
        GetObject: (...args: any[]) => (win32Imports as any).GetObjectA(...args),

        WriteFile: (
          _hFile: number,
          _lpBuffer: number,
          nNumberOfBytesToWrite: number,
          lpNumberOfBytesWritten: number,
          _lpOverlapped: number
        ) => {
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

        GetFileSize: (_hFile: number, _lpFileSizeHigh: number) => 1024,
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

        GetOpenFileNameA: (_lpofn: number) => 1,
        GetOpenFileName: (...args: any[]) => (win32Imports as any).GetOpenFileNameA(...args),

        GetSaveFileNameA: (_lpofn: number) => 1,
        GetSaveFileName: (...args: any[]) => (win32Imports as any).GetSaveFileNameA(...args),

        FindTextA: (_lpfr: number) => ++this.nextGdiHandle,
        FindText: (...args: any[]) => (win32Imports as any).FindTextA(...args),

        ReplaceTextA: (_lpfr: number) => ++this.nextGdiHandle,
        ReplaceText: (...args: any[]) => (win32Imports as any).ReplaceTextA(...args),
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
    this.poePoemPtr = 0;
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
