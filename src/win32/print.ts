import { HDC, type HBRUSH, type HPEN } from "./gdi";
import type { HWND, DOCINFO, PRINTDLG, POINT } from "./types";

import {
  WS_POPUP,
  WS_CAPTION,
  WS_SYSMENU,
  WS_CHILD,
  WS_VISIBLE,
  WS_OVERLAPPEDWINDOW,
  WS_THICKFRAME,
  WS_CLIPCHILDREN,
  SW_SHOW,
  MB_OK,
  IDOK,
  IDCANCEL,
  WM_COMMAND,
  WM_CLOSE,
  WM_DESTROY,
  LOWORD,
  PD_ALLPAGES,
  PD_PAGENUMS,
  PD_SELECTION,
  SP_ERROR,
} from "./constants";

export function setPrintKernelBridge(bridge: any): void {
  (globalThis as any).__printKernelBridge = bridge;
}

function getKernel(): any {
  return (globalThis as any).__printKernelBridge;
}




// Helper to create canvas (or in-memory mock if running in Node.js)
function createPageCanvas(width: number, height: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  if (typeof document !== "undefined" && typeof document.createElement === "function") {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d")!;
    return { canvas, ctx };
  }

  // Node.js test fallback mock
  const canvas: any = {
    width,
    height,
    toDataURL: () => "data:image/png;base64,mock",
  };
  const ctx: any = {
    save: () => {},
    restore: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => {},
    fill: () => {},
    fillRect: () => {},
    strokeRect: () => {},
    fillText: () => {},
    ellipse: () => {},
    measureText: (text: string) => ({ width: text.length * 7 }),
  };
  return { canvas, ctx };
}

export interface PrintPageRecord {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  pageNumber: number;
}

let nextJobId = 100;

/**
 * Printer Device Context (PrinterHDC)
 * Represents a Win32 printer DC created via CreateDC("WINSPOOL", ...)
 */
export class PrinterHDC extends HDC {
  public isPrinterDC = true;
  public printerName: string;
  public docInfo: DOCINFO | null = null;
  public pages: PrintPageRecord[] = [];
  public pageWidth: number = 816; // Standard Letter 8.5" at 96 DPI
  public pageHeight: number = 1056; // Standard Letter 11" at 96 DPI
  public inDoc: boolean = false;
  public inPage: boolean = false;
  public jobId: number = 0;

  constructor(printerName = "Generic / Text Only") {
    const initial = createPageCanvas(816, 1056);
    super(0, initial.canvas, initial.ctx);
    this.printerName = printerName;
  }
}

/**
 * Win32 CreateDC API
 * Supports printer driver ("WINSPOOL") or display driver.
 */
export function CreateDC(
  lpszDriver: string,
  lpszDevice?: string,
  _lpszOutput?: string,
  _lpInitData?: any
): HDC {
  const driverUpper = (lpszDriver || "").toUpperCase();
  if (driverUpper === "WINSPOOL" || driverUpper === "WINSPOOL.DRV" || driverUpper.includes("PRINT")) {
    return new PrinterHDC(lpszDevice || "Generic / Text Only");
  }

  // Return generic HDC
  const initial = createPageCanvas(800, 600);
  return new HDC(0, initial.canvas, initial.ctx);
}

/**
 * Win32 DeleteDC API
 */
export function DeleteDC(hdc: HDC): boolean {
  if (hdc instanceof PrinterHDC) {
    hdc.pages = [];
    hdc.inDoc = false;
    hdc.inPage = false;
  }
  return true;
}

/**
 * Win32 StartDoc API
 * Initiates a new print job.
 */
export function StartDoc(hdc: HDC, lpdi: DOCINFO): number {
  if (!(hdc instanceof PrinterHDC)) {
    return SP_ERROR;
  }

  hdc.jobId = ++nextJobId;
  hdc.docInfo = lpdi;
  hdc.pages = [];
  hdc.inDoc = true;
  hdc.inPage = false;
  return hdc.jobId;
}

/**
 * Win32 StartPage API
 * Allocates and prepares a new printable page canvas.
 */
export function StartPage(hdc: HDC): boolean {
  if (!(hdc instanceof PrinterHDC) || !hdc.inDoc) {
    return false;
  }

  const { canvas, ctx } = createPageCanvas(hdc.pageWidth, hdc.pageHeight);

  // Fill with crisp white paper
  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, hdc.pageWidth, hdc.pageHeight);
  ctx.restore();

  // Update current canvas and context on HDC
  hdc.canvas = canvas;
  hdc.ctx = ctx;
  hdc.currentPoint = { x: 0, y: 0 };
  hdc.currentBrush = { type: "brush", color: "#ffffff" };
  hdc.currentPen = { type: "pen", width: 1, color: "#000000" };
  hdc.textColor = "#000000";
  hdc.bkColor = "#ffffff";

  const pageNum = hdc.pages.length + 1;
  hdc.pages.push({ canvas, ctx, pageNumber: pageNum });
  hdc.inPage = true;
  return true;
}

/**
 * Win32 EndPage API
 * Commits the current printable page.
 */
export function EndPage(hdc: HDC): boolean {
  if (!(hdc instanceof PrinterHDC) || !hdc.inPage) {
    return false;
  }
  hdc.inPage = false;
  return true;
}

/**
 * Win32 EndDoc API
 * Completes document spooling.
 */
export function EndDoc(hdc: HDC): boolean {
  if (!(hdc instanceof PrinterHDC) || !hdc.inDoc) {
    return false;
  }
  hdc.inDoc = false;
  hdc.inPage = false;
  return true;
}

/**
 * Win32 AbortDoc API
 * Cancels active print job.
 */
export function AbortDoc(hdc: HDC): boolean {
  if (!(hdc instanceof PrinterHDC)) {
    return false;
  }
  hdc.inDoc = false;
  hdc.inPage = false;
  hdc.pages = [];
  return true;
}

/**
 * Injects pages into #win32-print-container and triggers native browser window.print()
 */
export function TriggerBrowserPrint(pages: HTMLCanvasElement[]): Promise<void> {
  return new Promise((resolve) => {
    if (typeof document === "undefined") {
      resolve();
      return;
    }

    let container = document.getElementById("win32-print-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "win32-print-container";
      document.body.appendChild(container);
    }
    container.innerHTML = "";

    pages.forEach((pageCanvas) => {
      const img = document.createElement("img");
      img.className = "win32-print-page";
      img.src = pageCanvas.toDataURL("image/png");
      container!.appendChild(img);
    });

    const cleanup = () => {
      if (container) container.innerHTML = "";
      window.removeEventListener("afterprint", cleanup);
      resolve();
    };

    window.addEventListener("afterprint", cleanup);

    // Give images a small tick to load data URLs before print dialog opens
    setTimeout(() => {
      window.print();
      // Fallback timeout in case onafterprint doesn't fire
      setTimeout(cleanup, 2000);
    }, 150);
  });
}

/**
 * Interactive Win32 Print Preview Window
 */
interface PrintPreviewState {
  pages: HTMLCanvasElement[];
  currentPage: number;
  zoom: number;
  title: string;
  hwndToolbar: HWND;
  hwndBody: HWND;
  onPrint?: () => void;
}

const printPreviewInstances = new Map<HWND, PrintPreviewState>();

export function StartPrintPreview(
  pages: HTMLCanvasElement[],
  title = "Document",
  onPrint?: () => void,
  x = 100,
  y = 60
): HWND {
  if (pages.length === 0) {
    const fallback = createPageCanvas(816, 1056);
    pages = [fallback.canvas];
  }

  const CLASS_NAME = "Win32PrintPreviewWindow";

  const IDC_PREV_PRINT = 9101;
  const IDC_PREV_NEXT = 9102;
  const IDC_PREV_PREV = 9103;
  const IDC_PREV_ZOOM_IN = 9104;
  const IDC_PREV_ZOOM_OUT = 9105;
  const IDC_PREV_CLOSE = 9106;
  const IDC_PREV_PAGE_LABEL = 9107;

  function updatePreviewDisplay(hwnd: HWND) {
    const state = printPreviewInstances.get(hwnd);
    const k = getKernel();
    if (!state || !k) return;

    // Update label
    const lbl = k.kernel?.getWindow(state.hwndToolbar);
    if (lbl) {
      k.SendMessage(IDC_PREV_PAGE_LABEL, 0x000c /* WM_SETTEXT */, 0, `Page ${state.currentPage + 1} of ${state.pages.length}`);
    }

    // Render page canvas into client body
    const bodyWin = k.kernel?.getWindow(state.hwndBody);
    if (bodyWin) {
      const pageCanvas = state.pages[state.currentPage];
      const scaledW = Math.round(pageCanvas.width * state.zoom);
      const scaledH = Math.round(pageCanvas.height * state.zoom);

      bodyWin.customProps = {
        ...bodyWin.customProps,
        pageDataUrl: pageCanvas.toDataURL("image/png"),
        scaledW,
        scaledH,
        zoomPercent: Math.round(state.zoom * 100),
      };
    }
  }

  function PrintPreviewWndProc(
    hwnd: HWND,
    uMsg: number,
    wParam: any,
    lParam: any
  ): any {
    const state = printPreviewInstances.get(hwnd);
    const k = getKernel();

    switch (uMsg) {
      case 0x0001: { // WM_CREATE
        if (!k) return 0;
        // 1. Top toolbar buttons
        const hwndPrintBtn = k.CreateWindowEx(0, "BUTTON", "Print...", WS_CHILD | WS_VISIBLE, 10, 8, 70, 24, hwnd, IDC_PREV_PRINT);
        const hwndPrevBtn = k.CreateWindowEx(0, "BUTTON", "< Prev", WS_CHILD | WS_VISIBLE, 86, 8, 60, 24, hwnd, IDC_PREV_PREV);
        const hwndNextBtn = k.CreateWindowEx(0, "BUTTON", "Next >", WS_CHILD | WS_VISIBLE, 152, 8, 60, 24, hwnd, IDC_PREV_NEXT);
        const hwndZoomIn = k.CreateWindowEx(0, "BUTTON", "Zoom In (+)", WS_CHILD | WS_VISIBLE, 222, 8, 80, 24, hwnd, IDC_PREV_ZOOM_IN);
        const hwndZoomOut = k.CreateWindowEx(0, "BUTTON", "Zoom Out (-)", WS_CHILD | WS_VISIBLE, 308, 8, 85, 24, hwnd, IDC_PREV_ZOOM_OUT);
        const hwndCloseBtn = k.CreateWindowEx(0, "BUTTON", "Close", WS_CHILD | WS_VISIBLE, 400, 8, 65, 24, hwnd, IDC_PREV_CLOSE);
        const hwndLabel = k.CreateWindowEx(0, "STATIC", `Page 1 of ${pages.length}`, WS_CHILD | WS_VISIBLE, 480, 12, 120, 20, hwnd, IDC_PREV_PAGE_LABEL);

        // 2. Client preview viewport container
        const hwndBody = k.CreateWindowEx(
          0,
          "STATIC",
          "",
          WS_CHILD | WS_VISIBLE,
          0,
          40,
          720,
          480,
          hwnd,
          9199,
          null,
          null
        );

        const previewState: PrintPreviewState = {
          pages,
          currentPage: 0,
          zoom: 0.55,
          title,
          hwndToolbar: hwndLabel,
          hwndBody,
          onPrint,
        };
        printPreviewInstances.set(hwnd, previewState);
        updatePreviewDisplay(hwnd);
        return 0;
      }

      case WM_COMMAND: {
        if (!state) return 0;
        const cmdId = LOWORD(wParam);

        switch (cmdId) {
          case IDC_PREV_PRINT:
            if (state.onPrint) {
              state.onPrint();
            } else {
              TriggerBrowserPrint(state.pages);
            }
            return 0;

          case IDC_PREV_NEXT:
            if (state.currentPage < state.pages.length - 1) {
              state.currentPage++;
              updatePreviewDisplay(hwnd);
            }
            return 0;

          case IDC_PREV_PREV:
            if (state.currentPage > 0) {
              state.currentPage--;
              updatePreviewDisplay(hwnd);
            }
            return 0;

          case IDC_PREV_ZOOM_IN:
            state.zoom = Math.min(1.5, state.zoom + 0.15);
            updatePreviewDisplay(hwnd);
            return 0;

          case IDC_PREV_ZOOM_OUT:
            state.zoom = Math.max(0.3, state.zoom - 0.15);
            updatePreviewDisplay(hwnd);
            return 0;

          case IDC_PREV_CLOSE:
            k?.DefWindowProc(hwnd, WM_CLOSE, 0, 0);
            return 0;
        }
        return 0;
      }

      case WM_DESTROY: {
        printPreviewInstances.delete(hwnd);
        return 0;
      }
    }

    return k ? k.DefWindowProc(hwnd, uMsg, wParam, lParam) : 0;
  }

  const k = getKernel();
  if (!k) {
    return 0;
  }

  k.RegisterClassEx({
    className: CLASS_NAME,
    lpfnWndProc: PrintPreviewWndProc,
  });

  const hwnd = k.CreateWindowEx(
    0,
    CLASS_NAME,
    `Print Preview - ${title}`,
    WS_OVERLAPPEDWINDOW | WS_VISIBLE | WS_THICKFRAME | WS_CLIPCHILDREN,
    x,
    y,
    730,
    550,
    null,
    null
  );

  k.ShowWindow(hwnd, SW_SHOW);
  return hwnd;
}

/**
 * Win32 PrintDlg Common Dialog API
 * Displays the standard Windows 98 Print Dialog.
 */
export function PrintDlg(lppd: PRINTDLG): Promise<boolean> {
  return new Promise((resolve) => {
    const k = getKernel();
    if (!k) {
      resolve(true);
      return;
    }



    const CLASS_NAME = "Win32PrintDialogBox";
    const IDD_PRINTER_COMBO = 1001;
    const IDD_RADIO_ALL = 1002;
    const IDD_RADIO_PAGES = 1003;
    const IDD_COPIES_EDIT = 1004;

    const availablePrinters = [
      "Browser Print (window.print)",
      "Print Preview Window",
      "HP LaserJet 4",
      "Generic / Text Only",
    ];

    let selectedPrinter = lppd.printerName || availablePrinters[0];
    let copies = lppd.nCopies || 1;
    let rangeFlag = lppd.flags || PD_ALLPAGES;

    function PrintDlgProc(
      hwnd: HWND,
      uMsg: number,
      wParam: any,
      _lParam: any
    ): any {
      switch (uMsg) {
        case 0x0001: { // WM_CREATE
          // Printer Group
          k.CreateWindowEx(0, "BUTTON", "Printer", WS_CHILD | WS_VISIBLE | 0x00000007 /* BS_GROUPBOX */, 12, 10, 360, 95, hwnd, 1101);
          k.CreateWindowEx(0, "STATIC", "Name:", WS_CHILD | WS_VISIBLE, 24, 34, 45, 18, hwnd, 1102);
          const hCombo = k.CreateWindowEx(0, "COMBOBOX", selectedPrinter, WS_CHILD | WS_VISIBLE, 75, 30, 280, 22, hwnd, IDD_PRINTER_COMBO);
          k.SendMessage(hCombo, 0x0143 /* CB_ADDSTRING */, 0, availablePrinters[0]);
          k.SendMessage(hCombo, 0x0143, 0, availablePrinters[1]);
          k.SendMessage(hCombo, 0x0143, 0, availablePrinters[2]);
          k.SendMessage(hCombo, 0x0143, 0, availablePrinters[3]);

          k.CreateWindowEx(0, "STATIC", "Status: Ready", WS_CHILD | WS_VISIBLE, 24, 60, 150, 18, hwnd, 1103);
          k.CreateWindowEx(0, "STATIC", "Type: Local Print Driver", WS_CHILD | WS_VISIBLE, 24, 80, 200, 18, hwnd, 1104);

          // Print Range Group
          k.CreateWindowEx(0, "BUTTON", "Print range", WS_CHILD | WS_VISIBLE | 0x00000007 /* BS_GROUPBOX */, 12, 115, 200, 85, hwnd, 1105);
          k.CreateWindowEx(0, "BUTTON", "All", WS_CHILD | WS_VISIBLE | 0x00000009 /* BS_AUTORADIOBUTTON */, 24, 138, 160, 20, hwnd, IDD_RADIO_ALL);
          k.CreateWindowEx(0, "BUTTON", "Pages", WS_CHILD | WS_VISIBLE | 0x00000009 /* BS_AUTORADIOBUTTON */, 24, 165, 160, 20, hwnd, IDD_RADIO_PAGES);

          // Copies Group
          k.CreateWindowEx(0, "BUTTON", "Copies", WS_CHILD | WS_VISIBLE | 0x00000007 /* BS_GROUPBOX */, 222, 115, 150, 85, hwnd, 1106);
          k.CreateWindowEx(0, "STATIC", "Number of copies:", WS_CHILD | WS_VISIBLE, 234, 138, 120, 18, hwnd, 1107);
          k.CreateWindowEx(0, "EDIT", `${copies}`, WS_CHILD | WS_VISIBLE, 234, 162, 60, 22, hwnd, IDD_COPIES_EDIT);

          // OK / Cancel buttons
          k.CreateWindowEx(0, "BUTTON", "OK", WS_CHILD | WS_VISIBLE | 0x00000001 /* BS_DEFPUSHBUTTON */, 205, 215, 78, 24, hwnd, IDOK);
          k.CreateWindowEx(0, "BUTTON", "Cancel", WS_CHILD | WS_VISIBLE, 294, 215, 78, 24, hwnd, IDCANCEL);
          return 0;
        }

        case WM_COMMAND: {
          const cmdId = LOWORD(wParam);
          if (cmdId === IDOK) {
            lppd.printerName = selectedPrinter;
            lppd.nCopies = copies;
            lppd.flags = rangeFlag;
            k.DestroyWindow(hwnd);
            resolve(true);
            return 0;
          }
          if (cmdId === IDCANCEL) {
            k.DestroyWindow(hwnd);
            resolve(false);
            return 0;
          }
          return 0;
        }

        case WM_CLOSE: {
          k.DestroyWindow(hwnd);
          resolve(false);
          return 0;
        }
      }
      return k.DefWindowProc(hwnd, uMsg, wParam, _lParam);
    }

    k.RegisterClassEx({
      className: CLASS_NAME,
      lpfnWndProc: PrintDlgProc,
    });

    const hwndDlg = k.CreateWindowEx(
      0,
      CLASS_NAME,
      "Print",
      WS_POPUP | WS_CAPTION | WS_SYSMENU | WS_VISIBLE,
      250,
      140,
      395,
      280,
      lppd.hwndOwner ?? null,
      null
    );

    k.ShowWindow(hwndDlg, SW_SHOW);
  });
}


/**
 * High-Level Text Document Print & Preview Routine
 * Formats multi-page plain text documents with headers, footers, line wrapping, and margins.
 */
export async function PrintTextDocument(
  text: string,
  title = "Untitled",
  mode: "dialog" | "print" | "preview" = "dialog"
): Promise<void> {
  let printerName = "Generic / Text Only";
  let targetAction = mode;

  if (mode === "dialog") {
    const pd: PRINTDLG = {
      printerName: "Browser Print (window.print)",
      nCopies: 1,
      flags: PD_ALLPAGES,
    };
    const confirmed = await PrintDlg(pd);
    if (!confirmed) return;

    printerName = pd.printerName || "Generic / Text Only";
    targetAction = printerName.includes("Preview") ? "preview" : "print";
  }

  // 1. Spool document via Win32 Printer DC
  const hdc = CreateDC("WINSPOOL", printerName) as PrinterHDC;
  StartDoc(hdc, { lpszDocName: title });

  const rawLines = text.split(/\r?\n/);
  const leftMargin = 50;
  const rightMargin = 50;
  const topMargin = 60;
  const bottomMargin = 60;
  const lineHeight = 16;
  const printableHeight = hdc.pageHeight - topMargin - bottomMargin;
  const linesPerPage = Math.floor(printableHeight / lineHeight) - 4; // reserve space for header/footer

  const totalPages = Math.max(1, Math.ceil(rawLines.length / linesPerPage));

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    StartPage(hdc);

    const ctx = hdc.ctx;

    // Header: Document Title & Date
    ctx.save();
    ctx.font = 'bold 12px "MS Sans Serif", Tahoma, sans-serif';
    ctx.fillStyle = "#000000";
    ctx.fillText(title, leftMargin, topMargin - 25);

    const dateStr = new Date().toLocaleDateString();
    const dateWidth = ctx.measureText ? ctx.measureText(dateStr).width : 60;
    ctx.fillText(dateStr, hdc.pageWidth - rightMargin - dateWidth, topMargin - 25);

    // Header divider line
    ctx.strokeStyle = "#808080";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(leftMargin, topMargin - 15);
    ctx.lineTo(hdc.pageWidth - rightMargin, topMargin - 15);
    ctx.stroke();

    // Body Text Lines
    ctx.font = '12px "Courier New", Courier, monospace';
    ctx.fillStyle = "#000000";
    const startLine = pageIdx * linesPerPage;
    const endLine = Math.min(rawLines.length, startLine + linesPerPage);

    let currentY = topMargin;
    for (let l = startLine; l < endLine; l++) {
      ctx.fillText(rawLines[l] || " ", leftMargin, currentY);
      currentY += lineHeight;
    }

    // Footer divider line & Page numbering
    ctx.beginPath();
    ctx.moveTo(leftMargin, hdc.pageHeight - bottomMargin + 10);
    ctx.lineTo(hdc.pageWidth - rightMargin, hdc.pageHeight - bottomMargin + 10);
    ctx.stroke();

    ctx.font = '11px "MS Sans Serif", Tahoma, sans-serif';
    const footerStr = `Page ${pageIdx + 1} of ${totalPages}`;
    const footerW = ctx.measureText ? ctx.measureText(footerStr).width : 60;
    ctx.fillText(footerStr, (hdc.pageWidth - footerW) / 2, hdc.pageHeight - bottomMargin + 25);
    ctx.restore();

    EndPage(hdc);
  }

  EndDoc(hdc);

  const pageCanvases = hdc.pages.map((p) => p.canvas);

  if (targetAction === "preview") {
    StartPrintPreview(pageCanvases, title, () => TriggerBrowserPrint(pageCanvases));
  } else {
    await TriggerBrowserPrint(pageCanvases);
  }
}

/**
 * High-Level Canvas / GDI Graphics Print & Preview Routine
 * Scales a graphical canvas drawing onto a centered printable page with header & borders.
 */
export async function PrintCanvasGraphics(
  sourceCanvas: HTMLCanvasElement,
  title = "Drawing",
  mode: "dialog" | "print" | "preview" = "dialog"
): Promise<void> {
  let printerName = "Generic / Text Only";
  let targetAction = mode;

  if (mode === "dialog") {
    const pd: PRINTDLG = {
      printerName: "Browser Print (window.print)",
      nCopies: 1,
      flags: PD_ALLPAGES,
    };
    const confirmed = await PrintDlg(pd);
    if (!confirmed) return;

    printerName = pd.printerName || "Generic / Text Only";
    targetAction = printerName.includes("Preview") ? "preview" : "print";
  }

  const hdc = CreateDC("WINSPOOL", printerName) as PrinterHDC;
  StartDoc(hdc, { lpszDocName: title });
  StartPage(hdc);

  const ctx = hdc.ctx;
  const margin = 50;
  const availableW = hdc.pageWidth - margin * 2;
  const availableH = hdc.pageHeight - margin * 2 - 50;

  // Header
  ctx.save();
  ctx.font = 'bold 14px "MS Sans Serif", Tahoma, sans-serif';
  ctx.fillStyle = "#000000";
  ctx.fillText(title, margin, margin);

  const dateStr = new Date().toLocaleString();
  const dateW = ctx.measureText ? ctx.measureText(dateStr).width : 80;
  ctx.fillText(dateStr, hdc.pageWidth - margin - dateW, margin);

  ctx.strokeStyle = "#808080";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(margin, margin + 12);
  ctx.lineTo(hdc.pageWidth - margin, margin + 12);
  ctx.stroke();

  // Scale and center source canvas into printable area
  const scale = Math.min(availableW / sourceCanvas.width, availableH / sourceCanvas.height, 1.5);
  const destW = sourceCanvas.width * scale;
  const destH = sourceCanvas.height * scale;
  const destX = margin + (availableW - destW) / 2;
  const destY = margin + 30 + (availableH - destH) / 2;

  // Draw bordered frame around drawing
  ctx.strokeStyle = "#000000";
  ctx.strokeRect(destX - 1, destY - 1, destW + 2, destH + 2);

  // Draw image
  try {
    ctx.drawImage(sourceCanvas, destX, destY, destW, destH);
  } catch (err) {
    console.warn("Could not draw canvas directly, drawing placeholder:", err);
  }

  // Footer
  ctx.font = '11px "MS Sans Serif", Tahoma, sans-serif';
  const footerStr = "Printed from win32-svelte GDI Paint";
  const footerW = ctx.measureText ? ctx.measureText(footerStr).width : 120;
  ctx.fillText(footerStr, (hdc.pageWidth - footerW) / 2, hdc.pageHeight - 30);
  ctx.restore();

  EndPage(hdc);
  EndDoc(hdc);

  const pageCanvases = hdc.pages.map((p) => p.canvas);

  if (targetAction === "preview") {
    StartPrintPreview(pageCanvases, title, () => TriggerBrowserPrint(pageCanvases));
  } else {
    await TriggerBrowserPrint(pageCanvases);
  }
}
