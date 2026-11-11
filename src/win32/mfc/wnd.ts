import { CCmdTarget } from "./cmdtarget";
import type { HWND, HMENU, UINT, WPARAM, LPARAM, LRESULT, RECT, POINT, WndProc } from "../types";
import {
  CreateWindowEx,
  ShowWindow as Win32ShowWindow,
  DestroyWindow as Win32DestroyWindow,
  EnableWindow as Win32EnableWindow,
  SendMessage as Win32SendMessage,
  PostMessage as Win32PostMessage,
  DefWindowProc as Win32DefWindowProc,
  SetWindowText as Win32SetWindowText,
  GetWindowText as Win32GetWindowText,
  MoveWindow as Win32MoveWindow,
  SetTimer as Win32SetTimer,
  KillTimer as Win32KillTimer,
  MessageBox as Win32MessageBox,
  RegisterClassEx,
  kernel,
} from "../kernel.svelte";

import {
  WS_OVERLAPPEDWINDOW,
  WS_VISIBLE,
  SW_SHOW,
  MB_OK,
  WM_DESTROY,
  WM_PAINT,
} from "../constants";
import { AfxGetApp, AfxGetMainWnd } from "./app";
import { GetWindowCanvas } from "../gdi";

// Static mapping from HWND to CWnd instance
const handleMap = new Map<HWND, CWnd>();

export class CWnd extends CCmdTarget {
  public m_hWnd: HWND = 0;
  private m_defaultWndProc?: WndProc;

  public static getClassName(): string {
    return "CWnd";
  }

  public static fromHandle(hwnd: HWND): CWnd | undefined {
    return handleMap.get(hwnd);
  }

  public attach(hwnd: HWND): boolean {
    if (!hwnd || this.m_hWnd !== 0) return false;
    this.m_hWnd = hwnd;
    handleMap.set(hwnd, this);
    return true;
  }

  public detach(): HWND {
    const hwnd = this.m_hWnd;
    if (hwnd !== 0) {
      handleMap.delete(hwnd);
      this.m_hWnd = 0;
    }
    return hwnd;
  }

  public getSafeHwnd(): HWND {
    return this.m_hWnd;
  }

  /**
   * Common CWnd window procedure hook
   */
  public windowProc(uMsg: UINT, wParam: WPARAM, lParam: LPARAM): LRESULT {
    // 1. Give message map first priority
    const cmdResult = this.onCmdMsg(uMsg, wParam, lParam);
    if (cmdResult.handled) {
      return cmdResult.result;
    }

    // 2. Virtual OnWndMsg handler
    const wndMsgResult = this.onWndMsg(uMsg, wParam, lParam);
    if (wndMsgResult.handled) {
      return wndMsgResult.result;
    }

    // 3. Fall back to DefWindowProc
    return this.defWindowProc(uMsg, wParam, lParam);
  }

  protected onWndMsg(
    _uMsg: UINT,
    _wParam: WPARAM,
    _lParam: LPARAM
  ): { handled: boolean; result: LRESULT } {
    return { handled: false, result: 0 };
  }

  public defWindowProc(uMsg: UINT, wParam: WPARAM, lParam: LPARAM): LRESULT {
    return this.m_defaultWndProc?.(this.m_hWnd, uMsg, wParam, lParam) ??
      Win32DefWindowProc(this.m_hWnd, uMsg, wParam, lParam);
  }

  public create(
    className: string | null,
    windowName: string,
    dwStyle: number = WS_OVERLAPPEDWINDOW | WS_VISIBLE,
    x = 100,
    y = 100,
    nWidth = 320,
    nHeight = 240,
    pParentWnd: CWnd | null = null,
    nID: number | null = null,
    pParam: any = null
  ): boolean {
    return this.createEx(
      0,
      className,
      windowName,
      dwStyle,
      x,
      y,
      nWidth,
      nHeight,
      pParentWnd ? pParentWnd.m_hWnd : null,
      nID,
      pParam
    );
  }

  public createEx(
    dwExStyle: number,
    className: string | null,
    windowName: string,
    dwStyle: number,
    x = 100,
    y = 100,
    nWidth = 320,
    nHeight = 240,
    hwndParent: HWND | null = null,
    nIDorHMenu: number | null = null,
    lpParam: any = null
  ): boolean {
    if (this.m_hWnd) return false;
    const finalClassName = className || `MFC_Wnd_${this.getRuntimeClass()}`;

    this.m_defaultWndProc = kernel.getClassWndProc(finalClassName);
    if (!this.m_defaultWndProc) {
      RegisterClassEx({ className: finalClassName, lpfnWndProc: Win32DefWindowProc });
      this.m_defaultWndProc = Win32DefWindowProc;
    }

    const hwnd = CreateWindowEx(
      dwExStyle,
      finalClassName,
      windowName,
      dwStyle,
      x,
      y,
      nWidth,
      nHeight,
      hwndParent,
      nIDorHMenu,
      null,
      lpParam,
      (createdHwnd, uMsg, wParam, lParam) => {
        if (this.m_hWnd === 0) this.attach(createdHwnd);
        if (this.m_hWnd !== createdHwnd) {
          return this.m_defaultWndProc!(createdHwnd, uMsg, wParam, lParam);
        }
        try {
          return this.windowProc(uMsg, wParam, lParam);
        } finally {
          if (uMsg === WM_DESTROY) {
            if (AfxGetMainWnd() === this) AfxGetApp()?.onMainWindowDestroyed();
            this.detach();
          }
        }
      }
    );

    if (hwnd === 0) {
      this.detach();
      return false;
    }
    return true;
  }

  public showWindow(nCmdShow: number = SW_SHOW): boolean {
    if (!this.m_hWnd) return false;
    return Win32ShowWindow(this.m_hWnd, nCmdShow);
  }

  public updateWindow(): void {
    if (!this.m_hWnd) return;
    if (!GetWindowCanvas(this.m_hWnd)) return;
    this.sendMessage(WM_PAINT, 0, 0);
  }

  public destroyWindow(): boolean {
    if (!this.m_hWnd) return false;
    const hwnd = this.m_hWnd;
    const destroyed = Win32DestroyWindow(hwnd);
    if (destroyed && this.m_hWnd === hwnd) this.detach();
    return destroyed;
  }

  public enableWindow(enable: boolean): boolean {
    if (!this.m_hWnd) return false;
    return Win32EnableWindow(this.m_hWnd, enable);
  }

  public setWindowText(text: string): boolean {
    if (!this.m_hWnd) return false;
    return Win32SetWindowText(this.m_hWnd, text);
  }

  public getWindowText(): string {
    if (!this.m_hWnd) return "";
    return Win32GetWindowText(this.m_hWnd);
  }

  public moveWindow(x: number, y: number, nWidth: number, nHeight: number, bRepaint = true): boolean {
    if (!this.m_hWnd) return false;
    return Win32MoveWindow(this.m_hWnd, x, y, nWidth, nHeight, bRepaint);
  }

  public setTimer(nIDEvent: number, nElapse: number, lpfnTimer?: any): number {
    if (!this.m_hWnd) return 0;
    return Win32SetTimer(this.m_hWnd, nIDEvent, nElapse, lpfnTimer);
  }

  public killTimer(nIDEvent: number): boolean {
    if (!this.m_hWnd) return false;
    return Win32KillTimer(this.m_hWnd, nIDEvent);
  }

  public sendMessage(uMsg: UINT, wParam: WPARAM = 0, lParam: LPARAM = 0): LRESULT {
    if (!this.m_hWnd) return 0;
    return Win32SendMessage(this.m_hWnd, uMsg, wParam, lParam);
  }

  public postMessage(uMsg: UINT, wParam: WPARAM = 0, lParam: LPARAM = 0): boolean {
    if (!this.m_hWnd) return false;
    return Win32PostMessage(this.m_hWnd, uMsg, wParam, lParam);
  }

  public messageBox(text: string, caption = "Message", type: number = MB_OK): Promise<number> {
    return Win32MessageBox(this.m_hWnd, text, caption, type);
  }

  public setCustomProp(key: string, value: any): void {
    const win = kernel.getWindow(this.m_hWnd);
    if (win) {
      win.customProps[key] = value;
    }
  }

  public getCustomProp(key: string): any {
    const win = kernel.getWindow(this.m_hWnd);
    return win?.customProps?.[key];
  }
}
