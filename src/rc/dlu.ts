import type { DialogFont } from "./types.ts";

export interface DialogRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * Converts Dialog Template Units (DLUs) to horizontal pixels.
 * Based on classic Windows 95/98 font metrics (8pt MS Sans Serif: ~7x14px).
 */
export function dluToPixelsX(dlu: number, font?: DialogFont): number {
  const pointSize = font?.pointSize ?? 8;
  const baseUnitX = Math.max(4, Math.round(pointSize * 0.85)); // ~7 for 8pt
  return Math.round((dlu * baseUnitX) / 4);
}

/**
 * Converts Dialog Template Units (DLUs) to vertical pixels.
 */
export function dluToPixelsY(dlu: number, font?: DialogFont): number {
  const pointSize = font?.pointSize ?? 8;
  const baseUnitY = Math.max(8, Math.round(pointSize * 1.75)); // ~14 for 8pt
  return Math.round((dlu * baseUnitY) / 8);
}

/**
 * Maps a dialog coordinate rectangle to screen pixels.
 */
export function mapDialogRect(rect: DialogRect, font?: DialogFont): DialogRect {
  return {
    left: dluToPixelsX(rect.left, font),
    top: dluToPixelsY(rect.top, font),
    right: dluToPixelsX(rect.right, font),
    bottom: dluToPixelsY(rect.bottom, font),
  };
}
