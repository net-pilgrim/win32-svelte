import {
  RegisterClassEx,
  CreateWindowEx,
  ShowWindow,
  DefWindowProc,
  PostQuitMessage,
  RunMessageLoop,
  CreateMenu,
  CreatePopupMenu,
  AppendMenu,
  SetMenu,
  GetMenu,
  CheckMenuItem,
  MessageBox,
  kernel,
} from "../win32/kernel.svelte";

import {
  BeginPaint,
  EndPaint,
  MoveToEx,
  LineTo,
  Rectangle,
  Ellipse,
  TextOut,
  SetTextColor,
  CreateSolidBrush,
  CreatePen,
  SelectObject,
  InvalidateRect,
  type PAINTSTRUCT,
  type HDC,
} from "../win32/gdi";

import {
  WM_CREATE,
  WM_PAINT,
  WM_LBUTTONDOWN,
  WM_MOUSEMOVE,
  WM_COMMAND,
  WM_CLOSE,
  WM_DESTROY,
  WS_OVERLAPPEDWINDOW,
  WS_VISIBLE,
  LOWORD,
  MF_STRING,
  MF_POPUP,
  MF_SEPARATOR,
  MF_CHECKED,
  MF_UNCHECKED,
  MB_OK,
  SW_SHOW,
} from "../win32/constants";

import type { HWND, UINT, WPARAM, LPARAM, LRESULT } from "../win32/types";

// Menu IDs
const ID_FILE_CLEAR = 7001;
const ID_FILE_REDRAW = 7002;
const ID_FILE_EXIT = 7003;

const ID_COLOR_BLACK = 7101;
const ID_COLOR_RED = 7102;
const ID_COLOR_BLUE = 7103;
const ID_COLOR_GREEN = 7104;

const ID_HELP_ABOUT = 7201;

interface PaintSession {
  lastPt: { x: number; y: number } | null;
  penColor: string;
  penWidth: number;
}

const paintSessions = new Map<HWND, PaintSession>();

function drawDemoGraphics(hdc: HDC) {
  const w = hdc.canvas.width;
  const h = hdc.canvas.height;

  // Background white fill
  SelectObject(hdc, CreateSolidBrush("#ffffff"));
  SelectObject(hdc, CreatePen(0, 1, "#c0c0c0"));
  Rectangle(hdc, 0, 0, w, h);

  // Title Banner
  SelectObject(hdc, CreateSolidBrush("#000080")); // Navy
  SelectObject(hdc, CreatePen(0, 1, "#000000"));
  Rectangle(hdc, 12, 12, w - 12, 42);

  SetTextColor(hdc, "#ffffff");
  TextOut(hdc, 20, 20, "Win32 GDI Graphics Subsystem (HDC, BeginPaint, EndPaint)");

  // Left Section: Rectangles and Brushes
  SelectObject(hdc, CreateSolidBrush("#008080")); // Teal
  SelectObject(hdc, CreatePen(0, 2, "#000000"));
  Rectangle(hdc, 20, 56, 120, 156);

  SelectObject(hdc, CreateSolidBrush("#800080")); // Purple
  Rectangle(hdc, 50, 86, 150, 186);

  // Middle Section: Ellipses
  SelectObject(hdc, CreateSolidBrush("#ffff00")); // Yellow
  SelectObject(hdc, CreatePen(0, 3, "#ff0000"));   // Red outline
  Ellipse(hdc, 180, 56, 280, 156);

  SelectObject(hdc, CreateSolidBrush("#00ff00")); // Green
  SelectObject(hdc, CreatePen(0, 2, "#000080"));
  Ellipse(hdc, 210, 86, 250, 126);

  // Right Section: Polyline Star / Spiderweb
  SelectObject(hdc, CreatePen(0, 1, "#0000ff"));
  const cx = 350;
  const cy = 120;
  const radius = 55;
  for (let i = 0; i < 12; i++) {
    const angle = (i * Math.PI) / 6;
    const px = cx + Math.cos(angle) * radius;
    const py = cy + Math.sin(angle) * radius;
    MoveToEx(hdc, cx, cy);
    LineTo(hdc, px, py);
  }

  // Bottom Notice
  SetTextColor(hdc, "#444444");
  TextOut(hdc, 20, 206, "✏️ Interactive: Drag your mouse on this canvas to draw freehand!");
}

function PaintWndProc(
  hwnd: HWND,
  uMsg: UINT,
  wParam: WPARAM,
  lParam: LPARAM
): LRESULT {
  let session = paintSessions.get(hwnd);

  switch (uMsg) {
    case WM_CREATE: {
      session = {
        lastPt: null,
        penColor: "#000000",
        penWidth: 2,
      };
      paintSessions.set(hwnd, session);

      // Create Menu
      const hMenuBar = CreateMenu();

      const hMenuFile = CreatePopupMenu();
      AppendMenu(hMenuFile, MF_STRING, ID_FILE_CLEAR, "&Clear Canvas");
      AppendMenu(hMenuFile, MF_STRING, ID_FILE_REDRAW, "&Redraw GDI Demo");
      AppendMenu(hMenuFile, MF_SEPARATOR, 0, "");
      AppendMenu(hMenuFile, MF_STRING, ID_FILE_EXIT, "E&xit");
      AppendMenu(hMenuBar, MF_POPUP, hMenuFile, "&File");

      const hMenuColor = CreatePopupMenu();
      AppendMenu(hMenuColor, MF_STRING, ID_COLOR_BLACK, "&Black Pen");
      AppendMenu(hMenuColor, MF_STRING, ID_COLOR_RED, "&Red Pen");
      AppendMenu(hMenuColor, MF_STRING, ID_COLOR_BLUE, "B&lue Pen");
      AppendMenu(hMenuColor, MF_STRING, ID_COLOR_GREEN, "&Green Pen");
      AppendMenu(hMenuBar, MF_POPUP, hMenuColor, "&Pen Color");

      const hMenuHelp = CreatePopupMenu();
      AppendMenu(hMenuHelp, MF_STRING, ID_HELP_ABOUT, "&About GDI Paint");
      AppendMenu(hMenuBar, MF_POPUP, hMenuHelp, "&Help");

      SetMenu(hwnd, hMenuBar);
      CheckMenuItem(hMenuBar, ID_COLOR_BLACK, MF_CHECKED);
      return 0;
    }

    case WM_PAINT: {
      const ps: Partial<PAINTSTRUCT> = {};
      const hdc = BeginPaint(hwnd, ps);
      drawDemoGraphics(hdc);
      EndPaint(hwnd, ps);
      return 0;
    }

    case WM_LBUTTONDOWN: {
      const x = lParam & 0xffff;
      const y = (lParam >> 16) & 0xffff;
      if (session) {
        session.lastPt = { x, y };
      }
      return 0;
    }

    case WM_MOUSEMOVE: {
      const isMouseDown = wParam === 1;
      const x = lParam & 0xffff;
      const y = (lParam >> 16) & 0xffff;

      if (isMouseDown && session && session.lastPt) {
        const ps: Partial<PAINTSTRUCT> = {};
        const hdc = BeginPaint(hwnd, ps);
        SelectObject(hdc, CreatePen(0, session.penWidth, session.penColor));
        MoveToEx(hdc, session.lastPt.x, session.lastPt.y);
        LineTo(hdc, x, y);
        EndPaint(hwnd, ps);
        session.lastPt = { x, y };
      } else if (session) {
        session.lastPt = null;
      }
      return 0;
    }

    case WM_COMMAND: {
      const menuId = LOWORD(wParam);
      if (!session) return 0;

      switch (menuId) {
        case ID_FILE_CLEAR: {
          const ps: Partial<PAINTSTRUCT> = {};
          const hdc = BeginPaint(hwnd, ps);
          SelectObject(hdc, CreateSolidBrush("#ffffff"));
          SelectObject(hdc, CreatePen(0, 0, "#ffffff"));
          Rectangle(hdc, 0, 0, hdc.canvas.width, hdc.canvas.height);
          EndPaint(hwnd, ps);
          return 0;
        }

        case ID_FILE_REDRAW: {
          InvalidateRect(hwnd);
          return 0;
        }

        case ID_COLOR_BLACK:
        case ID_COLOR_RED:
        case ID_COLOR_BLUE:
        case ID_COLOR_GREEN: {
          const colors: Record<number, string> = {
            [ID_COLOR_BLACK]: "#000000",
            [ID_COLOR_RED]: "#ff0000",
            [ID_COLOR_BLUE]: "#0000ff",
            [ID_COLOR_GREEN]: "#008000",
          };
          session.penColor = colors[menuId];
          const hMenu = GetMenu(hwnd);
          if (hMenu) {
            CheckMenuItem(hMenu, ID_COLOR_BLACK, menuId === ID_COLOR_BLACK ? MF_CHECKED : MF_UNCHECKED);
            CheckMenuItem(hMenu, ID_COLOR_RED, menuId === ID_COLOR_RED ? MF_CHECKED : MF_UNCHECKED);
            CheckMenuItem(hMenu, ID_COLOR_BLUE, menuId === ID_COLOR_BLUE ? MF_CHECKED : MF_UNCHECKED);
            CheckMenuItem(hMenu, ID_COLOR_GREEN, menuId === ID_COLOR_GREEN ? MF_CHECKED : MF_UNCHECKED);
          }
          return 0;
        }

        case ID_FILE_EXIT:
          DefWindowProc(hwnd, WM_CLOSE, 0, 0);
          return 0;

        case ID_HELP_ABOUT:
          MessageBox(
            hwnd,
            "Win32 GDI Graphics & Canvas Engine\n\nSimulating HDC, BeginPaint, EndPaint, MoveToEx, LineTo, Rectangle, and Ellipse in TypeScript.",
            "About GDI Paint",
            MB_OK
          );
          return 0;
      }
      return 0;
    }

    case WM_DESTROY: {
      paintSessions.delete(hwnd);
      PostQuitMessage(0);
      return 0;
    }
  }

  return DefWindowProc(hwnd, uMsg, wParam, lParam);
}

export function StartPaintDemo(x = 180, y = 140): HWND {
  const CLASS_NAME = "Win32PaintDemo";

  RegisterClassEx({
    className: CLASS_NAME,
    lpfnWndProc: PaintWndProc,
  });

  const hwnd = CreateWindowEx(
    0,
    CLASS_NAME,
    "GDI Graphics - Paint Demo",
    WS_OVERLAPPEDWINDOW | WS_VISIBLE,
    x,
    y,
    460,
    310,
    null,
    null,
    null,
    null
  );

  const win = kernel.getWindow(hwnd);
  if (win) {
    win.customProps = { hasCanvas: true };
  }

  ShowWindow(hwnd, SW_SHOW);
  RunMessageLoop();
  return hwnd;
}
