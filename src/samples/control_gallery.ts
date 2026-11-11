import {
  RegisterClassEx,
  CreateWindowEx,
  ShowWindow,
  DefWindowProc,
  PostQuitMessage,
  SendMessage,
  SetWindowText,
  MessageBox,
  RunMessageLoop,
} from "../win32/kernel.svelte";

import {
  WM_CREATE,
  WM_COMMAND,
  WM_DESTROY,
  WS_OVERLAPPEDWINDOW,
  WS_VISIBLE,
  WS_CHILD,
  BS_GROUPBOX,
  BS_AUTOCHECKBOX,
  BS_AUTORADIOBUTTON,
  BM_GETCHECK,
  BM_SETCHECK,
  BST_CHECKED,
  BST_UNCHECKED,
  CB_ADDSTRING,
  CB_SETCURSEL,
  CB_GETCURSEL,
  CB_GETLBTEXT,
  CBN_SELCHANGE,
  PBM_SETPOS,
  LOWORD,
  HIWORD,
  MB_OK,
  MB_ICONINFORMATION,
  SW_SHOW,
} from "../win32/constants";

import type { HWND, UINT, WPARAM, LPARAM, LRESULT } from "../win32/types";

// Control IDs
const ID_GRP_EFFECTS = 6000;
const ID_CHK_SOUNDS = 6001;
const ID_CHK_SMOOTH = 6002;
const ID_CHK_DRAG = 6003;

const ID_GRP_COLORS = 6010;
const ID_COMBO_COLORS = 6011;

const ID_GRP_RESOLUTION = 6020;
const ID_RAD_640 = 6021;
const ID_RAD_800 = 6022;
const ID_RAD_1024 = 6023;

const ID_GRP_LEVELS = 6030;
const ID_LBL_SLIDER = 6031;
const ID_TRACKBAR = 6032;
const ID_PROGRESS = 6033;

const ID_BTN_APPLY = 6040;
const ID_BTN_CANCEL = 6041;

interface GalleryControls {
  chkSounds: HWND;
  chkSmooth: HWND;
  chkDrag: HWND;
  comboColors: HWND;
  rad640: HWND;
  rad800: HWND;
  rad1024: HWND;
  trackbar: HWND;
  progress: HWND;
}

const galleryMap = new Map<HWND, GalleryControls>();

function GalleryWndProc(
  hwnd: HWND,
  uMsg: UINT,
  wParam: WPARAM,
  lParam: LPARAM
): LRESULT {
  const ctrls = galleryMap.get(hwnd);

  switch (uMsg) {
    case WM_CREATE: {
      const gCtrls: GalleryControls = {
        chkSounds: 0,
        chkSmooth: 0,
        chkDrag: 0,
        comboColors: 0,
        rad640: 0,
        rad800: 0,
        rad1024: 0,
        trackbar: 0,
        progress: 0,
      };
      galleryMap.set(hwnd, gCtrls);

      // --- GroupBox 1: Effects (Checkboxes) ---
      CreateWindowEx(
        0, "BUTTON", "Visual & Audio Effects",
        WS_CHILD | WS_VISIBLE | BS_GROUPBOX,
        10, 8, 330, 92, hwnd, ID_GRP_EFFECTS, null, null
      );

      gCtrls.chkSounds = CreateWindowEx(
        0, "BUTTON", "Enable sound effects",
        WS_CHILD | WS_VISIBLE | BS_AUTOCHECKBOX,
        22, 28, 200, 20, hwnd, ID_CHK_SOUNDS, null, null
      );
      SendMessage(gCtrls.chkSounds, BM_SETCHECK, BST_CHECKED, 0);

      gCtrls.chkSmooth = CreateWindowEx(
        0, "BUTTON", "Smooth edges of screen fonts",
        WS_CHILD | WS_VISIBLE | BS_AUTOCHECKBOX,
        22, 48, 200, 20, hwnd, ID_CHK_SMOOTH, null, null
      );
      SendMessage(gCtrls.chkSmooth, BM_SETCHECK, BST_CHECKED, 0);

      gCtrls.chkDrag = CreateWindowEx(
        0, "BUTTON", "Show window contents while dragging",
        WS_CHILD | WS_VISIBLE | BS_AUTOCHECKBOX,
        22, 68, 260, 20, hwnd, ID_CHK_DRAG, null, null
      );

      // --- GroupBox 2: Colors (Combobox) ---
      CreateWindowEx(
        0, "BUTTON", "Color Palette",
        WS_CHILD | WS_VISIBLE | BS_GROUPBOX,
        10, 106, 330, 64, hwnd, ID_GRP_COLORS, null, null
      );

      gCtrls.comboColors = CreateWindowEx(
        0, "COMBOBOX", "",
        WS_CHILD | WS_VISIBLE,
        22, 130, 290, 24, hwnd, ID_COMBO_COLORS, null, null
      );
      SendMessage(gCtrls.comboColors, CB_ADDSTRING, 0, "16 Colors (4-bit)" as any);
      SendMessage(gCtrls.comboColors, CB_ADDSTRING, 0, "256 Colors (8-bit)" as any);
      SendMessage(gCtrls.comboColors, CB_ADDSTRING, 0, "High Color (16-bit)" as any);
      SendMessage(gCtrls.comboColors, CB_ADDSTRING, 0, "True Color (32-bit)" as any);
      SendMessage(gCtrls.comboColors, CB_SETCURSEL, 3, 0);

      // --- GroupBox 3: Screen Area (Radio Buttons) ---
      CreateWindowEx(
        0, "BUTTON", "Screen Resolution",
        WS_CHILD | WS_VISIBLE | BS_GROUPBOX,
        10, 176, 330, 92, hwnd, ID_GRP_RESOLUTION, null, null
      );

      gCtrls.rad640 = CreateWindowEx(
        0, "BUTTON", "640 by 480 pixels",
        WS_CHILD | WS_VISIBLE | BS_AUTORADIOBUTTON,
        22, 196, 200, 20, hwnd, ID_RAD_640, null, null
      );

      gCtrls.rad800 = CreateWindowEx(
        0, "BUTTON", "800 by 600 pixels",
        WS_CHILD | WS_VISIBLE | BS_AUTORADIOBUTTON,
        22, 218, 200, 20, hwnd, ID_RAD_800, null, null
      );
      SendMessage(gCtrls.rad800, BM_SETCHECK, BST_CHECKED, 0);

      gCtrls.rad1024 = CreateWindowEx(
        0, "BUTTON", "1024 by 768 pixels",
        WS_CHILD | WS_VISIBLE | BS_AUTORADIOBUTTON,
        22, 240, 200, 20, hwnd, ID_RAD_1024, null, null
      );

      // --- GroupBox 4: Slider & Progress Bar ---
      CreateWindowEx(
        0, "BUTTON", "Brightness & Progress Bar",
        WS_CHILD | WS_VISIBLE | BS_GROUPBOX,
        10, 274, 330, 96, hwnd, ID_GRP_LEVELS, null, null
      );

      CreateWindowEx(
        0, "STATIC", "Adjust Slider to update Progress Bar:",
        WS_CHILD | WS_VISIBLE,
        22, 294, 280, 18, hwnd, ID_LBL_SLIDER, null, null
      );

      gCtrls.trackbar = CreateWindowEx(
        0, "TRACKBAR", "",
        WS_CHILD | WS_VISIBLE,
        22, 314, 290, 20, hwnd, ID_TRACKBAR, null, null
      );

      gCtrls.progress = CreateWindowEx(
        0, "PROGRESS", "",
        WS_CHILD | WS_VISIBLE,
        22, 340, 290, 20, hwnd, ID_PROGRESS, null, null
      );
      SendMessage(gCtrls.progress, PBM_SETPOS, 50, 0);

      // --- Bottom Buttons ---
      CreateWindowEx(
        0, "BUTTON", "Apply",
        WS_CHILD | WS_VISIBLE,
        170, 380, 80, 24, hwnd, ID_BTN_APPLY, null, null
      );

      CreateWindowEx(
        0, "BUTTON", "Close",
        WS_CHILD | WS_VISIBLE,
        260, 380, 80, 24, hwnd, ID_BTN_CANCEL, null, null
      );

      return 0;
    }

    case WM_COMMAND: {
      if (!ctrls) return 0;
      const controlId = LOWORD(wParam);
      const notif = HIWORD(wParam);

      // Slider movement updates progress bar!
      if (controlId === ID_TRACKBAR) {
        const val = notif;
        SendMessage(ctrls.progress, PBM_SETPOS, val, 0);
        return 0;
      }

      if (controlId === ID_BTN_CANCEL) {
        DefWindowProc(hwnd, 0x0010 /* WM_CLOSE */, 0, 0);
        return 0;
      }

      if (controlId === ID_BTN_APPLY) {
        const soundChecked = SendMessage(ctrls.chkSounds, BM_GETCHECK) === BST_CHECKED;
        const smoothChecked = SendMessage(ctrls.chkSmooth, BM_GETCHECK) === BST_CHECKED;
        const dragChecked = SendMessage(ctrls.chkDrag, BM_GETCHECK) === BST_CHECKED;

        const colorIdx = SendMessage(ctrls.comboColors, CB_GETCURSEL);
        const colorName = SendMessage(ctrls.comboColors, CB_GETLBTEXT, colorIdx);

        let resolution = "640x480";
        if (SendMessage(ctrls.rad800, BM_GETCHECK) === BST_CHECKED) resolution = "800x600";
        if (SendMessage(ctrls.rad1024, BM_GETCHECK) === BST_CHECKED) resolution = "1024x768";

        const summary = [
          `Sound Effects: ${soundChecked ? "Enabled" : "Disabled"}`,
          `Font Smoothing: ${smoothChecked ? "Enabled" : "Disabled"}`,
          `Drag Contents: ${dragChecked ? "Enabled" : "Disabled"}`,
          `Color Depth: ${colorName}`,
          `Resolution: ${resolution}`,
        ].join("\n");

        MessageBox(
          hwnd,
          `Settings Applied Successfully!\n\n${summary}`,
          "Display Properties",
          MB_OK | MB_ICONINFORMATION
        );
        return 0;
      }
      return 0;
    }

    case WM_DESTROY: {
      galleryMap.delete(hwnd);
      PostQuitMessage(0);
      return 0;
    }
  }

  return DefWindowProc(hwnd, uMsg, wParam, lParam);
}

export function StartControlGallery(x = 360, y = 50): HWND {
  const CLASS_NAME = "Win32ControlGallery";

  RegisterClassEx({
    className: CLASS_NAME,
    lpfnWndProc: GalleryWndProc,
  });

  const hwnd = CreateWindowEx(
    0,
    CLASS_NAME,
    "Display Properties",
    WS_OVERLAPPEDWINDOW | WS_VISIBLE,
    x,
    y,
    360,
    446,
    null,
    null,
    null,
    null
  );

  ShowWindow(hwnd, SW_SHOW);
  RunMessageLoop();
  return hwnd;
}
