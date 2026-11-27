export interface FontDialogStyle {
  label: string;
  bold: boolean;
  italic: boolean;
}

export const FONT_FAMILY_CANDIDATES: string[] = [
  "Arial",
  "Arial Black",
  "Comic Sans MS",
  "Courier New",
  "Georgia",
  "Impact",
  "Lucida Console",
  "Marlett",
  "MS Sans Serif",
  "MS Serif",
  "Palatino Linotype",
  "Segoe UI",
  "Symbol",
  "Tahoma",
  "Times New Roman",
  "Trebuchet MS",
  "Verdana",
  "Webdings",
  "Wingdings",
  "cursive",
  "fantasy",
  "monospace",
  "sans-serif",
  "serif",
];

export const FONT_POINT_SIZES: number[] = [
  8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72,
];

export const FONT_STYLES: FontDialogStyle[] = [
  { label: "Regular", bold: false, italic: false },
  { label: "Italic", bold: false, italic: true },
  { label: "Bold", bold: true, italic: false },
  { label: "Bold Italic", bold: true, italic: true },
];

export const DEFAULT_FONT_FAMILY = "MS Sans Serif";
export const DEFAULT_FONT_POINT_SIZE = 10;

export const POINTS_PER_INCH = 72;
export const SCREEN_DPI = 96;

export function pointSizeToLogicalHeight(pointSize: number): number {
  return -Math.round((pointSize * SCREEN_DPI) / POINTS_PER_INCH);
}

export function logicalHeightToPointSize(lfHeight: number): number {
  const height = Math.abs(lfHeight);
  if (height === 0) return DEFAULT_FONT_POINT_SIZE;
  return Math.round((height * POINTS_PER_INCH) / SCREEN_DPI);
}

export function styleLabelFor(bold: boolean, italic: boolean): string {
  for (const style of FONT_STYLES) {
    if (style.bold === bold && style.italic === italic) return style.label;
  }
  return FONT_STYLES[0].label;
}

export function clampPointSize(pointSize: number, minSize?: number, maxSize?: number): number {
  let clamped = pointSize;
  if (minSize !== undefined && minSize > 0) clamped = Math.max(clamped, minSize);
  if (maxSize !== undefined && maxSize > 0) clamped = Math.min(clamped, maxSize);
  return clamped;
}

export function nearestPointSize(pointSize: number, minSize?: number, maxSize?: number): number {
  if (FONT_POINT_SIZES.includes(pointSize)) {
    return clampPointSize(pointSize, minSize, maxSize);
  }
  let best = FONT_POINT_SIZES[0];
  for (const candidate of FONT_POINT_SIZES) {
    if (Math.abs(candidate - pointSize) < Math.abs(best - pointSize)) {
      best = candidate;
    }
  }
  return clampPointSize(best, minSize, maxSize);
}

export const FONT_PROBE_TEXT = "WmMmWWmmilil 1.23";
export const FONT_PROBE_SIZE_PX = 100;
export const FONT_PROBE_FALLBACK_STACK = '"__font_probe_missing__", monospace';
export const FONT_PROBE_TOLERANCE_PX = 0.5;

export function measureAvailableFontFamilies(
  measure: (familyList: string) => number,
  candidates: string[] = FONT_FAMILY_CANDIDATES
): string[] {
  const baseline = measure(FONT_PROBE_FALLBACK_STACK);
  const available: string[] = [];
  for (const family of candidates) {
    const width = measure(`'${family}', ${FONT_PROBE_FALLBACK_STACK}`);
    if (Math.abs(width - baseline) > FONT_PROBE_TOLERANCE_PX) {
      available.push(family);
    }
  }
  if (available.length === 0) {
    return ["MS Sans Serif", "sans-serif", "serif", "monospace"];
  }
  return available;
}

export function makeCanvasFontMeasurer(
  context: CanvasRenderingContext2D,
  probeText: string = FONT_PROBE_TEXT,
  sizePx: number = FONT_PROBE_SIZE_PX
): (familyList: string) => number {
  return (familyList: string) => {
    context.font = `${sizePx}px ${familyList}`;
    return context.measureText(probeText).width;
  };
}
