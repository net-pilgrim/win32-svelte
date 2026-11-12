import {
  RegisterClassEx,
  CreateWindowEx,
  ShowWindow,
  DefWindowProc,
  PostQuitMessage,
  SetWindowText,
  MessageBox,
  DialogBoxParam,
  EndDialog,
  LoadMenu,
  SetMenu,
  GetDlgItem,
  SetDlgItemText,
  GetDlgItemText,
  CheckDlgButton,
  IsDlgButtonChecked,
  RegisterResourceBundle,
} from "../win32/kernel.svelte.ts";

import {
  WM_CREATE,
  WM_COMMAND,
  WM_DESTROY,
  WM_INITDIALOG,
  WS_OVERLAPPEDWINDOW,
  WS_VISIBLE,
  WS_CHILD,
  SW_SHOW,
  LOWORD,
  IDOK,
  IDCANCEL,
  MB_OK,
  MB_ICONINFORMATION,
  BST_CHECKED,
  BST_UNCHECKED,
} from "../win32/constants.ts";

import type { HWND, UINT, WPARAM, LPARAM, LRESULT } from "../win32/types.ts";

// Direct import of .rc file through our Vite win32RcPlugin!
import resources, {
  IDD_ABOUTBOX,
  IDD_OPTIONS,
  IDR_CALC_MENU,
  IDM_FILE_EXIT,
  IDM_OPTIONS_PREFERENCES,
  IDM_HELP_ABOUT,
  IDC_SOUND_CHECK,
  IDC_RAD_DECIMAL,
  IDC_RAD_HEX,
  IDC_PRECISION_EDIT,
} from "./sample.rc";

let mainHwnd: HWND = 0;
let statusStaticHwnd: HWND = 0;

// Application settings configured via the RC Options dialog
let appConfig = {
  soundEnabled: true,
  mode: "decimal" as "decimal" | "hex",
  precision: 4,
};

function updateStatusText() {
  if (statusStaticHwnd) {
    SetWindowText(
      statusStaticHwnd,
      `Mode: ${appConfig.mode.toUpperCase()}  |  Sound: ${appConfig.soundEnabled ? "ON" : "OFF"}  |  Precision: ${appConfig.precision} decimals`
    );
  }
}

/**
 * Dialog procedure for Options / Preferences Dialog (compiled from IDD_OPTIONS in sample.rc)
 */
function OptionsDlgProc(
  hDlg: HWND,
  uMsg: UINT,
  wParam: WPARAM,
  _lParam: LPARAM
): LRESULT {
  switch (uMsg) {
    case WM_INITDIALOG: {
      // Initialize controls from current config
      CheckDlgButton(hDlg, IDC_SOUND_CHECK, appConfig.soundEnabled ? BST_CHECKED : BST_UNCHECKED);
      CheckDlgButton(hDlg, IDC_RAD_DECIMAL, appConfig.mode === "decimal" ? BST_CHECKED : BST_UNCHECKED);
      CheckDlgButton(hDlg, IDC_RAD_HEX, appConfig.mode === "hex" ? BST_CHECKED : BST_UNCHECKED);
      SetDlgItemText(hDlg, IDC_PRECISION_EDIT, String(appConfig.precision));
      return 1;
    }

    case WM_COMMAND: {
      const id = LOWORD(wParam);
      if (id === IDOK) {
        // Read values back from dialog controls
        appConfig.soundEnabled = Boolean(IsDlgButtonChecked(hDlg, IDC_SOUND_CHECK));
        appConfig.mode = IsDlgButtonChecked(hDlg, IDC_RAD_HEX) ? "hex" : "decimal";

        const precStr = GetDlgItemText(hDlg, IDC_PRECISION_EDIT);
        const parsed = parseInt(precStr, 10);
        if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 16) {
          appConfig.precision = parsed;
        }

        updateStatusText();
        EndDialog(hDlg, IDOK);
        return 1;
      }

      if (id === IDCANCEL) {
        EndDialog(hDlg, IDCANCEL);
        return 1;
      }
      break;
    }
  }
  return 0;
}

/**
 * Main window procedure for the RC Demo application
 */
function RcDemoWndProc(
  hwnd: HWND,
  uMsg: UINT,
  wParam: WPARAM,
  lParam: LPARAM
): LRESULT {
  switch (uMsg) {
    case WM_CREATE: {
      // 1. Load Main Menu directly compiled from sample.rc!
      const hMenu = LoadMenu(resources, IDR_CALC_MENU);
      if (hMenu) {
        SetMenu(hwnd, hMenu);
      }

      // 2. Info label
      CreateWindowEx(
        0,
        "STATIC",
        "This window uses Win32 resources compiled from sample.rc!",
        WS_CHILD | WS_VISIBLE,
        14,
        14,
        340,
        36,
        hwnd,
        201
      );

      // 3. Status label reflecting dialog settings
      statusStaticHwnd = CreateWindowEx(
        0,
        "STATIC",
        "",
        WS_CHILD | WS_VISIBLE,
        14,
        56,
        340,
        20,
        hwnd,
        202
      );
      updateStatusText();

      // 4. Quick buttons to trigger dialogs directly
      CreateWindowEx(
        0,
        "BUTTON",
        "Open About Dialog (from .rc)",
        WS_CHILD | WS_VISIBLE,
        14,
        86,
        180,
        25,
        hwnd,
        301
      );

      CreateWindowEx(
        0,
        "BUTTON",
        "Open Preferences (from .rc)",
        WS_CHILD | WS_VISIBLE,
        204,
        86,
        160,
        25,
        hwnd,
        302
      );

      return 0;
    }

    case WM_COMMAND: {
      const id = LOWORD(wParam);

      // Menu: Help -> About
      if (id === IDM_HELP_ABOUT || id === 301) {
        // Launch modal About Dialog compiled directly from sample.rc!
        DialogBoxParam(null, IDD_ABOUTBOX, hwnd, undefined, 0, resources);
        return 0;
      }

      // Menu: Edit -> Preferences
      if (id === IDM_OPTIONS_PREFERENCES || id === 302) {
        // Launch modal Options Dialog compiled directly from sample.rc!
        DialogBoxParam(null, IDD_OPTIONS, hwnd, OptionsDlgProc, 0, resources);
        return 0;
      }

      // Menu: File -> Exit
      if (id === IDM_FILE_EXIT) {
        PostQuitMessage(0);
        return 0;
      }

      break;
    }

    case WM_DESTROY: {
      return 0;
    }
  }

  return DefWindowProc(hwnd, uMsg, wParam, lParam);
}

export function StartRcDemo(startX = 180, startY = 80): HWND {
  RegisterResourceBundle(resources);
  const className = "RcDemoWindowClass";

  RegisterClassEx({
    className,
    lpfnWndProc: RcDemoWndProc,
  });

  mainHwnd = CreateWindowEx(
    0,
    className,
    "Win32 RC Compiler Demo",
    WS_OVERLAPPEDWINDOW | WS_VISIBLE,
    startX,
    startY,
    400,
    180,
    null,
    null
  );

  ShowWindow(mainHwnd, SW_SHOW);
  return mainHwnd;
}
