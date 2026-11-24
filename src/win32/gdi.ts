import type { HWND, RECT, POINT } from "./types";
import { kernel, SendMessage } from "./kernel.svelte";
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
  public bkMode: number = 1;

  public get penColor(): string {
    return this.currentPen.color;
  }
  public set penColor(c: string) {
    this.currentPen.color = c;
  }

  public get penWidth(): number {
    return this.currentPen.width;
  }
  public set penWidth(w: number) {
    this.currentPen.width = w;
  }

  public get brushColor(): string {
    return this.currentBrush.color;
  }
  public set brushColor(c: string) {
    this.currentBrush.color = c;
  }

  constructor(hwnd: HWND, canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
    this.hwnd = hwnd;
    this.canvas = canvas;
    this.ctx = ctx;
  }
}

// Registry of canvas elements per HWND
const canvasRegistry = new Map<HWND, HTMLCanvasElement>();
const fallbackCanvases = new Map<HWND, HTMLCanvasElement>();
const pendingPaints = new Set<HWND>();
const isPainting = new Set<HWND>();

export function RegisterWindowCanvas(hwnd: HWND, canvas: HTMLCanvasElement) {
  canvasRegistry.set(hwnd, canvas);
  const fallback = fallbackCanvases.get(hwnd);
  if (fallback && fallback !== canvas) {
    const ctx = canvas.getContext("2d");
    if (ctx && fallback.width > 0 && fallback.height > 0) {
      try {
        ctx.drawImage(fallback, 0, 0);
      } catch {}
    }
    fallbackCanvases.delete(hwnd);
  }
}

export function UnregisterWindowCanvas(hwnd: HWND) {
  canvasRegistry.delete(hwnd);
  fallbackCanvases.delete(hwnd);
  pendingPaints.delete(hwnd);
  isPainting.delete(hwnd);
}

export function GetWindowCanvas(hwnd: HWND): HTMLCanvasElement | undefined {
  return canvasRegistry.get(hwnd) || fallbackCanvases.get(hwnd);
}

function createMockCanvasContext(): CanvasRenderingContext2D {
  return {
    save: () => {},
    restore: () => {},
    translate: () => {},
    scale: () => {},
    clearRect: () => {},
    fillRect: () => {},
    strokeRect: () => {},
    beginPath: () => {},
    closePath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    arc: () => {},
    stroke: () => {},
    fill: () => {},
    fillText: () => {},
    strokeText: () => {},
    drawImage: () => {},
    measureText: (txt: string) => ({ width: (txt || "").length * 8 } as any),
    createImageData: () => ({ data: new Uint8ClampedArray(4) } as any),
    putImageData: () => {},
    getImageData: () => ({ data: new Uint8ClampedArray(4) } as any),
    setLineDash: () => {},
    getLineDash: () => [],
  } as any;
}

export function BeginPaint(hwnd: HWND, ps?: Partial<PAINTSTRUCT>): HDC {
  isPainting.add(hwnd);
  pendingPaints.delete(hwnd);

  let canvas = canvasRegistry.get(hwnd);
  if (!canvas) {
    canvas = fallbackCanvases.get(hwnd);
    if (!canvas) {
      const win = kernel.getWindow(hwnd);
      const defaultW = win?.width || 800;
      const defaultH = win?.height || 600;
      if (typeof document !== "undefined" && document.createElement) {
        canvas = document.createElement("canvas");
        canvas.width = defaultW;
        canvas.height = defaultH;
      } else {
        canvas = { width: defaultW, height: defaultH, getContext: () => createMockCanvasContext() } as any;
      }
      fallbackCanvases.set(hwnd, canvas as HTMLCanvasElement);
    }
  }
  const targetCanvas = canvas as HTMLCanvasElement;
  const rawCtx = targetCanvas.getContext ? targetCanvas.getContext("2d") : null;
  const ctx = rawCtx && typeof (rawCtx as any).save === "function" ? rawCtx : createMockCanvasContext();
  const hdc = new HDC(hwnd, targetCanvas, ctx as CanvasRenderingContext2D);

  if (ps) {
    ps.hdc = hdc;
    ps.fErase = false;
    ps.rcPaint = { left: 0, top: 0, right: targetCanvas.width || 800, bottom: targetCanvas.height || 600 };
  }

  return hdc;
}

export function EndPaint(hwnd: HWND, _ps?: Partial<PAINTSTRUCT>): boolean {
  isPainting.delete(hwnd);
  return true;
}

export function mapLogicalToDevice(hdc: HDC, x: number, y: number): { x: number; y: number } {
  const wOrgX = (hdc as any).windowOrgX || 0;
  const wOrgY = (hdc as any).windowOrgY || 0;
  const vOrgX = (hdc as any).viewportOrgX || 0;
  const vOrgY = (hdc as any).viewportOrgY || 0;
  const wExtX = (hdc as any).windowExtX;
  const wExtY = (hdc as any).windowExtY;
  const vExtX = (hdc as any).viewportExtX;
  const vExtY = (hdc as any).viewportExtY;

  if (wExtX && wExtY && vExtX && vExtY) {
    return {
      x: Math.round(((x - wOrgX) * vExtX) / wExtX + vOrgX),
      y: Math.round(((y - wOrgY) * vExtY) / wExtY + vOrgY),
    };
  }
  return {
    x: x - wOrgX + vOrgX,
    y: y - wOrgY + vOrgY,
  };
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
  const ctx = hdc?.ctx;
  if (ctx) {
    const p0 = mapLogicalToDevice(hdc, hdc.currentPoint.x, hdc.currentPoint.y);
    const p1 = mapLogicalToDevice(hdc, x, y);
    ctx.save();
    ctx.strokeStyle = hdc.currentPen.color;
    ctx.lineWidth = hdc.currentPen.width;
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();
    ctx.restore();
  }

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
  const ctx = hdc?.ctx;
  if (!ctx) return false;
  const p0 = mapLogicalToDevice(hdc, left, top);
  const p1 = mapLogicalToDevice(hdc, right, bottom);
  const dstLeft = Math.min(p0.x, p1.x);
  const dstTop = Math.min(p0.y, p1.y);
  const w = Math.abs(p1.x - p0.x);
  const h = Math.abs(p1.y - p0.y);

  ctx.save();
  ctx.fillStyle = hdc.currentBrush.color;
  ctx.fillRect(dstLeft, dstTop, w, h);

  if (hdc.currentPen.width > 0) {
    ctx.strokeStyle = hdc.currentPen.color;
    ctx.lineWidth = hdc.currentPen.width;
    ctx.strokeRect(dstLeft, dstTop, w, h);
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
  const ctx = hdc?.ctx;
  if (!ctx) return false;
  const p0 = mapLogicalToDevice(hdc, left, top);
  const p1 = mapLogicalToDevice(hdc, right, bottom);
  const dstLeft = Math.min(p0.x, p1.x);
  const dstTop = Math.min(p0.y, p1.y);
  const rx = Math.abs(p1.x - p0.x) / 2;
  const ry = Math.abs(p1.y - p0.y) / 2;
  const cx = dstLeft + rx;
  const cy = dstTop + ry;

  ctx.save();
  ctx.beginPath();
  if (typeof ctx.ellipse === "function") {
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  } else if (typeof ctx.arc === "function") {
    ctx.arc(cx, cy, Math.max(rx, ry), 0, Math.PI * 2);
  }
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
  const ctx = hdc?.ctx;
  if (!ctx) return false;
  const pt = mapLogicalToDevice(hdc, x, y);
  ctx.save();
  const fontObj = (hdc as any).selectedFont;
  if (fontObj) {
    const fontStyle = fontObj.italic ? "italic " : "";
    const fontWeight = fontObj.weight >= 700 ? "bold " : "";
    const fontSize = Math.abs(fontObj.height) || 12;
    ctx.font = `${fontStyle}${fontWeight}${fontSize}px "${fontObj.faceName || "MS Sans Serif"}", sans-serif`;
  } else {
    ctx.font = '12px "MS Sans Serif", "Pixelated MS Sans Serif", Tahoma, sans-serif';
  }
  ctx.fillStyle = hdc.textColor;
  const align = (hdc as any).textAlign || 0;
  if ((align & 24) === 24) {
    ctx.textBaseline = "alphabetic";
  } else if ((align & 8) === 8) {
    ctx.textBaseline = "bottom";
  } else {
    ctx.textBaseline = "top";
  }
  if ((align & 6) === 6) {
    ctx.textAlign = "center";
  } else if ((align & 2) === 2) {
    ctx.textAlign = "right";
  } else {
    ctx.textAlign = "left";
  }
  ctx.fillText(text, pt.x, pt.y);
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
  const ctx = hdc?.ctx;
  if (!ctx) return false;
  const p0 = mapLogicalToDevice(hdc, rc.left, rc.top);
  const p1 = mapLogicalToDevice(hdc, rc.right, rc.bottom);
  ctx.save();
  ctx.fillStyle = hbr.color;
  ctx.fillRect(
    Math.min(p0.x, p1.x),
    Math.min(p0.y, p1.y),
    Math.abs(p1.x - p0.x),
    Math.abs(p1.y - p0.y)
  );
  ctx.restore();
  return true;
}

export function InvalidateRect(hwnd: HWND, _rc: RECT | null = null, _bErase = true): boolean {
  // If already in the middle of WM_PAINT for this window, do not queue duplicate re-paint microtasks
  if (isPainting.has(hwnd) || pendingPaints.has(hwnd)) return true;
  pendingPaints.add(hwnd);
  queueMicrotask(() => {
    pendingPaints.delete(hwnd);
    if (!isPainting.has(hwnd)) {
      isPainting.add(hwnd);
      try {
        SendMessage(hwnd, WM_PAINT, 0, 0);
      } finally {
        isPainting.delete(hwnd);
      }
    }
  });
  return true;
}
