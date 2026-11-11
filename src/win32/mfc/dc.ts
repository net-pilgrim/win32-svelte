import { CObject } from "./object";
import type { CWnd } from "./wnd";
import {
  HDC,
  BeginPaint,
  EndPaint,
  MoveToEx,
  LineTo,
  Rectangle,
  Ellipse,
  TextOut,
  SetTextColor,
  SelectObject,
  CreateSolidBrush,
  CreatePen,
  type PAINTSTRUCT,
} from "../gdi";

export class CDC extends CObject {
  public m_hDC: HDC | null = null;
  public m_bPrinting = false;

  public static getClassName(): string {
    return "CDC";
  }

  constructor(hDC?: HDC) {
    super();
    if (hDC) this.m_hDC = hDC;
  }

  public moveTo(x: number, y: number): boolean {
    if (!this.m_hDC) return false;
    return MoveToEx(this.m_hDC, x, y);
  }

  public lineTo(x: number, y: number): boolean {
    if (!this.m_hDC) return false;
    return LineTo(this.m_hDC, x, y);
  }

  public rectangle(left: number, top: number, right: number, bottom: number): boolean {
    if (!this.m_hDC) return false;
    return Rectangle(this.m_hDC, left, top, right, bottom);
  }

  public ellipse(left: number, top: number, right: number, bottom: number): boolean {
    if (!this.m_hDC) return false;
    return Ellipse(this.m_hDC, left, top, right, bottom);
  }

  public textOut(x: number, y: number, text: string): boolean {
    if (!this.m_hDC) return false;
    return TextOut(this.m_hDC, x, y, text);
  }

  public setTextColor(color: string): string {
    if (!this.m_hDC) return "";
    return SetTextColor(this.m_hDC, color);
  }

  public selectObject(gdiObj: any): any {
    if (!this.m_hDC) return null;
    return SelectObject(this.m_hDC, gdiObj);
  }

  public selectStockBrush(color: string): any {
    return this.selectObject(CreateSolidBrush(color));
  }

  public selectStockPen(color: string, width = 1): any {
    return this.selectObject(CreatePen(0, width, color));
  }
}

/**
 * CPaintDC: Automatically manages BeginPaint / EndPaint for CWnd OnPaint
 */
export class CPaintDC extends CDC {
  public m_pWnd: CWnd;
  public m_ps: Partial<PAINTSTRUCT> = {};

  public static override getClassName(): string {
    return "CPaintDC";
  }

  constructor(pWnd: CWnd) {
    super();
    this.m_pWnd = pWnd;
    if (pWnd.m_hWnd) {
      this.m_hDC = BeginPaint(pWnd.m_hWnd, this.m_ps);
    }
  }

  public dispose(): void {
    if (this.m_pWnd.m_hWnd) {
      EndPaint(this.m_pWnd.m_hWnd, this.m_ps);
    }
  }
}
