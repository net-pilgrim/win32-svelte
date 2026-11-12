import {
  RegisterClassEx,
  CreateWindowEx,
  ShowWindow,
  DefWindowProc,
  PostQuitMessage,
  SendMessage,
  MessageBox,
  RunMessageLoop,
  ShellExecute,
} from "../win32/kernel.svelte";

import {
  WM_CREATE,
  WM_COMMAND,
  WM_NOTIFY,
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
  PBM_SETPOS,
  LOWORD,
  HIWORD,
  MB_OK,
  MB_ICONINFORMATION,
  SW_SHOW,
  SW_HIDE,
  WC_TABCONTROL,
  WC_LINK,
  TCM_INSERTITEM,
  TCM_SETCURSEL,
  TCN_SELCHANGE,
  SS_ETCHEDHORZ,
  SS_ICON,
} from "../win32/constants";

import type { HWND, UINT, WPARAM, LPARAM, LRESULT, NMHDR } from "../win32/types";

// Control IDs
const ID_TAB_PROPERTIES = 5999;

// Settings / Controls IDs
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

const ID_BTN_ABOUT = 6039;
const ID_BTN_APPLY = 6040;
const ID_BTN_CANCEL = 6041;

// About tab control IDs
const ID_GRP_ABOUT = 6050;
const ID_ABOUT_ICON = 6051;
const ID_ABOUT_TITLE = 6052;
const ID_ABOUT_VERSION = 6053;
const ID_ABOUT_LINE1 = 6054;
const ID_ABOUT_DESC = 6055;
const ID_ABOUT_LINE2 = 6056;
const ID_ABOUT_REPO_LBL = 6057;
const ID_ABOUT_LINK = 6058;
const ID_BTN_OPEN_REPO = 6059;
const ID_ABOUT_LINE3 = 6060;
const ID_ABOUT_SYSINFO = 6061;

const SOURCE_REPO_URL = "https://github.com/net-pilgrim/win32-svelte";

interface GalleryControls {
  hwndTab: HWND;
  activeTab: number;

  // Group 1: Effects
  grpEffects: HWND;
  chkSounds: HWND;
  chkSmooth: HWND;
  chkDrag: HWND;

  // Group 2: Colors
  grpColors: HWND;
  comboColors: HWND;

  // Group 3: Resolution
  grpResolution: HWND;
  rad640: HWND;
  rad800: HWND;
  rad1024: HWND;

  // Group 4: Levels
  grpLevels: HWND;
  lblSlider: HWND;
  trackbar: HWND;
  progress: HWND;

  // Bottom buttons
  btnAbout: HWND;
  btnApply: HWND;
  btnCancel: HWND;

  // About controls
  grpAbout: HWND;
  aboutIcon: HWND;
  aboutTitle: HWND;
  aboutVersion: HWND;
  aboutLine1: HWND;
  aboutDesc: HWND;
  aboutLine2: HWND;
  aboutRepoLbl: HWND;
  aboutLink: HWND;
  btnOpenRepo: HWND;
  aboutLine3: HWND;
  aboutSysInfo: HWND;
}

const galleryMap = new Map<HWND, GalleryControls>();

function updateTabVisibility(ctrls: GalleryControls, tabIndex: number) {
  ctrls.activeTab = tabIndex;

  const showSettings = tabIndex === 0;
  const showEffects = tabIndex === 0 || tabIndex === 1;
  const showAppearance = tabIndex === 0 || tabIndex === 2;
  const showAbout = tabIndex === 3;

  // Effects controls
  const effectsCmd = showEffects ? SW_SHOW : SW_HIDE;
  ShowWindow(ctrls.grpEffects, effectsCmd);
  ShowWindow(ctrls.chkSounds, effectsCmd);
  ShowWindow(ctrls.chkSmooth, effectsCmd);
  ShowWindow(ctrls.chkDrag, effectsCmd);

  // Appearance controls (Colors)
  const colorsCmd = showAppearance ? SW_SHOW : SW_HIDE;
  ShowWindow(ctrls.grpColors, colorsCmd);
  ShowWindow(ctrls.comboColors, colorsCmd);

  // Appearance controls (Resolution)
  const resCmd = showAppearance ? SW_SHOW : SW_HIDE;
  ShowWindow(ctrls.grpResolution, resCmd);
  ShowWindow(ctrls.rad640, resCmd);
  ShowWindow(ctrls.rad800, resCmd);
  ShowWindow(ctrls.rad1024, resCmd);

  // Appearance controls (Slider & Progress)
  const levelsCmd = showAppearance ? SW_SHOW : SW_HIDE;
  ShowWindow(ctrls.grpLevels, levelsCmd);
  ShowWindow(ctrls.lblSlider, levelsCmd);
  ShowWindow(ctrls.trackbar, levelsCmd);
  ShowWindow(ctrls.progress, levelsCmd);

  // About controls
  const aboutCmd = showAbout ? SW_SHOW : SW_HIDE;
  ShowWindow(ctrls.grpAbout, aboutCmd);
  ShowWindow(ctrls.aboutIcon, aboutCmd);
  ShowWindow(ctrls.aboutTitle, aboutCmd);
  ShowWindow(ctrls.aboutVersion, aboutCmd);
  ShowWindow(ctrls.aboutLine1, aboutCmd);
  ShowWindow(ctrls.aboutDesc, aboutCmd);
  ShowWindow(ctrls.aboutLine2, aboutCmd);
  ShowWindow(ctrls.aboutRepoLbl, aboutCmd);
  ShowWindow(ctrls.aboutLink, aboutCmd);
  ShowWindow(ctrls.btnOpenRepo, aboutCmd);
  ShowWindow(ctrls.aboutLine3, aboutCmd);
  ShowWindow(ctrls.aboutSysInfo, aboutCmd);
}

function GalleryWndProc(
  hwnd: HWND,
  uMsg: UINT,
  wParam: WPARAM,
  lParam: LPARAM
): LRESULT {
  const ctrls = galleryMap.get(hwnd);

  switch (uMsg) {
    case WM_CREATE: {
      // --- Tab Control (SysTabControl32) ---
      const hwndTab = CreateWindowEx(
        0, WC_TABCONTROL, "",
        WS_CHILD | WS_VISIBLE,
        10, 6, 330, 26, hwnd, ID_TAB_PROPERTIES, null, null
      );
      SendMessage(hwndTab, TCM_INSERTITEM, 0, "Settings" as any);
      SendMessage(hwndTab, TCM_INSERTITEM, 1, "Effects" as any);
      SendMessage(hwndTab, TCM_INSERTITEM, 2, "Appearance" as any);
      SendMessage(hwndTab, TCM_INSERTITEM, 3, "About" as any);

      // --- GroupBox 1: Effects (Checkboxes) ---
      const grpEffects = CreateWindowEx(
        0, "BUTTON", "Visual & Audio Effects",
        WS_CHILD | WS_VISIBLE | BS_GROUPBOX,
        10, 36, 330, 92, hwnd, ID_GRP_EFFECTS, null, null
      );

      const chkSounds = CreateWindowEx(
        0, "BUTTON", "Enable sound effects",
        WS_CHILD | WS_VISIBLE | BS_AUTOCHECKBOX,
        22, 56, 200, 20, hwnd, ID_CHK_SOUNDS, null, null
      );
      SendMessage(chkSounds, BM_SETCHECK, BST_CHECKED, 0);

      const chkSmooth = CreateWindowEx(
        0, "BUTTON", "Smooth edges of screen fonts",
        WS_CHILD | WS_VISIBLE | BS_AUTOCHECKBOX,
        22, 76, 200, 20, hwnd, ID_CHK_SMOOTH, null, null
      );
      SendMessage(chkSmooth, BM_SETCHECK, BST_CHECKED, 0);

      const chkDrag = CreateWindowEx(
        0, "BUTTON", "Show window contents while dragging",
        WS_CHILD | WS_VISIBLE | BS_AUTOCHECKBOX,
        22, 96, 260, 20, hwnd, ID_CHK_DRAG, null, null
      );

      // --- GroupBox 2: Colors (Combobox) ---
      const grpColors = CreateWindowEx(
        0, "BUTTON", "Color Palette",
        WS_CHILD | WS_VISIBLE | BS_GROUPBOX,
        10, 134, 330, 64, hwnd, ID_GRP_COLORS, null, null
      );

      const comboColors = CreateWindowEx(
        0, "COMBOBOX", "",
        WS_CHILD | WS_VISIBLE,
        22, 158, 290, 24, hwnd, ID_COMBO_COLORS, null, null
      );
      SendMessage(comboColors, CB_ADDSTRING, 0, "16 Colors (4-bit)" as any);
      SendMessage(comboColors, CB_ADDSTRING, 0, "256 Colors (8-bit)" as any);
      SendMessage(comboColors, CB_ADDSTRING, 0, "High Color (16-bit)" as any);
      SendMessage(comboColors, CB_ADDSTRING, 0, "True Color (32-bit)" as any);
      SendMessage(comboColors, CB_SETCURSEL, 3, 0);

      // --- GroupBox 3: Screen Area (Radio Buttons) ---
      const grpResolution = CreateWindowEx(
        0, "BUTTON", "Screen Resolution",
        WS_CHILD | WS_VISIBLE | BS_GROUPBOX,
        10, 204, 330, 92, hwnd, ID_GRP_RESOLUTION, null, null
      );

      const rad640 = CreateWindowEx(
        0, "BUTTON", "640 by 480 pixels",
        WS_CHILD | WS_VISIBLE | BS_AUTORADIOBUTTON,
        22, 224, 200, 20, hwnd, ID_RAD_640, null, null
      );

      const rad800 = CreateWindowEx(
        0, "BUTTON", "800 by 600 pixels",
        WS_CHILD | WS_VISIBLE | BS_AUTORADIOBUTTON,
        22, 246, 200, 20, hwnd, ID_RAD_800, null, null
      );
      SendMessage(rad800, BM_SETCHECK, BST_CHECKED, 0);

      const rad1024 = CreateWindowEx(
        0, "BUTTON", "1024 by 768 pixels",
        WS_CHILD | WS_VISIBLE | BS_AUTORADIOBUTTON,
        22, 268, 200, 20, hwnd, ID_RAD_1024, null, null
      );

      // --- GroupBox 4: Slider & Progress Bar ---
      const grpLevels = CreateWindowEx(
        0, "BUTTON", "Brightness & Progress Bar",
        WS_CHILD | WS_VISIBLE | BS_GROUPBOX,
        10, 302, 330, 96, hwnd, ID_GRP_LEVELS, null, null
      );

      const lblSlider = CreateWindowEx(
        0, "STATIC", "Adjust Slider to update Progress Bar:",
        WS_CHILD | WS_VISIBLE,
        22, 322, 280, 18, hwnd, ID_LBL_SLIDER, null, null
      );

      const trackbar = CreateWindowEx(
        0, "TRACKBAR", "",
        WS_CHILD | WS_VISIBLE,
        22, 342, 290, 20, hwnd, ID_TRACKBAR, null, null
      );

      const progress = CreateWindowEx(
        0, "PROGRESS", "",
        WS_CHILD | WS_VISIBLE,
        22, 368, 290, 20, hwnd, ID_PROGRESS, null, null
      );
      SendMessage(progress, PBM_SETPOS, 50, 0);

      // --- About Controls (Tab 3: Initially hidden) ---
      const grpAbout = CreateWindowEx(
        0, "BUTTON", "About Components Showcase",
        WS_CHILD | BS_GROUPBOX,
        10, 36, 330, 362, hwnd, ID_GRP_ABOUT, null, null
      );

      const aboutIcon = CreateWindowEx(
        0, "STATIC", "IDI_INFORMATION",
        WS_CHILD | SS_ICON,
        24, 56, 32, 32, hwnd, ID_ABOUT_ICON, null, null
      );

      const aboutTitle = CreateWindowEx(
        0, "STATIC", "win32-svelte Components Showcase",
        WS_CHILD,
        64, 56, 260, 18, hwnd, ID_ABOUT_TITLE, null, null
      );

      const aboutVersion = CreateWindowEx(
        0, "STATIC", "Version 1.0 (Windows 98 Architecture)",
        WS_CHILD,
        64, 76, 260, 16, hwnd, ID_ABOUT_VERSION, null, null
      );

      const aboutLine1 = CreateWindowEx(
        0, "STATIC", "",
        WS_CHILD | SS_ETCHEDHORZ,
        20, 98, 310, 2, hwnd, ID_ABOUT_LINE1, null, null
      );

      const aboutDesc = CreateWindowEx(
        0, "STATIC", "A faithful Win32 User & GDI desktop runtime running on Svelte 5 and 98.css.\n\nDemonstrates HWND handles, window classes, synchronous SendMessage & queued PostMessage, standard controls, and canvas GDI.",
        WS_CHILD,
        20, 108, 310, 62, hwnd, ID_ABOUT_DESC, null, null
      );

      const aboutLine2 = CreateWindowEx(
        0, "STATIC", "",
        WS_CHILD | SS_ETCHEDHORZ,
        20, 176, 310, 2, hwnd, ID_ABOUT_LINE2, null, null
      );

      const aboutRepoLbl = CreateWindowEx(
        0, "STATIC", "Source Repository (GitHub):",
        WS_CHILD,
        20, 186, 310, 16, hwnd, ID_ABOUT_REPO_LBL, null, null
      );

      const aboutLink = CreateWindowEx(
        0, WC_LINK, SOURCE_REPO_URL,
        WS_CHILD,
        20, 206, 310, 18, hwnd, ID_ABOUT_LINK, null, { href: SOURCE_REPO_URL }
      );

      const btnOpenRepo = CreateWindowEx(
        0, "BUTTON", "🌐 Open GitHub Repository",
        WS_CHILD,
        20, 230, 180, 24, hwnd, ID_BTN_OPEN_REPO, null, null
      );

      const aboutLine3 = CreateWindowEx(
        0, "STATIC", "",
        WS_CHILD | SS_ETCHEDHORZ,
        20, 264, 310, 2, hwnd, ID_ABOUT_LINE3, null, null
      );

      const aboutSysInfo = CreateWindowEx(
        0, "STATIC", "Runtime: Svelte 5 Runes ($state, $derived, $effect)\nStyles: 98.css retro Windows 98 aesthetics\nLicense: MIT Open Source",
        WS_CHILD,
        20, 274, 310, 48, hwnd, ID_ABOUT_SYSINFO, null, null
      );

      // --- Bottom Buttons (Always visible) ---
      const btnAbout = CreateWindowEx(
        0, "BUTTON", "About...",
        WS_CHILD | WS_VISIBLE,
        10, 408, 80, 24, hwnd, ID_BTN_ABOUT, null, null
      );

      const btnApply = CreateWindowEx(
        0, "BUTTON", "Apply",
        WS_CHILD | WS_VISIBLE,
        170, 408, 80, 24, hwnd, ID_BTN_APPLY, null, null
      );

      const btnCancel = CreateWindowEx(
        0, "BUTTON", "Close",
        WS_CHILD | WS_VISIBLE,
        260, 408, 80, 24, hwnd, ID_BTN_CANCEL, null, null
      );

      const gCtrls: GalleryControls = {
        hwndTab,
        activeTab: 0,
        grpEffects,
        chkSounds,
        chkSmooth,
        chkDrag,
        grpColors,
        comboColors,
        grpResolution,
        rad640,
        rad800,
        rad1024,
        grpLevels,
        lblSlider,
        trackbar,
        progress,
        btnAbout,
        btnApply,
        btnCancel,
        grpAbout,
        aboutIcon,
        aboutTitle,
        aboutVersion,
        aboutLine1,
        aboutDesc,
        aboutLine2,
        aboutRepoLbl,
        aboutLink,
        btnOpenRepo,
        aboutLine3,
        aboutSysInfo,
      };

      galleryMap.set(hwnd, gCtrls);
      updateTabVisibility(gCtrls, 0);

      return 0;
    }

    case WM_NOTIFY: {
      const nmhdr = lParam as NMHDR;
      if (!ctrls) return 0;
      if (nmhdr.code === TCN_SELCHANGE) {
        const tabIndex = nmhdr.tabIndex ?? 0;
        updateTabVisibility(ctrls, tabIndex);
        return 0;
      }
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

      if (controlId === ID_BTN_ABOUT) {
        if (ctrls.activeTab !== 3) {
          SendMessage(ctrls.hwndTab, TCM_SETCURSEL, 3, 0);
          updateTabVisibility(ctrls, 3);
        } else {
          MessageBox(
            hwnd,
            `win32-svelte Components Showcase\nVersion 1.0 (Build 1998)\n\nSource Repository:\n${SOURCE_REPO_URL}\n\nA faithful Win32 User & GDI desktop runtime running on Svelte 5 and 98.css.`,
            "About Components Showcase",
            MB_OK | MB_ICONINFORMATION
          );
        }
        return 0;
      }

      if (controlId === ID_BTN_OPEN_REPO || controlId === ID_ABOUT_LINK) {
        ShellExecute(hwnd, "open", SOURCE_REPO_URL);
        return 0;
      }

      if (controlId === ID_BTN_APPLY) {
        if (ctrls.activeTab === 3) {
          MessageBox(
            hwnd,
            `win32-svelte Components Showcase\n\nSource Repository:\n${SOURCE_REPO_URL}\n\nLicense: MIT`,
            "About Components Showcase",
            MB_OK | MB_ICONINFORMATION
          );
          return 0;
        }

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
    480,
    null,
    null,
    null,
    null
  );

  ShowWindow(hwnd, SW_SHOW);
  RunMessageLoop();
  return hwnd;
}
