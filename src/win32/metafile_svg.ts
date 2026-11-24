/**
 * Win32 Metafile (WMF) and Enhanced Metafile (EMF) SVG Engine
 *
 * Implements:
 * 1. 32-bit EMF binary parser -> pure SVG vector graphics
 * 2. 16-bit WMF binary parser (standard & Aldus placeable) -> pure SVG vector graphics
 * 3. Live Win32 GDI Metafile Recorder (CreateMetaFile / CreateEnhMetaFile)
 * 4. Crisp vector rendering to any Canvas HDC via affine transforms
 * 5. Standalone SVG export and DOM rendering
 */

import type { RECT, POINT } from "./types";

export interface MetafileBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export type MetafileVectorCommand =
  | { type: "rect"; x: number; y: number; w: number; h: number; stroke: string; strokeWidth: number; fill: string; rx?: number; ry?: number }
  | { type: "ellipse"; cx: number; cy: number; rx: number; ry: number; stroke: string; strokeWidth: number; fill: string }
  | { type: "line"; x1: number; y1: number; x2: number; y2: number; stroke: string; strokeWidth: number }
  | { type: "polyline"; points: POINT[]; stroke: string; strokeWidth: number; fill: string }
  | { type: "polygon"; points: POINT[]; stroke: string; strokeWidth: number; fill: string }
  | { type: "bezier"; points: POINT[]; stroke: string; strokeWidth: number; fill: string }
  | { type: "text"; text: string; x: number; y: number; color: string; font?: string; fontSize?: number; align?: string };

export class SvgMetafile {
  public type: "metafile" | "enhmetafile";
  public name: string | null;
  public description: string | null;
  public bounds: MetafileBounds;
  public frame: MetafileBounds;
  public commands: MetafileVectorCommand[] = [];
  public rawSvgElements: string[] = [];
  public rawBytes?: Uint8Array;

  private _cachedCanvas: HTMLCanvasElement | null = null;

  constructor(
    type: "metafile" | "enhmetafile",
    bounds: MetafileBounds = { left: 0, top: 0, right: 600, bottom: 200 },
    frame: MetafileBounds = { left: 0, top: 0, right: 15240, bottom: 5080 },
    name: string | null = null,
    description: string | null = null
  ) {
    this.type = type;
    this.bounds = { ...bounds };
    this.frame = { ...frame };
    this.name = name;
    this.description = description;
  }

  public get canvas(): HTMLCanvasElement {
    if (!this._cachedCanvas) {
      this._cachedCanvas = this.renderToOffscreenCanvas();
    }
    return this._cachedCanvas;
  }

  public get ctx(): CanvasRenderingContext2D | null {
    return this.canvas && typeof this.canvas.getContext === "function"
      ? this.canvas.getContext("2d")
      : null;
  }

  /**
   * Generates complete SVG document markup string.
   */
  public toSvg(destWidth?: number, destHeight?: number): string {
    const minX = this.bounds.left;
    const minY = this.bounds.top;
    const vbW = Math.max(1, this.bounds.right - this.bounds.left);
    const vbH = Math.max(1, this.bounds.bottom - this.bounds.top);

    const w = destWidth !== undefined ? destWidth : vbW;
    const h = destHeight !== undefined ? destHeight : vbH;

    let inner = "";
    if (this.rawSvgElements.length > 0) {
      inner = this.rawSvgElements.join("\n  ");
    } else {
      inner = this.commands.map((cmd) => commandToSvg(cmd)).join("\n  ");
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${minX} ${minY} ${vbW} ${vbH}">
  <desc>${escapeXml(this.description || (this.type === "enhmetafile" ? "Win32 Enhanced Metafile (EMF)" : "Win32 Metafile (WMF)"))}</desc>
  ${inner}
</svg>`;
  }

  /**
   * Direct vector rendering to any Canvas 2D context scaled to destRect.
   */
  public renderToCanvas(ctx: CanvasRenderingContext2D, destRect?: MetafileBounds): void {
    if (!ctx) return;
    const b = this.bounds;
    const srcW = Math.max(1, b.right - b.left);
    const srcH = Math.max(1, b.bottom - b.top);

    const dstLeft = destRect ? destRect.left : b.left;
    const dstTop = destRect ? destRect.top : b.top;
    const dstW = destRect ? destRect.right - destRect.left : srcW;
    const dstH = destRect ? destRect.bottom - destRect.top : srcH;

    const scaleX = dstW / srcW;
    const scaleY = dstH / srcH;

    ctx.save();
    ctx.translate(dstLeft, dstTop);
    ctx.scale(scaleX, scaleY);
    ctx.translate(-b.left, -b.top);

    for (const cmd of this.commands) {
      executeCanvasCommand(ctx, cmd);
    }

    ctx.restore();
  }

  private renderToOffscreenCanvas(): HTMLCanvasElement {
    const canvas = typeof document !== "undefined" ? document.createElement("canvas") : ({} as any);
    const w = Math.max(1, Math.abs(this.bounds.right - this.bounds.left)) || 600;
    const h = Math.max(1, Math.abs(this.bounds.bottom - this.bounds.top)) || 200;
    canvas.width = w;
    canvas.height = h;

    if (canvas.getContext) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        this.renderToCanvas(ctx, { left: 0, top: 0, right: w, bottom: h });
      }
    }
    return canvas;
  }
}

function commandToSvg(cmd: MetafileVectorCommand): string {
  switch (cmd.type) {
    case "rect":
      return `<rect x="${cmd.x}" y="${cmd.y}" width="${cmd.w}" height="${cmd.h}" fill="${cmd.fill}" stroke="${cmd.stroke}" stroke-width="${cmd.strokeWidth}" ${cmd.rx ? `rx="${cmd.rx}" ry="${cmd.ry || cmd.rx}"` : ""}/>`;
    case "ellipse":
      return `<ellipse cx="${cmd.cx}" cy="${cmd.cy}" rx="${cmd.rx}" ry="${cmd.ry}" fill="${cmd.fill}" stroke="${cmd.stroke}" stroke-width="${cmd.strokeWidth}"/>`;
    case "line":
      return `<line x1="${cmd.x1}" y1="${cmd.y1}" x2="${cmd.x2}" y2="${cmd.y2}" stroke="${cmd.stroke}" stroke-width="${cmd.strokeWidth}" stroke-linecap="round"/>`;
    case "polyline":
      return `<polyline points="${cmd.points.map((p) => `${p.x},${p.y}`).join(" ")}" fill="${cmd.fill || "none"}" stroke="${cmd.stroke}" stroke-width="${cmd.strokeWidth}"/>`;
    case "polygon":
      return `<polygon points="${cmd.points.map((p) => `${p.x},${p.y}`).join(" ")}" fill="${cmd.fill}" stroke="${cmd.stroke}" stroke-width="${cmd.strokeWidth}"/>`;
    case "bezier": {
      if (cmd.points.length < 4) return "";
      let d = `M ${cmd.points[0].x} ${cmd.points[0].y}`;
      for (let i = 1; i + 2 < cmd.points.length; i += 3) {
        d += ` C ${cmd.points[i].x} ${cmd.points[i].y}, ${cmd.points[i + 1].x} ${cmd.points[i + 1].y}, ${cmd.points[i + 2].x} ${cmd.points[i + 2].y}`;
      }
      return `<path d="${d}" fill="${cmd.fill || "none"}" stroke="${cmd.stroke}" stroke-width="${cmd.strokeWidth}"/>`;
    }
    case "text":
      return `<text x="${cmd.x}" y="${cmd.y}" fill="${cmd.color}" font-family="${cmd.font || "MS Sans Serif, sans-serif"}" font-size="${cmd.fontSize || 12}">${escapeXml(cmd.text)}</text>`;
  }
}

function executeCanvasCommand(ctx: CanvasRenderingContext2D, cmd: MetafileVectorCommand): void {
  ctx.save();
  switch (cmd.type) {
    case "rect":
      if (cmd.fill && cmd.fill !== "none") {
        ctx.fillStyle = cmd.fill;
        ctx.fillRect(cmd.x, cmd.y, cmd.w, cmd.h);
      }
      if (cmd.stroke && cmd.stroke !== "none" && cmd.strokeWidth > 0) {
        ctx.strokeStyle = cmd.stroke;
        ctx.lineWidth = cmd.strokeWidth;
        ctx.strokeRect(cmd.x, cmd.y, cmd.w, cmd.h);
      }
      break;
    case "ellipse":
      ctx.beginPath();
      if (typeof ctx.ellipse === "function") {
        ctx.ellipse(cmd.cx, cmd.cy, cmd.rx, cmd.ry, 0, 0, Math.PI * 2);
      } else {
        ctx.arc(cmd.cx, cmd.cy, Math.max(cmd.rx, cmd.ry), 0, Math.PI * 2);
      }
      if (cmd.fill && cmd.fill !== "none") {
        ctx.fillStyle = cmd.fill;
        ctx.fill();
      }
      if (cmd.stroke && cmd.stroke !== "none" && cmd.strokeWidth > 0) {
        ctx.strokeStyle = cmd.stroke;
        ctx.lineWidth = cmd.strokeWidth;
        ctx.stroke();
      }
      break;
    case "line":
      if (cmd.stroke && cmd.stroke !== "none" && cmd.strokeWidth > 0) {
        ctx.strokeStyle = cmd.stroke;
        ctx.lineWidth = cmd.strokeWidth;
        ctx.beginPath();
        ctx.moveTo(cmd.x1, cmd.y1);
        ctx.lineTo(cmd.x2, cmd.y2);
        ctx.stroke();
      }
      break;
    case "polyline":
    case "polygon":
      if (cmd.points.length > 0) {
        ctx.beginPath();
        ctx.moveTo(cmd.points[0].x, cmd.points[0].y);
        for (let i = 1; i < cmd.points.length; i++) {
          ctx.lineTo(cmd.points[i].x, cmd.points[i].y);
        }
        if (cmd.type === "polygon") ctx.closePath();
        if (cmd.fill && cmd.fill !== "none") {
          ctx.fillStyle = cmd.fill;
          ctx.fill();
        }
        if (cmd.stroke && cmd.stroke !== "none" && cmd.strokeWidth > 0) {
          ctx.strokeStyle = cmd.stroke;
          ctx.lineWidth = cmd.strokeWidth;
          ctx.stroke();
        }
      }
      break;
    case "bezier":
      if (cmd.points.length >= 4) {
        ctx.beginPath();
        ctx.moveTo(cmd.points[0].x, cmd.points[0].y);
        for (let i = 1; i + 2 < cmd.points.length; i += 3) {
          ctx.bezierCurveTo(
            cmd.points[i].x,
            cmd.points[i].y,
            cmd.points[i + 1].x,
            cmd.points[i + 1].y,
            cmd.points[i + 2].x,
            cmd.points[i + 2].y
          );
        }
        if (cmd.fill && cmd.fill !== "none") {
          ctx.fillStyle = cmd.fill;
          ctx.fill();
        }
        if (cmd.stroke && cmd.stroke !== "none" && cmd.strokeWidth > 0) {
          ctx.strokeStyle = cmd.stroke;
          ctx.lineWidth = cmd.strokeWidth;
          ctx.stroke();
        }
      }
      break;
    case "text":
      ctx.fillStyle = cmd.color;
      ctx.font = `${cmd.fontSize || 12}px "${cmd.font || "MS Sans Serif"}", sans-serif`;
      ctx.textBaseline = "top";
      ctx.fillText(cmd.text, cmd.x, cmd.y);
      break;
  }
  ctx.restore();
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function colorrefToHex(c: number): string {
  // Win32 COLORREF format: 0x00BBGGRR
  const r = c & 0xff;
  const g = (c >> 8) & 0xff;
  const b = (c >> 16) & 0xff;
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

// Win32 Stock Object IDs (Index with high bit set: 0x80000000 | stockIndex)
const STOCK_OBJECTS: Record<number, any> = {
  0x80000000: { type: "brush", color: "#ffffff" }, // WHITE_BRUSH
  0x80000001: { type: "brush", color: "#c0c0c0" }, // LTGRAY_BRUSH
  0x80000002: { type: "brush", color: "#808080" }, // GRAY_BRUSH
  0x80000003: { type: "brush", color: "#404040" }, // DKGRAY_BRUSH
  0x80000004: { type: "brush", color: "#000000" }, // BLACK_BRUSH
  0x80000005: { type: "brush", color: "none" },    // NULL_BRUSH / HOLLOW_BRUSH
  0x80000006: { type: "pen", color: "#ffffff", width: 1 }, // WHITE_PEN
  0x80000007: { type: "pen", color: "#000000", width: 1 }, // BLACK_PEN
  0x80000008: { type: "pen", color: "none", width: 0 },    // NULL_PEN
};

/**
 * Parses binary 32-bit Enhanced Metafile (EMF) into an SvgMetafile.
 */
export function parseEmfToSvg(data: Uint8Array, fileName: string | null = null): SvgMetafile {
  if (data.byteLength < 88) {
    throw new Error(`EMF file too short (${data.byteLength} bytes)`);
  }

  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);

  // Read EMR_HEADER (type 1)
  const iType = dv.getUint32(0, true);
  if (iType !== 1) {
    throw new Error(`Invalid EMF signature: first record type is ${iType}, expected 1 (EMR_HEADER)`);
  }

  const bounds: MetafileBounds = {
    left: dv.getInt32(8, true),
    top: dv.getInt32(12, true),
    right: dv.getInt32(16, true),
    bottom: dv.getInt32(20, true),
  };

  const frame: MetafileBounds = {
    left: dv.getInt32(24, true),
    top: dv.getInt32(28, true),
    right: dv.getInt32(32, true),
    bottom: dv.getInt32(36, true),
  };

  const signature = dv.getUint32(40, true);
  if (signature !== 0x464d4520) {
    // ' EMF' in LE
    console.warn(`Unusual EMF signature: 0x${signature.toString(16)}`);
  }

  // Description string
  let description: string | null = null;
  const nDescription = dv.getUint32(56, true);
  const offDescription = dv.getUint32(60, true);
  if (nDescription > 0 && offDescription > 0 && offDescription + nDescription * 2 <= data.byteLength) {
    const chars: string[] = [];
    for (let i = 0; i < nDescription; i++) {
      const ch = dv.getUint16(offDescription + i * 2, true);
      if (ch === 0) chars.push(" ");
      else chars.push(String.fromCharCode(ch));
    }
    description = chars.join("").trim();
  }

  const metafile = new SvgMetafile("enhmetafile", bounds, frame, fileName, description);
  metafile.rawBytes = data;

  // Object Handle Table
  const handleTable: Record<number, any> = {};

  // Current GDI State
  let currentPen = { color: "#000000", width: 1, style: 0 };
  let currentBrush = { color: "#ffffff", style: 0 };
  let currentPoint: POINT = { x: 0, y: 0 };
  let textColor = "#000000";
  let currentFont = { faceName: "MS Sans Serif", height: 12 };

  let offset = 0;
  while (offset + 8 <= data.byteLength) {
    const recType = dv.getUint32(offset + 0, true);
    const recSize = dv.getUint32(offset + 4, true);

    if (recSize < 8 || offset + recSize > data.byteLength) {
      break;
    }

    switch (recType) {
      case 14: // EMR_EOF
        offset = data.byteLength;
        break;

      case 43: { // EMR_RECTANGLE
        const left = dv.getInt32(offset + 8, true);
        const top = dv.getInt32(offset + 12, true);
        const right = dv.getInt32(offset + 16, true);
        const bottom = dv.getInt32(offset + 20, true);
        const w = right - left;
        const h = bottom - top;
        metafile.commands.push({
          type: "rect",
          x: left,
          y: top,
          w,
          h,
          fill: currentBrush.color,
          stroke: currentPen.color,
          strokeWidth: currentPen.width,
        });
        break;
      }

      case 42: { // EMR_ELLIPSE
        const left = dv.getInt32(offset + 8, true);
        const top = dv.getInt32(offset + 12, true);
        const right = dv.getInt32(offset + 16, true);
        const bottom = dv.getInt32(offset + 20, true);
        const rx = Math.abs(right - left) / 2;
        const ry = Math.abs(bottom - top) / 2;
        metafile.commands.push({
          type: "ellipse",
          cx: left + rx,
          cy: top + ry,
          rx,
          ry,
          fill: currentBrush.color,
          stroke: currentPen.color,
          strokeWidth: currentPen.width,
        });
        break;
      }

      case 44: { // EMR_ROUNDRECT
        const left = dv.getInt32(offset + 8, true);
        const top = dv.getInt32(offset + 12, true);
        const right = dv.getInt32(offset + 16, true);
        const bottom = dv.getInt32(offset + 20, true);
        const cw = dv.getInt32(offset + 24, true);
        const ch = dv.getInt32(offset + 28, true);
        metafile.commands.push({
          type: "rect",
          x: left,
          y: top,
          w: right - left,
          h: bottom - top,
          rx: cw / 2,
          ry: ch / 2,
          fill: currentBrush.color,
          stroke: currentPen.color,
          strokeWidth: currentPen.width,
        });
        break;
      }

      case 27: { // EMR_MOVETOEX
        currentPoint = {
          x: dv.getInt32(offset + 8, true),
          y: dv.getInt32(offset + 12, true),
        };
        break;
      }

      case 54: { // EMR_LINETO
        const nextX = dv.getInt32(offset + 8, true);
        const nextY = dv.getInt32(offset + 12, true);
        metafile.commands.push({
          type: "line",
          x1: currentPoint.x,
          y1: currentPoint.y,
          x2: nextX,
          y2: nextY,
          stroke: currentPen.color,
          strokeWidth: currentPen.width,
        });
        currentPoint = { x: nextX, y: nextY };
        break;
      }

      case 4:   // EMR_POLYLINE
      case 87:  // EMR_POLYLINE16
      case 3:   // EMR_POLYGON
      case 86: { // EMR_POLYGON16
        const is16 = recType === 87 || recType === 86;
        const isPoly = recType === 3 || recType === 86;
        const cptl = dv.getUint32(offset + 24, true);
        const pts: POINT[] = [];
        let pOffset = offset + 28;
        for (let i = 0; i < cptl && pOffset < offset + recSize; i++) {
          if (is16) {
            pts.push({ x: dv.getInt16(pOffset, true), y: dv.getInt16(pOffset + 2, true) });
            pOffset += 4;
          } else {
            pts.push({ x: dv.getInt32(pOffset, true), y: dv.getInt32(pOffset + 4, true) });
            pOffset += 8;
          }
        }
        if (isPoly) {
          metafile.commands.push({
            type: "polygon",
            points: pts,
            fill: currentBrush.color,
            stroke: currentPen.color,
            strokeWidth: currentPen.width,
          });
        } else {
          metafile.commands.push({
            type: "polyline",
            points: pts,
            fill: "none",
            stroke: currentPen.color,
            strokeWidth: currentPen.width,
          });
        }
        break;
      }

      case 2:  // EMR_POLYBEZIER
      case 85: { // EMR_POLYBEZIER16
        const is16 = recType === 85;
        const cptl = dv.getUint32(offset + 24, true);
        const pts: POINT[] = [];
        let pOffset = offset + 28;
        for (let i = 0; i < cptl && pOffset < offset + recSize; i++) {
          if (is16) {
            pts.push({ x: dv.getInt16(pOffset, true), y: dv.getInt16(pOffset + 2, true) });
            pOffset += 4;
          } else {
            pts.push({ x: dv.getInt32(pOffset, true), y: dv.getInt32(pOffset + 4, true) });
            pOffset += 8;
          }
        }
        metafile.commands.push({
          type: "bezier",
          points: pts,
          fill: "none",
          stroke: currentPen.color,
          strokeWidth: currentPen.width,
        });
        break;
      }

      case 38: { // EMR_CREATEPEN
        const ihPen = dv.getUint32(offset + 8, true);
        const penStyle = dv.getUint32(offset + 12, true);
        const width = dv.getInt32(offset + 16, true);
        const color = dv.getUint32(offset + 24, true);
        handleTable[ihPen] = {
          type: "pen",
          style: penStyle,
          width: Math.max(1, width),
          color: colorrefToHex(color),
        };
        break;
      }

      case 95: { // EMR_EXTCREATEPEN
        const ihPen = dv.getUint32(offset + 8, true);
        const penStyle = dv.getUint32(offset + 28, true);
        const width = dv.getUint32(offset + 32, true);
        const color = dv.getUint32(offset + 40, true);
        handleTable[ihPen] = {
          type: "pen",
          style: penStyle,
          width: Math.max(1, width),
          color: colorrefToHex(color),
        };
        break;
      }

      case 39: { // EMR_CREATEBRUSHINDIRECT
        const ihBrush = dv.getUint32(offset + 8, true);
        const style = dv.getUint32(offset + 12, true);
        const color = dv.getUint32(offset + 16, true);
        handleTable[ihBrush] = {
          type: "brush",
          style,
          color: style === 1 ? "none" : colorrefToHex(color), // 1 = BS_NULL/HOLLOW
        };
        break;
      }

      case 37: { // EMR_SELECTOBJECT
        const ihObj = dv.getUint32(offset + 8, true);
        const obj = (ihObj & 0x80000000) !== 0 ? STOCK_OBJECTS[ihObj] : handleTable[ihObj];
        if (obj) {
          if (obj.type === "pen") currentPen = { ...obj };
          else if (obj.type === "brush") currentBrush = { ...obj };
          else if (obj.type === "font") currentFont = { ...obj };
        }
        break;
      }

      case 40: { // EMR_DELETEOBJECT
        const ihObj = dv.getUint32(offset + 8, true);
        delete handleTable[ihObj];
        break;
      }

      case 24: { // EMR_SETTEXTCOLOR
        textColor = colorrefToHex(dv.getUint32(offset + 8, true));
        break;
      }

      case 84: { // EMR_EXTTEXTOUTW
        const ptlX = dv.getInt32(offset + 36, true);
        const ptlY = dv.getInt32(offset + 40, true);
        const nChars = dv.getUint32(offset + 44, true);
        const offString = dv.getUint32(offset + 48, true);

        if (nChars > 0 && offString > 0 && offset + offString + nChars * 2 <= offset + recSize) {
          const chars: string[] = [];
          for (let i = 0; i < nChars; i++) {
            const ch = dv.getUint16(offset + offString + i * 2, true);
            chars.push(String.fromCharCode(ch));
          }
          metafile.commands.push({
            type: "text",
            text: chars.join(""),
            x: ptlX,
            y: ptlY,
            color: textColor,
            font: currentFont.faceName,
            fontSize: Math.abs(currentFont.height) || 12,
          });
        }
        break;
      }

      case 83: { // EMR_EXTTEXTOUTA
        const ptlX = dv.getInt32(offset + 36, true);
        const ptlY = dv.getInt32(offset + 40, true);
        const nChars = dv.getUint32(offset + 44, true);
        const offString = dv.getUint32(offset + 48, true);

        if (nChars > 0 && offString > 0 && offset + offString + nChars <= offset + recSize) {
          const chars: string[] = [];
          for (let i = 0; i < nChars; i++) {
            const ch = dv.getUint8(offset + offString + i);
            chars.push(String.fromCharCode(ch));
          }
          metafile.commands.push({
            type: "text",
            text: chars.join(""),
            x: ptlX,
            y: ptlY,
            color: textColor,
            font: currentFont.faceName,
            fontSize: Math.abs(currentFont.height) || 12,
          });
        }
        break;
      }
    }

    offset += recSize;
  }

  return metafile;
}

/**
 * Parses binary 16-bit Windows Metafile (WMF) into an SvgMetafile.
 */
export function parseWmfToSvg(data: Uint8Array, fileName: string | null = null): SvgMetafile {
  if (data.byteLength < 18) {
    throw new Error(`WMF file too short (${data.byteLength} bytes)`);
  }

  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);

  let offset = 0;
  let bounds: MetafileBounds = { left: 0, top: 0, right: 1000, bottom: 1000 };

  // Check Aldus Placeable Header (key: 0x9AC6CDD7)
  const apmKey = dv.getUint32(0, true);
  if (apmKey === 0x9ac6cdd7) {
    bounds = {
      left: dv.getInt16(6, true),
      top: dv.getInt16(8, true),
      right: dv.getInt16(10, true),
      bottom: dv.getInt16(12, true),
    };
    offset = 22; // Skip 22-byte APM header
  }

  const metafile = new SvgMetafile(
    "metafile",
    bounds,
    { left: 0, top: 0, right: 15240, bottom: 15240 },
    fileName,
    "16-bit Windows Metafile (WMF)"
  );
  metafile.rawBytes = data;

  // WMF Header (18 bytes)
  const _mtType = dv.getUint16(offset + 0, true);
  const _mtHeaderSize = dv.getUint16(offset + 2, true);
  offset += 18;

  const handleTable: Record<number, any> = {};
  let currentPen = { color: "#000000", width: 1 };
  let currentBrush = { color: "#ffffff" };
  let currentPoint: POINT = { x: 0, y: 0 };
  let textColor = "#000000";

  while (offset + 6 <= data.byteLength) {
    const rdSizeWords = dv.getUint32(offset + 0, true);
    const rdFunction = dv.getUint16(offset + 4, true);
    const rdSizeBytes = rdSizeWords * 2;

    if (rdSizeBytes < 6 || offset + rdSizeBytes > data.byteLength) {
      break;
    }

    if (rdFunction === 0x0000) { // META_EOF
      break;
    }

    switch (rdFunction) {
      case 0x041b: { // META_RECTANGLE (bottom, right, top, left in reverse order)
        const bottom = dv.getInt16(offset + 6, true);
        const right = dv.getInt16(offset + 8, true);
        const top = dv.getInt16(offset + 10, true);
        const left = dv.getInt16(offset + 12, true);
        metafile.commands.push({
          type: "rect",
          x: left,
          y: top,
          w: right - left,
          h: bottom - top,
          fill: currentBrush.color,
          stroke: currentPen.color,
          strokeWidth: currentPen.width,
        });
        break;
      }

      case 0x0418: { // META_ELLIPSE (bottom, right, top, left)
        const bottom = dv.getInt16(offset + 6, true);
        const right = dv.getInt16(offset + 8, true);
        const top = dv.getInt16(offset + 10, true);
        const left = dv.getInt16(offset + 12, true);
        const rx = Math.abs(right - left) / 2;
        const ry = Math.abs(bottom - top) / 2;
        metafile.commands.push({
          type: "ellipse",
          cx: left + rx,
          cy: top + ry,
          rx,
          ry,
          fill: currentBrush.color,
          stroke: currentPen.color,
          strokeWidth: currentPen.width,
        });
        break;
      }

      case 0x0214: { // META_MOVETO (y, x)
        const y = dv.getInt16(offset + 6, true);
        const x = dv.getInt16(offset + 8, true);
        currentPoint = { x, y };
        break;
      }

      case 0x0213: { // META_LINETO (y, x)
        const y = dv.getInt16(offset + 6, true);
        const x = dv.getInt16(offset + 8, true);
        metafile.commands.push({
          type: "line",
          x1: currentPoint.x,
          y1: currentPoint.y,
          x2: x,
          y2: y,
          stroke: currentPen.color,
          strokeWidth: currentPen.width,
        });
        currentPoint = { x, y };
        break;
      }

      case 0x0325:   // META_POLYLINE
      case 0x0324: { // META_POLYGON (count, points)
        const count = dv.getInt16(offset + 6, true);
        const pts: POINT[] = [];
        let pOff = offset + 8;
        for (let i = 0; i < count && pOff < offset + rdSizeBytes; i++) {
          pts.push({ x: dv.getInt16(pOff, true), y: dv.getInt16(pOff + 2, true) });
          pOff += 4;
        }
        if (rdFunction === 0x0324) {
          metafile.commands.push({
            type: "polygon",
            points: pts,
            fill: currentBrush.color,
            stroke: currentPen.color,
            strokeWidth: currentPen.width,
          });
        } else {
          metafile.commands.push({
            type: "polyline",
            points: pts,
            fill: "none",
            stroke: currentPen.color,
            strokeWidth: currentPen.width,
          });
        }
        break;
      }

      case 0x02fa: { // META_CREATEPENINDIRECT
        const style = dv.getUint16(offset + 6, true);
        const width = dv.getInt16(offset + 8, true);
        const color = dv.getUint32(offset + 12, true);
        // Find first empty index
        let idx = 0;
        while (handleTable[idx]) idx++;
        handleTable[idx] = {
          type: "pen",
          style,
          width: Math.max(1, width),
          color: colorrefToHex(color),
        };
        break;
      }

      case 0x02fb: { // META_CREATEBRUSHINDIRECT
        const style = dv.getUint16(offset + 6, true);
        const color = dv.getUint32(offset + 8, true);
        let idx = 0;
        while (handleTable[idx]) idx++;
        handleTable[idx] = {
          type: "brush",
          style,
          color: style === 1 ? "none" : colorrefToHex(color),
        };
        break;
      }

      case 0x012d: { // META_SELECTOBJECT
        const idx = dv.getUint16(offset + 6, true);
        const obj = handleTable[idx];
        if (obj) {
          if (obj.type === "pen") currentPen = { ...obj };
          else if (obj.type === "brush") currentBrush = { ...obj };
        }
        break;
      }

      case 0x01f0: { // META_DELETEOBJECT
        const idx = dv.getUint16(offset + 6, true);
        delete handleTable[idx];
        break;
      }

      case 0x0209: { // META_SETTEXTCOLOR
        textColor = colorrefToHex(dv.getUint32(offset + 6, true));
        break;
      }
    }

    offset += rdSizeBytes;
  }

  return metafile;
}

/**
 * Live GDI Metafile Recorder for CreateMetaFile / CreateEnhMetaFile
 */
export class MetafileSvgRecorder {
  public metafile: SvgMetafile;
  private currentPen = { color: "#000000", width: 1 };
  private currentBrush = { color: "#ffffff" };
  private currentPoint: POINT = { x: 0, y: 0 };
  private textColor = "#000000";

  constructor(
    type: "metafile" | "enhmetafile" = "enhmetafile",
    name: string | null = null,
    description: string | null = null,
    bounds: MetafileBounds = { left: 0, top: 0, right: 1024, bottom: 768 }
  ) {
    this.metafile = new SvgMetafile(type, bounds, { left: 0, top: 0, right: 25400, bottom: 19050 }, name, description);
  }

  public recordRectangle(left: number, top: number, right: number, bottom: number): void {
    this.metafile.commands.push({
      type: "rect",
      x: left,
      y: top,
      w: right - left,
      h: bottom - top,
      fill: this.currentBrush.color,
      stroke: this.currentPen.color,
      strokeWidth: this.currentPen.width,
    });
    this.updateBounds(left, top, right, bottom);
  }

  public recordEllipse(left: number, top: number, right: number, bottom: number): void {
    const rx = Math.abs(right - left) / 2;
    const ry = Math.abs(bottom - top) / 2;
    this.metafile.commands.push({
      type: "ellipse",
      cx: left + rx,
      cy: top + ry,
      rx,
      ry,
      fill: this.currentBrush.color,
      stroke: this.currentPen.color,
      strokeWidth: this.currentPen.width,
    });
    this.updateBounds(left, top, right, bottom);
  }

  public recordMoveTo(x: number, y: number): void {
    this.currentPoint = { x, y };
  }

  public recordLineTo(x: number, y: number): void {
    this.metafile.commands.push({
      type: "line",
      x1: this.currentPoint.x,
      y1: this.currentPoint.y,
      x2: x,
      y2: y,
      stroke: this.currentPen.color,
      strokeWidth: this.currentPen.width,
    });
    this.updateBounds(this.currentPoint.x, this.currentPoint.y, x, y);
    this.currentPoint = { x, y };
  }

  public recordPolyline(points: POINT[]): void {
    this.metafile.commands.push({
      type: "polyline",
      points: points.map((p) => ({ ...p })),
      fill: "none",
      stroke: this.currentPen.color,
      strokeWidth: this.currentPen.width,
    });
    for (const p of points) this.updateBounds(p.x, p.y, p.x, p.y);
  }

  public recordPolygon(points: POINT[]): void {
    this.metafile.commands.push({
      type: "polygon",
      points: points.map((p) => ({ ...p })),
      fill: this.currentBrush.color,
      stroke: this.currentPen.color,
      strokeWidth: this.currentPen.width,
    });
    for (const p of points) this.updateBounds(p.x, p.y, p.x, p.y);
  }

  public recordPolyBezier(points: POINT[]): void {
    this.metafile.commands.push({
      type: "bezier",
      points: points.map((p) => ({ ...p })),
      fill: "none",
      stroke: this.currentPen.color,
      strokeWidth: this.currentPen.width,
    });
    for (const p of points) this.updateBounds(p.x, p.y, p.x, p.y);
  }

  public recordTextOut(x: number, y: number, text: string): void {
    this.metafile.commands.push({
      type: "text",
      text,
      x,
      y,
      color: this.textColor,
    });
    this.updateBounds(x, y, x + text.length * 8, y + 16);
  }

  public setPen(color: string, width: number): void {
    this.currentPen = { color, width: Math.max(1, width) };
  }

  public setBrush(color: string): void {
    this.currentBrush = { color };
  }

  public setTextColor(color: string): void {
    this.textColor = color;
  }

  private updateBounds(x1: number, y1: number, x2: number, y2: number): void {
    const minX = Math.min(x1, x2);
    const minY = Math.min(y1, y2);
    const maxX = Math.max(x1, x2);
    const maxY = Math.max(y1, y2);

    if (this.metafile.commands.length === 1) {
      this.metafile.bounds.left = minX;
      this.metafile.bounds.top = minY;
      this.metafile.bounds.right = maxX;
      this.metafile.bounds.bottom = maxY;
    } else {
      this.metafile.bounds.left = Math.min(this.metafile.bounds.left, minX);
      this.metafile.bounds.top = Math.min(this.metafile.bounds.top, minY);
      this.metafile.bounds.right = Math.max(this.metafile.bounds.right, maxX);
      this.metafile.bounds.bottom = Math.max(this.metafile.bounds.bottom, maxY);
    }
  }

  public close(): SvgMetafile {
    return this.metafile;
  }
}
