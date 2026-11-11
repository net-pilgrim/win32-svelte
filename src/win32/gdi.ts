import type { HWND, RECT, POINT } from "./types";
import { SendMessage } from "./kernel.svelte";
import { WM_PAINT } from "./constants";

export type HGDIOBJ = any;
export type HBRUSH = { type: "brush"; color: string };
export type HPEN = { type: "pen"; width: number; color: string; style?: number };

export interface PAINTSTRUCT {
  hdc: HDC;
  fErase: boolean;
  rcPaint: RECT;
}

export class HDC {
  public ctx: CanvasRenderingContext2D;
  public canvas: HTMLCanvasElement;
  public hwnd: HWND;
  public currentPoint: POINT = { x: 0, y: 0 };
  public currentBrush: HBRUSH = { type: "brush", color: "#ffffff" };
  public currentPen: HPEN = { type: "pen", width: 1, color: "#000000" };
  public textColor: string = "#000000";
  public bkColor: string = "#ffffff";

  constructor(hwnd: HWND, canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
    this.hwnd = hwnd;
    this.canvas = canvas;
    this.ctx = ctx;
  }
}

// Registry of canvas elements per HWND
const canvasRegistry = new Map<HWND, HTMLCanvasElement>();

export function RegisterWindowCanvas(hwnd: HWND, canvas: HTMLCanvasElement) {
  canvasRegistry.set(hwnd, canvas);
}

export function UnregisterWindowCanvas(hwnd: HWND) {
  canvasRegistry.delete(hwnd);
}

export function GetWindowCanvas(hwnd: HWND): HTMLCanvasElement | undefined {
  return canvasRegistry.get(hwnd);
}

export function BeginPaint(hwnd: HWND, ps?: Partial<PAINTSTRUCT>): HDC {
  const canvas = canvasRegistry.get(hwnd);
  if (!canvas) {
    throw new Error(`BeginPaint: No canvas registered for HWND ${hwnd}`);
  }
  const ctx = canvas.getContext("2d")!;
  const hdc = new HDC(hwnd, canvas, ctx);

  if (ps) {
    ps.hdc = hdc;
    ps.fErase = false;
    ps.rcPaint = { left: 0, top: 0, right: canvas.width, bottom: canvas.height };
  }

  return hdc;
}

export function EndPaint(_hwnd: HWND, _ps: Partial<PAINTSTRUCT>): boolean {
  return true;
}

export function MoveToEx(hdc: HDC, x: number, y: number, lpPoint?: POINT): boolean {
  if (lpPoint) {
    lpPoint.x = hdc.currentPoint.x;
    lpPoint.y = hdc.currentPoint.y;
  }
  hdc.currentPoint.x = x;
  hdc.currentPoint.y = y;
  return true;
}

export function LineTo(hdc: HDC, x: number, y: number): boolean {
  const ctx = hdc.ctx;
  ctx.save();
  ctx.strokeStyle = hdc.currentPen.color;
  ctx.lineWidth = hdc.currentPen.width;
  ctx.beginPath();
  ctx.moveTo(hdc.currentPoint.x, hdc.currentPoint.y);
  ctx.lineTo(x, y);
  ctx.stroke();
  ctx.restore();

  hdc.currentPoint.x = x;
  hdc.currentPoint.y = y;
  return true;
}

export function Rectangle(
  hdc: HDC,
  left: number,
  top: number,
  right: number,
  bottom: number
): boolean {
  const ctx = hdc.ctx;
  const w = right - left;
  const h = bottom - top;

  ctx.save();
  ctx.fillStyle = hdc.currentBrush.color;
  ctx.fillRect(left, top, w, h);

  if (hdc.currentPen.width > 0) {
    ctx.strokeStyle = hdc.currentPen.color;
    ctx.lineWidth = hdc.currentPen.width;
    ctx.strokeRect(left, top, w, h);
  }
  ctx.restore();
  return true;
}

export function Ellipse(
  hdc: HDC,
  left: number,
  top: number,
  right: number,
  bottom: number
): boolean {
  const ctx = hdc.ctx;
  const rx = Math.abs(right - left) / 2;
  const ry = Math.abs(bottom - top) / 2;
  const cx = left + rx;
  const cy = top + ry;

  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = hdc.currentBrush.color;
  ctx.fill();

  if (hdc.currentPen.width > 0) {
    ctx.strokeStyle = hdc.currentPen.color;
    ctx.lineWidth = hdc.currentPen.width;
    ctx.stroke();
  }
  ctx.restore();
  return true;
}

export function TextOut(hdc: HDC, x: number, y: number, text: string): boolean {
  const ctx = hdc.ctx;
  ctx.save();
  ctx.font = '12px "MS Sans Serif", "Pixelated MS Sans Serif", Tahoma, sans-serif';
  ctx.fillStyle = hdc.textColor;
  ctx.textBaseline = "top";
  ctx.fillText(text, x, y);
  ctx.restore();
  return true;
}

export function SetTextColor(hdc: HDC, color: string): string {
  const old = hdc.textColor;
  hdc.textColor = color;
  return old;
}

export function SetBkColor(hdc: HDC, color: string): string {
  const old = hdc.bkColor;
  hdc.bkColor = color;
  return old;
}

export function CreateSolidBrush(color: string): HBRUSH {
  return { type: "brush", color };
}

export function CreatePen(style: number, width: number, color: string): HPEN {
  return { type: "pen", width, color, style };
}

export function SelectObject(hdc: HDC, hGdiObj: HGDIOBJ): HGDIOBJ {
  if (hGdiObj?.type === "brush") {
    const old = hdc.currentBrush;
    hdc.currentBrush = hGdiObj;
    return old;
  }
  if (hGdiObj?.type === "pen") {
    const old = hdc.currentPen;
    hdc.currentPen = hGdiObj;
    return old;
  }
  return null;
}

export function FillRect(hdc: HDC, rc: RECT, hbr: HBRUSH): boolean {
  const ctx = hdc.ctx;
  ctx.save();
  ctx.fillStyle = hbr.color;
  ctx.fillRect(rc.left, rc.top, rc.right - rc.left, rc.bottom - rc.top);
  ctx.restore();
  return true;
}

export function InvalidateRect(hwnd: HWND, _rc: RECT | null = null, _bErase = true): boolean {
  // Dispatch WM_PAINT synchronously to window
  SendMessage(hwnd, WM_PAINT, 0, 0);
  return true;
}
