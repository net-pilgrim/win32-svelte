import {
  RegisterClassEx,
  CreateWindowEx,
  ShowWindow,
  DestroyWindow,
  SendMessage,
  MessageBox,
  SetWindowText,
  GetWindowText,
  DefWindowProc,
  audio,
} from "../win32/kernel.svelte";

import {
  odbc,
  odbcManager,
} from "../win32/odbc";

import {
  WM_CREATE,
  WM_COMMAND,
  WM_NOTIFY,
  WM_CLOSE,
  WM_DESTROY,
  WS_POPUP,
  WS_CAPTION,
  WS_SYSMENU,
  WS_VISIBLE,
  WS_CHILD,
  WS_OVERLAPPEDWINDOW,
  WS_THICKFRAME,
  WS_CLIPCHILDREN,
  SW_SHOW,
  MB_OK,
  MB_ICONINFORMATION,
  MB_ICONERROR,
  IDOK,
  IDCANCEL,
  LOWORD,
  WC_TABCONTROL,
  WC_LISTVIEW,
  TCM_INSERTITEM,
  TCN_SELCHANGE,
  LVM_INSERTCOLUMN,
  LVM_INSERTITEM,
  LVM_DELETEALLITEMS,
  LVN_ITEMCHANGED,
} from "../win32/constants";

import type { HWND, UINT, WPARAM, LPARAM, LRESULT, NMHDR, ODBCDataSource } from "../win32/types";

// Control IDs
const IDC_TAB = 9201;
const IDC_DSN_LIST = 9202;
const IDC_BTN_ADD = 9203;
const IDC_BTN_REMOVE = 9204;
const IDC_BTN_CONFIGURE = 9205;
const IDC_BTN_TEST = 9206;
const IDC_BTN_OK = 9207;
const IDC_BTN_CLOSE = 9208;

interface OdbcAdminState {
  hwndList: HWND;
  hwndTab: HWND;
  selectedDsnName: string | null;
  activeTab: number;
}

const adminInstances = new Map<HWND, OdbcAdminState>();

function populateDsnList(hwndList: HWND, activeTab: number) {
  SendMessage(hwndList, LVM_DELETEALLITEMS, 0, 0);

  if (activeTab === 0 || activeTab === 1) {
    // User DSN or System DSN
    const dsns = odbcManager.getDsns();
    dsns.forEach((dsn, idx) => {
      SendMessage(hwndList, LVM_INSERTITEM, idx, {
        id: dsn.dsn,
        text: dsn.dsn,
        icon: "🗄️",
        subItems: [dsn.driver, dsn.description || ""],
      });
    });
  } else if (activeTab === 2) {
    // Drivers tab
    const drivers = [
      { name: "Supabase PostgreSQL Driver", ver: "1.00.00", company: "Supabase Inc. / Win32-Svelte", file: "SBODBC32.DLL" },
      { name: "Microsoft Access Driver (*.mdb)", ver: "4.00.6304", company: "Microsoft Corporation", file: "ODBCJT32.DLL" },
      { name: "SQL Server", ver: "2000.85.1117", company: "Microsoft Corporation", file: "SQLSRV32.DLL" },
    ];
    drivers.forEach((drv, idx) => {
      SendMessage(hwndList, LVM_INSERTITEM, idx, {
        id: drv.name,
        text: drv.name,
        icon: "⚙️",
        subItems: [drv.ver, drv.company],
      });
    });
  } else {
    // About tab
    SendMessage(hwndList, LVM_INSERTITEM, 0, {
      id: "about",
      text: "Supabase ODBC v1.0",
      icon: "ℹ️",
      subItems: ["Win32 Cloud Database Subsystem", "PostgREST & Cloud Integration"],
    });
  }
}

/**
 * Open Supabase DSN Configuration Dialog
 */
function OpenSupabaseConfigDialog(
  hwndParent: HWND,
  targetDsnName?: string,
  onDone?: () => void
) {
  const isEdit = Boolean(targetDsnName);
  const existing = targetDsnName ? odbcManager.getDsn(targetDsnName) : null;

  const DLG_CLASS = "Win32SupabaseConfigDlg";
  const IDD_EDT_DSN = 9301;
  const IDD_EDT_DESC = 9302;
  const IDD_EDT_URL = 9303;
  const IDD_EDT_KEY = 9304;
  const IDD_EDT_SCHEMA = 9305;
  const IDD_BTN_TEST = 9306;
  const IDD_BTN_OK = IDOK;
  const IDD_BTN_CANCEL = IDCANCEL;

  let hwndEdtDsn: HWND;
  let hwndEdtDesc: HWND;
  let hwndEdtUrl: HWND;
  let hwndEdtKey: HWND;
  let hwndEdtSchema: HWND;

  function DlgProc(hwnd: HWND, uMsg: UINT, wParam: WPARAM, lParam: LPARAM): LRESULT {
    switch (uMsg) {
      case WM_CREATE: {
        // Groupbox: Supabase Connection Details
        CreateWindowEx(0, "BUTTON", "Supabase Connection Details", WS_CHILD | WS_VISIBLE | 0x00000007 /* BS_GROUPBOX */, 12, 10, 420, 220, hwnd, 9401);

        CreateWindowEx(0, "STATIC", "Data Source Name:", WS_CHILD | WS_VISIBLE, 24, 35, 120, 18, hwnd, 9402);
        hwndEdtDsn = CreateWindowEx(0, "EDIT", existing?.dsn || "Supabase_Custom", WS_CHILD | WS_VISIBLE, 150, 32, 260, 22, hwnd, IDD_EDT_DSN);

        CreateWindowEx(0, "STATIC", "Description:", WS_CHILD | WS_VISIBLE, 24, 65, 120, 18, hwnd, 9403);
        hwndEdtDesc = CreateWindowEx(0, "EDIT", existing?.description || "My Supabase PostgreSQL Database", WS_CHILD | WS_VISIBLE, 150, 62, 260, 22, hwnd, IDD_EDT_DESC);

        CreateWindowEx(0, "STATIC", "Project URL:", WS_CHILD | WS_VISIBLE, 24, 95, 120, 18, hwnd, 9404);
        hwndEdtUrl = CreateWindowEx(0, "EDIT", existing?.url || "https://xyzcompany.supabase.co", WS_CHILD | WS_VISIBLE, 150, 92, 260, 22, hwnd, IDD_EDT_URL);

        CreateWindowEx(0, "STATIC", "API Key (Anon/Service):", WS_CHILD | WS_VISIBLE, 24, 125, 125, 18, hwnd, 9405);
        hwndEdtKey = CreateWindowEx(0, "EDIT", existing?.apiKey || "", WS_CHILD | WS_VISIBLE, 150, 122, 260, 22, hwnd, IDD_EDT_KEY);

        CreateWindowEx(0, "STATIC", "Default Schema:", WS_CHILD | WS_VISIBLE, 24, 155, 120, 18, hwnd, 9406);
        hwndEdtSchema = CreateWindowEx(0, "EDIT", existing?.schema || "public", WS_CHILD | WS_VISIBLE, 150, 152, 100, 22, hwnd, IDD_EDT_SCHEMA);

        CreateWindowEx(0, "STATIC", "Supports REST & PostgREST table queries with full cursor fetching.", WS_CHILD | WS_VISIBLE, 24, 190, 390, 18, hwnd, 9407);

        // Buttons
        CreateWindowEx(0, "BUTTON", "&Test Connection...", WS_CHILD | WS_VISIBLE, 12, 242, 130, 25, hwnd, IDD_BTN_TEST);
        CreateWindowEx(0, "BUTTON", "OK", WS_CHILD | WS_VISIBLE | 0x00000001 /* BS_DEFPUSHBUTTON */, 270, 242, 75, 25, hwnd, IDD_BTN_OK);
        CreateWindowEx(0, "BUTTON", "Cancel", WS_CHILD | WS_VISIBLE, 355, 242, 75, 25, hwnd, IDD_BTN_CANCEL);
        return 0;
      }

      case WM_COMMAND: {
        const cmdId = LOWORD(wParam);
        if (cmdId === IDD_BTN_TEST) {
          const testDsn: ODBCDataSource = {
            dsn: GetWindowText(hwndEdtDsn) || "Test",
            driver: "Supabase PostgreSQL Driver",
            url: GetWindowText(hwndEdtUrl),
            apiKey: GetWindowText(hwndEdtKey),
            schema: GetWindowText(hwndEdtSchema) || "public",
          };
          odbc.testConnection(testDsn).then((res) => {
            if (res.ok) {
              audio.playChime();
              MessageBox(hwnd, res.message, "Connection Test", MB_OK | MB_ICONINFORMATION);
            } else {
              audio.playChord();
              MessageBox(hwnd, res.message, "Connection Test Failed", MB_OK | MB_ICONERROR);
            }
          });
          return 0;
        }

        if (cmdId === IDD_BTN_OK) {
          const dsnName = GetWindowText(hwndEdtDsn).trim();
          if (!dsnName) {
            MessageBox(hwnd, "Please provide a valid Data Source Name (DSN).", "Validation Error", MB_OK);
            return 0;
          }

          const savedDsn: ODBCDataSource = {
            dsn: dsnName,
            driver: "Supabase PostgreSQL Driver",
            description: GetWindowText(hwndEdtDesc).trim(),
            url: GetWindowText(hwndEdtUrl).trim(),
            apiKey: GetWindowText(hwndEdtKey).trim(),
            schema: GetWindowText(hwndEdtSchema).trim() || "public",
          };

          odbcManager.setDsn(savedDsn);
          audio.playDing();
          DestroyWindow(hwnd);
          if (onDone) onDone();
          return 0;
        }

        if (cmdId === IDD_BTN_CANCEL) {
          DestroyWindow(hwnd);
          return 0;
        }
        return 0;
      }

      case WM_CLOSE:
        DestroyWindow(hwnd);
        return 0;
    }

    return DefWindowProc(hwnd, uMsg, wParam, lParam);
  }

  RegisterClassEx({
    className: DLG_CLASS,
    lpfnWndProc: DlgProc,
  });

  const hwndDlg = CreateWindowEx(
    0,
    DLG_CLASS,
    isEdit ? "Supabase ODBC Driver Configuration" : "Add Supabase Data Source",
    WS_POPUP | WS_CAPTION | WS_SYSMENU | WS_VISIBLE,
    220,
    120,
    455,
    315,
    hwndParent,
    null
  );

  ShowWindow(hwndDlg, SW_SHOW);
}

function OdbcAdminWndProc(
  hwnd: HWND,
  uMsg: UINT,
  wParam: WPARAM,
  lParam: LPARAM
): LRESULT {
  const state = adminInstances.get(hwnd);

  switch (uMsg) {
    case WM_CREATE: {
      const width = 500;
      const height = 400;

      // 1. Property Sheet Tab Strip
      const hwndTab = CreateWindowEx(
        0,
        WC_TABCONTROL,
        "TabControl",
        WS_CHILD | WS_VISIBLE,
        8,
        6,
        width - 24,
        height - 50,
        hwnd,
        IDC_TAB
      );

      // Insert tabs
      SendMessage(hwndTab, TCM_INSERTITEM, 0, "User DSN");
      SendMessage(hwndTab, TCM_INSERTITEM, 1, "System DSN");
      SendMessage(hwndTab, TCM_INSERTITEM, 2, "Drivers");
      SendMessage(hwndTab, TCM_INSERTITEM, 3, "About");

      // 2. DSN ListView
      const hwndList = CreateWindowEx(
        0,
        WC_LISTVIEW,
        "DsnList",
        WS_CHILD | WS_VISIBLE,
        18,
        42,
        340,
        280,
        hwnd,
        IDC_DSN_LIST
      );

      SendMessage(hwndList, LVM_INSERTCOLUMN, 0, { text: "Name", width: 110 });
      SendMessage(hwndList, LVM_INSERTCOLUMN, 1, { text: "Driver", width: 140 });
      SendMessage(hwndList, LVM_INSERTCOLUMN, 2, { text: "Description", width: 150 });

      // 3. Side Action Buttons
      CreateWindowEx(0, "BUTTON", "&Add...", WS_CHILD | WS_VISIBLE, 370, 42, 100, 25, hwnd, IDC_BTN_ADD);
      CreateWindowEx(0, "BUTTON", "&Remove", WS_CHILD | WS_VISIBLE, 370, 72, 100, 25, hwnd, IDC_BTN_REMOVE);
      CreateWindowEx(0, "BUTTON", "&Configure...", WS_CHILD | WS_VISIBLE, 370, 102, 100, 25, hwnd, IDC_BTN_CONFIGURE);
      CreateWindowEx(0, "BUTTON", "&Test Connection", WS_CHILD | WS_VISIBLE, 370, 138, 100, 25, hwnd, IDC_BTN_TEST);

      // Bottom Dialog Buttons
      CreateWindowEx(0, "BUTTON", "OK", WS_CHILD | WS_VISIBLE, 275, 335, 90, 25, hwnd, IDC_BTN_OK);
      CreateWindowEx(0, "BUTTON", "Close", WS_CHILD | WS_VISIBLE, 375, 335, 90, 25, hwnd, IDC_BTN_CLOSE);

      adminInstances.set(hwnd, {
        hwndList,
        hwndTab,
        selectedDsnName: "Supabase_Demo",
        activeTab: 0,
      });

      populateDsnList(hwndList, 0);
      return 0;
    }

    case WM_NOTIFY: {
      const nmhdr = lParam as NMHDR;
      if (!state) return 0;

      // Tab selection switched
      if (nmhdr.code === TCN_SELCHANGE) {
        state.activeTab = nmhdr.tabIndex ?? 0;
        populateDsnList(state.hwndList, state.activeTab);
        return 0;
      }

      // Row selected in ListView
      if (nmhdr.code === LVN_ITEMCHANGED) {
        state.selectedDsnName = nmhdr.row?.text || null;
        return 0;
      }
      return 0;
    }

    case WM_COMMAND: {
      if (!state) return 0;
      const cmdId = LOWORD(wParam);

      switch (cmdId) {
        case IDC_BTN_ADD: {
          OpenSupabaseConfigDialog(hwnd, undefined, () => {
            populateDsnList(state.hwndList, state.activeTab);
          });
          return 0;
        }

        case IDC_BTN_CONFIGURE: {
          if (!state.selectedDsnName) {
            MessageBox(hwnd, "Please select a data source to configure.", "ODBC Administrator", MB_OK);
            return 0;
          }
          OpenSupabaseConfigDialog(hwnd, state.selectedDsnName, () => {
            populateDsnList(state.hwndList, state.activeTab);
          });
          return 0;
        }

        case IDC_BTN_REMOVE: {
          if (!state.selectedDsnName) {
            MessageBox(hwnd, "Please select a data source to remove.", "ODBC Administrator", MB_OK);
            return 0;
          }
          odbcManager.removeDsn(state.selectedDsnName);
          audio.playDing();
          populateDsnList(state.hwndList, state.activeTab);
          state.selectedDsnName = null;
          return 0;
        }

        case IDC_BTN_TEST: {
          if (!state.selectedDsnName) {
            MessageBox(hwnd, "Please select a data source to test.", "ODBC Administrator", MB_OK);
            return 0;
          }
          const dsn = odbcManager.getDsn(state.selectedDsnName);
          if (!dsn) return 0;

          odbc.testConnection(dsn).then((res) => {
            if (res.ok) {
              audio.playChime();
              MessageBox(hwnd, res.message, "Connection Test", MB_OK | MB_ICONINFORMATION);
            } else {
              audio.playChord();
              MessageBox(hwnd, res.message, "Connection Test Failed", MB_OK | MB_ICONERROR);
            }
          });
          return 0;
        }

        case IDC_BTN_OK:
        case IDC_BTN_CLOSE:
          DefWindowProc(hwnd, WM_CLOSE, 0, 0);
          return 0;
      }
      return 0;
    }

    case WM_DESTROY: {
      adminInstances.delete(hwnd);
      return 0;
    }
  }

  return DefWindowProc(hwnd, uMsg, wParam, lParam);
}

export function StartOdbcAdmin(x = 180, y = 70): HWND {
  const CLASS_NAME = "Win32OdbcAdmin";

  RegisterClassEx({
    className: CLASS_NAME,
    lpfnWndProc: OdbcAdminWndProc,
  });

  const hwnd = CreateWindowEx(
    0,
    CLASS_NAME,
    "ODBC Data Source Administrator",
    WS_OVERLAPPEDWINDOW | WS_VISIBLE | WS_THICKFRAME | WS_CLIPCHILDREN,
    x,
    y,
    515,
    410,
    null,
    null
  );

  ShowWindow(hwnd, SW_SHOW);
  return hwnd;
}
