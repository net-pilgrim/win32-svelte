import {
  kernel,
  RegisterClassEx,
  CreateWindowEx,
  ShowWindow,
  DefWindowProc,
  SendMessage,
  PostQuitMessage,
  SetWindowText,
  MessageBox,
  CreateMenu,
  CreatePopupMenu,
  AppendMenu,
  SetMenu,
  DragAcceptFiles,
  DragQueryFile,
  DragFinish,
  vfs,
} from "../win32/kernel.svelte";

import {
  WM_CREATE,
  WM_SIZE,
  WM_PAINT,
  WM_COMMAND,
  WM_DROPFILES,
  WM_DESTROY,
  WS_OVERLAPPEDWINDOW,
  WS_VISIBLE,
  WS_CHILD,
  WS_THICKFRAME,
  MF_STRING,
  MF_POPUP,
  MF_SEPARATOR,
  DRAGQUERY_ALLFILES,
  LOWORD,
  MB_OK,
  MB_ICONASTERISK,
  SW_SHOW,
  STATUSCLASSNAME,
  SB_SETTEXT,
  SB_SETPARTS,
} from "../win32/constants";

import { BeginPaint, EndPaint, InvalidateRect } from "../win32/gdi";
import type { HWND, UINT, WPARAM, LPARAM, LRESULT, HDROP, DropFileInfo } from "../win32/types";
import { SvgMetafile, parseEmfToSvg, parseWmfToSvg, type MetafileBounds } from "../win32/metafile_svg";

const IDM_FILE_OPEN = 4101;
const IDM_FILE_SAVE_SVG = 4102;
const IDM_FILE_EXPORT_PNG = 4103;
const IDM_FILE_CLOSE = 4104;

const IDM_VIEW_ZOOM_IN = 4201;
const IDM_VIEW_ZOOM_OUT = 4202;
const IDM_VIEW_ZOOM_100 = 4203;
const IDM_VIEW_ZOOM_FIT = 4204;
const IDM_VIEW_GRID = 4205;
const IDM_VIEW_COPY_SVG = 4206;
const IDM_VIEW_SOURCE = 4207;

const IDM_HELP_ABOUT = 4301;

const IDC_VIEWER_STATUS = 4401;

interface ViewerState {
  hwnd: HWND;
  hwndStatus: HWND;
  filePath: string | null;
  fileName: string;
  metafile: SvgMetafile | null;
  zoom: number; // 1.0 = 100%, 0 = fit to window
  showGrid: boolean;
}

const viewerInstances = new Map<HWND, ViewerState>();

function createDefaultDemoMetafile(): SvgMetafile {
  const mf = new SvgMetafile(
    "enhmetafile",
    { left: 0, top: 0, right: 600, bottom: 400 },
    { left: 0, top: 0, right: 15240, bottom: 10160 },
    "demo.emf",
    "Win32 SVG Vector Metafile Demo"
  );

  // Background card
  mf.commands.push({
    type: "rect",
    x: 20,
    y: 20,
    w: 560,
    h: 360,
    fill: "#f8f9fa",
    stroke: "#333333",
    strokeWidth: 2,
    rx: 8,
  });

  // Header banner
  mf.commands.push({
    type: "rect",
    x: 40,
    y: 40,
    w: 520,
    h: 60,
    fill: "#004080",
    stroke: "#002040",
    strokeWidth: 1,
    rx: 4,
  });

  mf.commands.push({
    type: "text",
    x: 60,
    y: 60,
    text: "Windows Metafile (SVG Vector Engine)",
    color: "#ffffff",
    fontSize: 18,
  });

  // Vector graphics demo shapes
  mf.commands.push({
    type: "ellipse",
    cx: 140,
    cy: 220,
    rx: 70,
    ry: 70,
    fill: "#4dabf7",
    stroke: "#1864ab",
    strokeWidth: 3,
  });

  mf.commands.push({
    type: "rect",
    x: 260,
    y: 150,
    w: 120,
    h: 140,
    fill: "#ff922b",
    stroke: "#d9480f",
    strokeWidth: 3,
    rx: 10,
  });

  // PolyBezier curve
  mf.commands.push({
    type: "bezier",
    points: [
      { x: 420, y: 280 },
      { x: 440, y: 140 },
      { x: 520, y: 160 },
      { x: 540, y: 280 },
    ],
    fill: "none",
    stroke: "#2f9e44",
    strokeWidth: 4,
  });

  // Ruler ticks
  for (let i = 0; i <= 20; i++) {
    const x = 50 + i * 25;
    const h = i % 5 === 0 ? 20 : 10;
    mf.commands.push({
      type: "line",
      x1: x,
      y1: 330,
      x2: x,
      y2: 330 + h,
      stroke: "#495057",
      strokeWidth: i % 5 === 0 ? 2 : 1,
    });
  }

  return mf;
}

async function loadMetafileData(state: ViewerState, data: Uint8Array, name: string): Promise<void> {
  try {
    let parsed: SvgMetafile;
    const isWmf = name.toLowerCase().endsWith(".wmf");
    if (isWmf) {
      parsed = parseWmfToSvg(data, name);
    } else {
      parsed = parseEmfToSvg(data, name);
    }
    state.metafile = parsed;
    state.fileName = name;

    const w = Math.max(1, Math.abs(parsed.bounds.right - parsed.bounds.left));
    const h = Math.max(1, Math.abs(parsed.bounds.bottom - parsed.bounds.top));
    const typeLabel = parsed.type === "enhmetafile" ? "32-bit EMF" : "16-bit WMF";
    const statusText = `${name} | ${typeLabel} | ${w} × ${h} px | ${parsed.commands.length} vector commands`;

    SetWindowText(state.hwnd, `${name} - Vector Metafile Viewer (SVG)`);
    SendMessage(state.hwndStatus, SB_SETTEXT, 0, statusText);
    InvalidateRect(state.hwnd, null, true);
  } catch (err: any) {
    MessageBox(state.hwnd, `Error loading vector metafile: ${err?.message || err}`, "Viewer Error", MB_OK);
  }
}

async function openMetafilePath(state: ViewerState, path: string): Promise<void> {
  state.filePath = path;
  const name = path.split("\\").pop() || path.split("/").pop() || "metafile.emf";

  try {
    const bytes = await vfs.readBinaryFile(path);
    await loadMetafileData(state, bytes, name);
  } catch {
    // If not found in VFS, try fetching from /wasm-files/
    if (typeof fetch !== "undefined") {
      try {
        const resp = await fetch(`/wasm-files/${name}`);
        if (resp.ok) {
          const buf = await resp.arrayBuffer();
          await loadMetafileData(state, new Uint8Array(buf), name);
          return;
        }
      } catch {}
    }
    // Fallback to demo metafile
    state.metafile = createDefaultDemoMetafile();
    InvalidateRect(state.hwnd, null, true);
  }
}

function MetafileViewerWndProc(
  hwnd: HWND,
  uMsg: UINT,
  wParam: WPARAM,
  lParam: LPARAM
): LRESULT {
  const state = viewerInstances.get(hwnd);

  switch (uMsg) {
    case WM_CREATE: {
      // 1. Menu Bar
      const hMenuBar = CreateMenu();

      const hMenuFile = CreatePopupMenu();
      AppendMenu(hMenuFile, MF_STRING, IDM_FILE_OPEN, "&Open...\tCtrl+O");
      AppendMenu(hMenuFile, MF_STRING, IDM_FILE_SAVE_SVG, "&Export SVG...\tCtrl+S");
      AppendMenu(hMenuFile, MF_STRING, IDM_FILE_EXPORT_PNG, "Export &PNG Bitmap...");
      AppendMenu(hMenuFile, MF_SEPARATOR, 0, "");
      AppendMenu(hMenuFile, MF_STRING, IDM_FILE_CLOSE, "E&xit");
      AppendMenu(hMenuBar, MF_POPUP, hMenuFile, "&File");

      const hMenuView = CreatePopupMenu();
      AppendMenu(hMenuView, MF_STRING, IDM_VIEW_ZOOM_IN, "Zoom &In (+)");
      AppendMenu(hMenuView, MF_STRING, IDM_VIEW_ZOOM_OUT, "Zoom &Out (-)");
      AppendMenu(hMenuView, MF_STRING, IDM_VIEW_ZOOM_100, "&Actual Size (100%)");
      AppendMenu(hMenuView, MF_STRING, IDM_VIEW_ZOOM_FIT, "&Fit to Window");
      AppendMenu(hMenuView, MF_SEPARATOR, 0, "");
      AppendMenu(hMenuView, MF_STRING, IDM_VIEW_GRID, "Toggle Background &Grid");
      AppendMenu(hMenuView, MF_STRING, IDM_VIEW_COPY_SVG, "&Copy SVG XML to Clipboard");
      AppendMenu(hMenuView, MF_STRING, IDM_VIEW_SOURCE, "View SVG &Source in Notepad");
      AppendMenu(hMenuBar, MF_POPUP, hMenuView, "&View");

      const hMenuHelp = CreatePopupMenu();
      AppendMenu(hMenuHelp, MF_STRING, IDM_HELP_ABOUT, "&About Vector Metafile Viewer");
      AppendMenu(hMenuBar, MF_POPUP, hMenuHelp, "&Help");

      SetMenu(hwnd, hMenuBar);

      // 2. Status Bar
      const hwndStatus = CreateWindowEx(
        0,
        STATUSCLASSNAME,
        "Ready",
        WS_CHILD | WS_VISIBLE,
        4,
        418,
        620,
        22,
        hwnd,
        IDC_VIEWER_STATUS
      );
      SendMessage(hwndStatus, SB_SETPARTS, 2, [360, -1]);

      const newState: ViewerState = {
        hwnd,
        hwndStatus,
        filePath: null,
        fileName: "demo.emf",
        metafile: createDefaultDemoMetafile(),
        zoom: 0, // 0 = Fit to window
        showGrid: true,
      };

      viewerInstances.set(hwnd, newState);
      DragAcceptFiles(hwnd, true);
      return 0;
    }

    case WM_SIZE: {
      if (state) {
        InvalidateRect(hwnd, null, true);
      }
      return 0;
    }

    case WM_PAINT: {
      if (!state || !state.metafile) return 0;
      let hdc: any;
      try {
        hdc = BeginPaint(hwnd);
      } catch {
        return 0;
      }
      const ctx = hdc?.ctx;
      if (!ctx) {
        EndPaint(hwnd, {} as any);
        return 0;
      }

      const canvas = hdc.canvas;
      const cw = canvas.width || 600;
      const ch = Math.max(10, (canvas.height || 400) - 24); // Reserve bottom for status bar

      // Background
      ctx.fillStyle = state.showGrid ? "#e9ecef" : "#ffffff";
      ctx.fillRect(0, 0, cw, ch);

      // Subtle checkered pattern if grid enabled
      if (state.showGrid) {
        ctx.fillStyle = "#dee2e6";
        const step = 20;
        for (let x = 0; x < cw; x += step * 2) {
          for (let y = 0; y < ch; y += step * 2) {
            ctx.fillRect(x, y, step, step);
            ctx.fillRect(x + step, y + step, step, step);
          }
        }
      }

      // Compute vector viewport destination rect
      const b = state.metafile.bounds;
      const srcW = Math.max(1, Math.abs(b.right - b.left));
      const srcH = Math.max(1, Math.abs(b.bottom - b.top));

      let dstW = srcW;
      let dstH = srcH;

      if (state.zoom === 0) {
        // Fit to window with 20px margin
        const availW = Math.max(20, cw - 40);
        const availH = Math.max(20, ch - 40);
        const ratio = Math.min(availW / srcW, availH / srcH);
        dstW = Math.round(srcW * ratio);
        dstH = Math.round(srcH * ratio);
      } else {
        dstW = Math.round(srcW * state.zoom);
        dstH = Math.round(srcH * state.zoom);
      }

      const dstX = Math.round((cw - dstW) / 2);
      const dstY = Math.round((ch - dstH) / 2);

      // Drop shadow for metafile paper
      ctx.save();
      ctx.shadowColor = "rgba(0, 0, 0, 0.25)";
      ctx.shadowBlur = 8;
      ctx.shadowOffsetX = 3;
      ctx.shadowOffsetY = 3;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(dstX, dstY, dstW, dstH);
      ctx.restore();

      // Render vector metafile directly using affine transforms
      const destRect: MetafileBounds = {
        left: dstX,
        top: dstY,
        right: dstX + dstW,
        bottom: dstY + dstH,
      };

      state.metafile.renderToCanvas(ctx, destRect);

      EndPaint(hwnd, {} as any);
      return 0;
    }

    case WM_DROPFILES: {
      const hDrop = wParam as HDROP;
      if (!state) return 0;
      const count = DragQueryFile(hDrop, DRAGQUERY_ALLFILES) as number;
      if (count > 0) {
        const file = DragQueryFile(hDrop, 0) as DropFileInfo;
        if (file) {
          if (file.content instanceof Uint8Array) {
            loadMetafileData(state, file.content, file.name);
          } else if (typeof file.content === "string") {
            const bytes = new TextEncoder().encode(file.content);
            loadMetafileData(state, bytes, file.name);
          }
        }
      }
      DragFinish(hDrop);
      return 0;
    }

    case WM_COMMAND: {
      const cmdId = LOWORD(wParam);
      if (!state) return 0;

      switch (cmdId) {
        case IDM_FILE_OPEN: {
          const path = typeof window !== "undefined"
            ? window.prompt("Enter metafile path (e.g. C:\\wasm-files\\emf2.emf):", state.filePath || "C:\\wasm-files\\emf8.emf")
            : null;
          if (path) {
            openMetafilePath(state, path);
          }
          break;
        }

        case IDM_FILE_SAVE_SVG: {
          if (!state.metafile) break;
          const svgMarkup = state.metafile.toSvg();
          const svgName = `${state.fileName.replace(/\.(emf|wmf)$/i, "")}.svg`;
          const blob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = svgName;
          a.click();
          URL.revokeObjectURL(url);
          SendMessage(state.hwndStatus, SB_SETTEXT, 1, `Saved ${svgName}`);
          break;
        }

        case IDM_FILE_EXPORT_PNG: {
          if (!state.metafile) break;
          const canvas = state.metafile.canvas;
          const pngName = `${state.fileName.replace(/\.(emf|wmf)$/i, "")}.png`;
          if (canvas && typeof canvas.toDataURL === "function") {
            const url = canvas.toDataURL("image/png");
            const a = document.createElement("a");
            a.href = url;
            a.download = pngName;
            a.click();
            SendMessage(state.hwndStatus, SB_SETTEXT, 1, `Exported ${pngName}`);
          }
          break;
        }

        case IDM_FILE_CLOSE:
          PostQuitMessage(0);
          break;

        case IDM_VIEW_ZOOM_IN:
          state.zoom = state.zoom === 0 ? 1.5 : Math.min(8.0, state.zoom * 1.5);
          SendMessage(state.hwndStatus, SB_SETTEXT, 1, `Zoom: ${Math.round(state.zoom * 100)}%`);
          InvalidateRect(hwnd, null, true);
          break;

        case IDM_VIEW_ZOOM_OUT:
          state.zoom = state.zoom === 0 ? 0.75 : Math.max(0.2, state.zoom / 1.5);
          SendMessage(state.hwndStatus, SB_SETTEXT, 1, `Zoom: ${Math.round(state.zoom * 100)}%`);
          InvalidateRect(hwnd, null, true);
          break;

        case IDM_VIEW_ZOOM_100:
          state.zoom = 1.0;
          SendMessage(state.hwndStatus, SB_SETTEXT, 1, "Zoom: 100%");
          InvalidateRect(hwnd, null, true);
          break;

        case IDM_VIEW_ZOOM_FIT:
          state.zoom = 0;
          SendMessage(state.hwndStatus, SB_SETTEXT, 1, "Zoom: Fit to Window");
          InvalidateRect(hwnd, null, true);
          break;

        case IDM_VIEW_GRID:
          state.showGrid = !state.showGrid;
          InvalidateRect(hwnd, null, true);
          break;

        case IDM_VIEW_COPY_SVG: {
          if (!state.metafile) break;
          const svg = state.metafile.toSvg();
          if (typeof navigator !== "undefined" && navigator.clipboard) {
            navigator.clipboard.writeText(svg).then(() => {
              SendMessage(state.hwndStatus, SB_SETTEXT, 1, "SVG copied to clipboard!");
            });
          }
          break;
        }

        case IDM_VIEW_SOURCE: {
          if (!state.metafile) break;
          const svg = state.metafile.toSvg();
          import("./notepad").then(({ StartNotepad }) => {
            const hNotepad = StartNotepad(320, 120);
            vfs.writeTextFile("C:\\My Documents\\metafile_source.svg", svg).then(() => {
              import("../win32/kernel.svelte").then(({ SendMessage }) => {
                SendMessage(hNotepad, WM_COMMAND, 3102 /* ID_FILE_OPEN */, 0);
              });
            });
          });
          break;
        }

        case IDM_HELP_ABOUT:
          MessageBox(
            hwnd,
            "Windows Metafile Vector Viewer (SVG)\n\n" +
            "• Resolution-independent vector rendering for 32-bit EMF and 16-bit WMF files\n" +
            "• Scalable affine canvas transformations\n" +
            "• Pure SVG vector export & clipboard copy\n" +
            "• Petzold Programming Windows (5th Edition) Chapter 18 Metafile Engine",
            "About Vector Metafile Viewer",
            MB_OK | MB_ICONASTERISK
          );
          break;
      }
      return 0;
    }

    case WM_DESTROY:
      viewerInstances.delete(hwnd);
      return 0;
  }

  return DefWindowProc(hwnd, uMsg, wParam, lParam);
}

export function StartMetafileViewer(
  x: number = 240,
  y: number = 70,
  initialFilePath?: string
): HWND {
  const className = "MetafileSvgViewer";

  RegisterClassEx({
    className,
    lpfnWndProc: MetafileViewerWndProc,
  });

  const fileName = initialFilePath
    ? initialFilePath.split("\\").pop() || initialFilePath.split("/").pop() || "Vector Metafile"
    : "Vector Metafile Viewer (SVG)";

  const hwnd = CreateWindowEx(
    0,
    className,
    `${fileName} - Vector Metafile Viewer (SVG)`,
    WS_OVERLAPPEDWINDOW | WS_VISIBLE | WS_THICKFRAME,
    x,
    y,
    640,
    480,
    null,
    null
  );

  const win = kernel.getWindow(hwnd);
  if (win) {
    win.customProps = {
      ...(win.customProps || {}),
      hasCanvas: true,
    };
  }

  ShowWindow(hwnd, SW_SHOW);

  const state = viewerInstances.get(hwnd);
  if (state && initialFilePath) {
    openMetafilePath(state, initialFilePath);
  }

  return hwnd;
}
