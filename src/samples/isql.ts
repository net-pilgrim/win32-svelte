import {
  RegisterClassEx,
  CreateWindowEx,
  ShowWindow,
  DestroyWindow,
  SendMessage,
  SetWindowText,
  GetWindowText,
  MessageBox,
  DefWindowProc,
  audio,
} from "../win32/kernel.svelte";

import {
  odbc,
  odbcManager,
  SQLAllocHandle,
  SQLConnect,
  SQLDisconnect,
  SQLExecDirect,
  SQLNumResultCols,
  SQLDescribeCol,
  SQLRowCount,
  SQLFetch,
  SQLGetData,
  SQLFreeHandle,
} from "../win32/odbc";

import {
  WM_CREATE,
  WM_COMMAND,
  WM_SIZE,
  WM_DESTROY,
  WS_VISIBLE,
  WS_CHILD,
  WS_OVERLAPPEDWINDOW,
  WS_THICKFRAME,
  WS_CLIPCHILDREN,
  ES_MULTILINE,
  SW_SHOW,
  MB_OK,
  MB_ICONERROR,
  MB_ICONINFORMATION,
  LOWORD,
  WC_LISTVIEW,
  STATUSCLASSNAME,
  LVM_INSERTCOLUMN,
  LVM_DELETECOLUMN,
  LVM_INSERTITEM,
  LVM_DELETEALLITEMS,
  CB_ADDSTRING,
  CB_SETCURSEL,
  CB_GETCURSEL,
  CBN_SELCHANGE,
  SB_SETTEXT,
  SB_SETPARTS,
  SQL_SUCCESS,
  SQL_HANDLE_ENV,
  SQL_HANDLE_DBC,
  SQL_HANDLE_STMT,
} from "../win32/constants";

import type { HWND, UINT, WPARAM, LPARAM, LRESULT, HENV, HDBC, HSTMT } from "../win32/types";

// Control IDs
const IDC_ISQL_COMBO_DSN = 9501;
const IDC_ISQL_BTN_CONNECT = 9502;
const IDC_ISQL_COMBO_TEMPLATES = 9503;
const IDC_ISQL_BTN_EXECUTE = 9504;
const IDC_ISQL_EDT_QUERY = 9505;
const IDC_ISQL_LIST_RESULTS = 9506;
const IDC_ISQL_STATUS = 9507;

const QUERY_TEMPLATES = [
  { label: "1. All Employees", sql: "SELECT * FROM employees;" },
  { label: "2. High Earners (>75k)", sql: "SELECT first_name, last_name, department, salary FROM employees WHERE salary > 75000 ORDER BY salary DESC;" },
  { label: "3. All Customers", sql: "SELECT id, company_name, city, country, phone FROM customers;" },
  { label: "4. Recent Orders", sql: "SELECT id, customer_id, order_date, total_amount, status FROM orders ORDER BY total_amount DESC;" },
  { label: "5. In-Stock Products", sql: "SELECT product_name, category, unit_price, units_in_stock FROM products WHERE units_in_stock > 20 ORDER BY unit_price ASC;" },
];

interface ISQLState {
  hwndComboDsn: HWND;
  hwndBtnConnect: HWND;
  hwndComboTemplates: HWND;
  hwndEdtQuery: HWND;
  hwndListResults: HWND;
  hwndStatus: HWND;
  henv: HENV;
  hdbc: HDBC;
  hstmt: HSTMT;
  connected: boolean;
  activeDsn: string;
  columnCount: number;
}

const isqlInstances = new Map<HWND, ISQLState>();

async function executeCurrentQuery(hwnd: HWND, state: ISQLState) {
  if (!state.connected) {
    audio.playChord();
    MessageBox(hwnd, "Please connect to a Data Source (DSN) first.", "ISQL Error", MB_OK | MB_ICONERROR);
    return;
  }

  const queryText = GetWindowText(state.hwndEdtQuery).trim();
  if (!queryText) {
    MessageBox(hwnd, "Please enter a SQL query to execute.", "ISQL", MB_OK);
    return;
  }

  // 1. Clear existing list rows and columns
  SendMessage(state.hwndListResults, LVM_DELETEALLITEMS, 0, 0);
  for (let i = state.columnCount - 1; i >= 0; i--) {
    SendMessage(state.hwndListResults, LVM_DELETECOLUMN, i, 0);
  }
  state.columnCount = 0;

  SendMessage(state.hwndStatus, SB_SETTEXT, 0, "Executing SQL query on Supabase ODBC driver...");

  // Free and re-allocate statement handle
  if (state.hstmt) {
    SQLFreeHandle(SQL_HANDLE_STMT, state.hstmt);
  }

  const hstmtRef = { handle: 0 };
  const allocRes = SQLAllocHandle(SQL_HANDLE_STMT, state.hdbc, hstmtRef);
  if (allocRes !== SQL_SUCCESS) {
    SendMessage(state.hwndStatus, SB_SETTEXT, 0, "Error allocating statement handle");
    return;
  }
  state.hstmt = hstmtRef.handle as HSTMT;

  const execRes = await SQLExecDirect(state.hstmt, queryText);
  if (execRes !== SQL_SUCCESS) {
    const diag = odbc.SQLGetDiagRec(SQL_HANDLE_STMT, state.hstmt);
    audio.playChord();
    MessageBox(hwnd, `SQL Execution Failed:\n\n${diag.message}`, "ODBC SQL Error", MB_OK | MB_ICONERROR);
    SendMessage(state.hwndStatus, SB_SETTEXT, 0, `Query failed: ${diag.message}`);
    return;
  }

  // 2. Describe columns
  const numColsRef = { count: 0 };
  SQLNumResultCols(state.hstmt, numColsRef);
  state.columnCount = numColsRef.count;

  for (let colIdx = 1; colIdx <= numColsRef.count; colIdx++) {
    const colDesc = SQLDescribeCol(state.hstmt, colIdx);
    const colName = colDesc.column?.name || `Col${colIdx}`;
    SendMessage(state.hwndListResults, LVM_INSERTCOLUMN, colIdx - 1, {
      text: colName,
      width: Math.max(85, colName.length * 10 + 25),
    });
  }

  // 3. Fetch rows
  let rowIdx = 0;
  while (SQLFetch(state.hstmt) === SQL_SUCCESS) {
    const firstColVal = SQLGetData(state.hstmt, 1).value;
    const subItems: string[] = [];

    for (let c = 2; c <= numColsRef.count; c++) {
      const v = SQLGetData(state.hstmt, c).value;
      subItems.push(v !== null && v !== undefined ? String(v) : "<NULL>");
    }

    SendMessage(state.hwndListResults, LVM_INSERTITEM, rowIdx, {
      id: rowIdx,
      text: firstColVal !== null && firstColVal !== undefined ? String(firstColVal) : "<NULL>",
      icon: "📊",
      subItems,
    });
    rowIdx++;
  }

  const rowCountRef = { count: 0 };
  SQLRowCount(state.hstmt, rowCountRef);

  audio.playChime();
  SendMessage(state.hwndStatus, SB_SETTEXT, 0, `Query OK: ${rowIdx} row(s) returned from ${state.activeDsn}`);
  SendMessage(state.hwndStatus, SB_SETTEXT, 1, `PostgreSQL / PostgREST`);
}

function ISQLWndProc(
  hwnd: HWND,
  uMsg: UINT,
  wParam: WPARAM,
  lParam: LPARAM
): LRESULT {
  const state = isqlInstances.get(hwnd);

  switch (uMsg) {
    case WM_CREATE: {
      const width = 640;
      const height = 480;

      // 1. Top Connection Bar
      CreateWindowEx(0, "STATIC", "DSN:", WS_CHILD | WS_VISIBLE, 10, 12, 35, 18, hwnd, 9601);
      const hwndComboDsn = CreateWindowEx(0, "COMBOBOX", "Supabase_Demo", WS_CHILD | WS_VISIBLE, 48, 8, 150, 22, hwnd, IDC_ISQL_COMBO_DSN);

      const dsns = odbcManager.getDsns();
      dsns.forEach((d) => SendMessage(hwndComboDsn, CB_ADDSTRING, 0, d.dsn));
      SendMessage(hwndComboDsn, CB_SETCURSEL, 0, 0);

      const hwndBtnConnect = CreateWindowEx(0, "BUTTON", "Disconnect", WS_CHILD | WS_VISIBLE, 206, 8, 75, 24, hwnd, IDC_ISQL_BTN_CONNECT);

      CreateWindowEx(0, "STATIC", "Template:", WS_CHILD | WS_VISIBLE, 290, 12, 60, 18, hwnd, 9602);
      const hwndComboTemplates = CreateWindowEx(0, "COMBOBOX", "Templates", WS_CHILD | WS_VISIBLE, 352, 8, 170, 22, hwnd, IDC_ISQL_COMBO_TEMPLATES);
      QUERY_TEMPLATES.forEach((t) => SendMessage(hwndComboTemplates, CB_ADDSTRING, 0, t.label));
      SendMessage(hwndComboTemplates, CB_SETCURSEL, 0, 0);

      const hwndBtnExecute = CreateWindowEx(0, "BUTTON", "Execute (F5)", WS_CHILD | WS_VISIBLE | 0x00000001 /* BS_DEFPUSHBUTTON */, 530, 8, 95, 24, hwnd, IDC_ISQL_BTN_EXECUTE);

      // 2. Multiline Query Editor
      const hwndEdtQuery = CreateWindowEx(
        0,
        "EDIT",
        QUERY_TEMPLATES[0].sql,
        WS_CHILD | WS_VISIBLE | ES_MULTILINE,
        8,
        38,
        width - 24,
        95,
        hwnd,
        IDC_ISQL_EDT_QUERY
      );

      // 3. Results ListView
      const hwndListResults = CreateWindowEx(
        0,
        WC_LISTVIEW,
        "Results",
        WS_CHILD | WS_VISIBLE,
        8,
        140,
        width - 24,
        height - 210,
        hwnd,
        IDC_ISQL_LIST_RESULTS
      );

      // 4. Status Bar
      const hwndStatus = CreateWindowEx(
        0,
        STATUSCLASSNAME,
        "Ready",
        WS_CHILD | WS_VISIBLE,
        8,
        height - 64,
        width - 24,
        22,
        hwnd,
        IDC_ISQL_STATUS
      );
      SendMessage(hwndStatus, SB_SETPARTS, 2, [380, -1]);

      // Allocate environment and connection handles
      const henvRef = { handle: 0 };
      SQLAllocHandle(SQL_HANDLE_ENV, 0, henvRef);
      const henv = henvRef.handle as HENV;

      const hdbcRef = { handle: 0 };
      SQLAllocHandle(SQL_HANDLE_DBC, henv, hdbcRef);
      const hdbc = hdbcRef.handle as HDBC;

      // Auto-connect to default DSN
      const defaultDsn = dsns[0]?.dsn || "Supabase_Demo";
      SQLConnect(hdbc, defaultDsn);

      const newState: ISQLState = {
        hwndComboDsn,
        hwndBtnConnect,
        hwndComboTemplates,
        hwndEdtQuery,
        hwndListResults,
        hwndStatus,
        henv,
        hdbc,
        hstmt: 0,
        connected: true,
        activeDsn: defaultDsn,
        columnCount: 0,
      };

      isqlInstances.set(hwnd, newState);

      SendMessage(hwndStatus, SB_SETTEXT, 0, `Connected to ${defaultDsn} (PostgreSQL ODBC)`);
      SendMessage(hwndStatus, SB_SETTEXT, 1, `Driver: Supabase ODBC v1.0`);

      // Auto-execute default query
      executeCurrentQuery(hwnd, newState);
      return 0;
    }

    case WM_SIZE: {
      if (!state) return 0;
      const width = lParam & 0xffff;
      const height = (lParam >> 16) & 0xffff;
      return 0;
    }

    case WM_COMMAND: {
      if (!state) return 0;
      const cmdId = LOWORD(wParam);

      // Template selection changed
      if (cmdId === IDC_ISQL_COMBO_TEMPLATES) {
        const curIdx = SendMessage(state.hwndComboTemplates, CB_GETCURSEL, 0, 0);
        if (curIdx >= 0 && curIdx < QUERY_TEMPLATES.length) {
          SetWindowText(state.hwndEdtQuery, QUERY_TEMPLATES[curIdx].sql);
        }
        return 0;
      }

      // Execute button
      if (cmdId === IDC_ISQL_BTN_EXECUTE) {
        executeCurrentQuery(hwnd, state);
        return 0;
      }

      // Connect / Disconnect button
      if (cmdId === IDC_ISQL_BTN_CONNECT) {
        if (state.connected) {
          SQLDisconnect(state.hdbc);
          state.connected = false;
          SetWindowText(state.hwndBtnConnect, "Connect");
          SendMessage(state.hwndStatus, SB_SETTEXT, 0, "Disconnected");
          audio.playDing();
        } else {
          const dsns = odbcManager.getDsns();
          const dsnIdx = SendMessage(state.hwndComboDsn, CB_GETCURSEL, 0, 0);
          const chosenDsn = dsns[dsnIdx]?.dsn || "Supabase_Demo";

          const ret = SQLConnect(state.hdbc, chosenDsn);
          if (ret === SQL_SUCCESS) {
            state.connected = true;
            state.activeDsn = chosenDsn;
            SetWindowText(state.hwndBtnConnect, "Disconnect");
            SendMessage(state.hwndStatus, SB_SETTEXT, 0, `Connected to ${chosenDsn}`);
            audio.playChime();
          } else {
            MessageBox(hwnd, `Failed to connect to DSN '${chosenDsn}'`, "Connection Error", MB_OK | MB_ICONERROR);
          }
        }
        return 0;
      }
      return 0;
    }

    case WM_DESTROY: {
      if (state) {
        if (state.hstmt) SQLFreeHandle(SQL_HANDLE_STMT, state.hstmt);
        if (state.hdbc) {
          SQLDisconnect(state.hdbc);
          SQLFreeHandle(SQL_HANDLE_DBC, state.hdbc);
        }
        if (state.henv) SQLFreeHandle(SQL_HANDLE_ENV, state.henv);
      }
      isqlInstances.delete(hwnd);
      return 0;
    }
  }

  return DefWindowProc(hwnd, uMsg, wParam, lParam);
}

export function StartISQL(x = 140, y = 90): HWND {
  const CLASS_NAME = "Win32ISQLApp";

  RegisterClassEx({
    className: CLASS_NAME,
    lpfnWndProc: ISQLWndProc,
  });

  const hwnd = CreateWindowEx(
    0,
    CLASS_NAME,
    "SQL Query Analyzer (Supabase ODBC)",
    WS_OVERLAPPEDWINDOW | WS_VISIBLE | WS_THICKFRAME | WS_CLIPCHILDREN,
    x,
    y,
    650,
    490,
    null,
    null
  );

  ShowWindow(hwnd, SW_SHOW);
  return hwnd;
}
