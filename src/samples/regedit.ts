/**
 * Win32 Registry Editor (REGEDIT.EXE)
 *
 * Classic Windows 98 Registry Editor built with Win32 SysTreeView32,
 * SysListView32, status bar, and native advapi32.dll Registry APIs.
 */

import {
  CreateWindowEx,
  RegisterClassEx,
  ShowWindow,
  DestroyWindow,
  SendMessage,
  SetWindowText,
  GetWindowText,
  MessageBox,
  CreateMenu,
  CreatePopupMenu,
  AppendMenu,
  SetMenu,
  DefWindowProc,
  kernel,
  audio,
  vfs,
} from "../win32/kernel.svelte";

import {
  registry,
  RegOpenKeyEx,
  RegCreateKeyEx,
  RegCloseKey,
  RegQueryValueEx,
  RegSetValueEx,
  RegDeleteValue,
  RegDeleteKey,
  RegEnumKeyEx,
  RegEnumValue,
  RegExport,
  RegImport,
  RegistryNode,
} from "../win32/registry";

import {
  HKEY_CLASSES_ROOT,
  HKEY_CURRENT_USER,
  HKEY_LOCAL_MACHINE,
  HKEY_USERS,
  HKEY_CURRENT_CONFIG,
  REG_SZ,
  REG_DWORD,
  REG_BINARY,
  REG_MULTI_SZ,
  ERROR_SUCCESS,
  ERROR_NO_MORE_ITEMS,
  WM_CREATE,
  WM_COMMAND,
  WM_NOTIFY,
  WM_SIZE,
  WM_DESTROY,
  WS_OVERLAPPEDWINDOW,
  WS_CHILD,
  WS_VISIBLE,
  SW_SHOW,
  MF_STRING,
  MF_SEPARATOR,
  MF_POPUP,
  MB_OK,
  MB_YESNO,
  MB_ICONINFORMATION,
  MB_ICONWARNING,
  MB_ICONERROR,
  IDYES,
  IDOK,
  IDCANCEL,
  LOWORD,
  WC_TREEVIEW,
  WC_LISTVIEW,
  TVN_SELCHANGED,
  NM_DBLCLK,
} from "../win32/constants";

import type { HWND, UINT, WPARAM, LPARAM, LRESULT, NMHDR, TreeNodeItem, ListViewColumn, ListViewRow } from "../win32/types";

// Menu Commands
const IDM_REG_IMPORT = 1001;
const IDM_REG_EXPORT = 1002;
const IDM_REG_EXIT = 1003;

const IDM_EDIT_NEW_KEY = 1010;
const IDM_EDIT_NEW_STRING = 1011;
const IDM_EDIT_NEW_DWORD = 1012;
const IDM_EDIT_DELETE = 1013;
const IDM_EDIT_MODIFY = 1014;

const IDM_VIEW_REFRESH = 1020;
const IDM_HELP_ABOUT = 1030;

// Child Control IDs
const IDC_TREEVIEW = 2001;
const IDC_LISTVIEW = 2002;
const IDC_STATUSBAR = 2003;

interface RegEditState {
  hTree: HWND;
  hList: HWND;
  hStatus: HWND;
  selectedPath: string; // e.g. "HKEY_LOCAL_MACHINE\Software"
  selectedHive: string; // e.g. "HKEY_LOCAL_MACHINE"
  selectedSubPath: string; // e.g. "Software"
  selectedValueName: string | null;
}

const regEditInstances = new Map<HWND, RegEditState>();

function typeToString(type: number): string {
  switch (type) {
    case REG_SZ:
      return "REG_SZ";
    case REG_DWORD:
      return "REG_DWORD";
    case REG_BINARY:
      return "REG_BINARY";
    case REG_MULTI_SZ:
      return "REG_MULTI_SZ";
    default:
      return `REG_(${type})`;
  }
}

function dataToString(type: number, data: any): string {
  if (data === null || data === undefined) return "(value not set)";
  if (type === REG_SZ || type === REG_MULTI_SZ) {
    return `"${String(data)}"`;
  }
  if (type === REG_DWORD) {
    const num = Number(data) || 0;
    const hex = (num >>> 0).toString(16).padStart(8, "0");
    return `0x${hex} (${num})`;
  }
  if (type === REG_BINARY) {
    let bytes: number[] = [];
    if (data instanceof Uint8Array) bytes = Array.from(data);
    else if (Array.isArray(data)) bytes = data;
    const hexStr = bytes.map((b) => (b >>> 0).toString(16).padStart(2, "0")).join(" ");
    return hexStr || "(zero-length binary value)";
  }
  return String(data);
}

function buildTreeNodes(): TreeNodeItem[] {
  const hives = [
    { name: "HKEY_CLASSES_ROOT", desc: "HKEY_CLASSES_ROOT" },
    { name: "HKEY_CURRENT_USER", desc: "HKEY_CURRENT_USER" },
    { name: "HKEY_LOCAL_MACHINE", desc: "HKEY_LOCAL_MACHINE" },
    { name: "HKEY_USERS", desc: "HKEY_USERS" },
    { name: "HKEY_CURRENT_CONFIG", desc: "HKEY_CURRENT_CONFIG" },
  ];

  const buildSubKeys = (fullPath: string, node: RegistryNode, depth = 0): TreeNodeItem[] => {
    if (depth > 4) return []; // Limit initial expansion depth for performance
    const res: TreeNodeItem[] = [];
    for (const [subName, subNode] of node.subKeys) {
      const childPath = `${fullPath}\\${subName}`;
      res.push({
        id: childPath,
        text: subName,
        icon: "📁",
        expanded: false,
        children: buildSubKeys(childPath, subNode, depth + 1),
      });
    }
    return res;
  };

  const hiveNodes: TreeNodeItem[] = hives.map((h) => {
    const rootNode = registry.getRootHive(h.name);
    return {
      id: h.name,
      text: h.name,
      icon: "📁",
      expanded: h.name === "HKEY_CURRENT_USER" || h.name === "HKEY_LOCAL_MACHINE",
      children: rootNode ? buildSubKeys(h.name, rootNode, 0) : [],
    };
  });

  return [
    {
      id: "My Computer",
      text: "My Computer",
      icon: "💻",
      expanded: true,
      children: hiveNodes,
    },
  ];
}

function refreshListView(state: RegEditState) {
  const listWin = kernel.getWindow(state.hList);
  if (!listWin) return;

  if (!state.selectedPath || state.selectedPath === "My Computer") {
    if (listWin.controlState) {
      listWin.controlState.listRows = [];
    }
    SetWindowText(state.hStatus, state.selectedPath || "My Computer");
    return;
  }

  SetWindowText(state.hStatus, `My Computer\\${state.selectedPath}`);

  // Query values for selected key
  const phk = { val: 0 };
  const status = RegOpenKeyEx(state.selectedHive, state.selectedSubPath, 0, 0, phk);
  if (status !== ERROR_SUCCESS) {
    if (listWin.controlState) listWin.controlState.listRows = [];
    return;
  }

  const rows: ListViewRow[] = [];
  let idx = 0;
  let hasDefault = false;

  while (true) {
    const valName = { val: "" };
    const valType = { val: 0 };
    const valData = { val: null as any };
    const eRes = RegEnumValue(phk.val, idx, valName, valType, valData);
    if (eRes === ERROR_NO_MORE_ITEMS) break;
    if (eRes !== ERROR_SUCCESS) break;

    const isDef = valName.val === "" || valName.val === "(Default)";
    if (isDef) hasDefault = true;

    rows.push({
      id: isDef ? "(Default)" : valName.val,
      text: isDef ? "(Default)" : valName.val,
      icon: valType.val === REG_SZ ? "📄" : "🔢",
      subItems: [typeToString(valType.val), dataToString(valType.val, valData.val)],
    });

    idx++;
  }

  // Always ensure (Default) is present at top
  if (!hasDefault) {
    rows.unshift({
      id: "(Default)",
      text: "(Default)",
      icon: "📄",
      subItems: ["REG_SZ", "(value not set)"],
    });
  }

  RegCloseKey(phk.val);

  if (listWin.controlState) {
    listWin.controlState.listRows = rows;
  }
}

function RegEditWndProc(hwnd: HWND, uMsg: UINT, wParam: WPARAM, lParam: LPARAM): LRESULT {
  switch (uMsg) {
    case WM_CREATE: {
      const state: RegEditState = {
        hTree: 0,
        hList: 0,
        hStatus: 0,
        selectedPath: "HKEY_CURRENT_USER",
        selectedHive: "HKEY_CURRENT_USER",
        selectedSubPath: "",
        selectedValueName: null,
      };

      // 1. SysTreeView32 Left Pane
      state.hTree = CreateWindowEx(
        0,
        "SYSTREEVIEW32",
        "RegistryTree",
        WS_CHILD | WS_VISIBLE,
        2,
        2,
        220,
        340,
        hwnd,
        IDC_TREEVIEW
      );

      const treeWin = kernel.getWindow(state.hTree);
      if (treeWin) {
        treeWin.controlState = {
          treeNodes: buildTreeNodes(),
          selectedNodeId: "HKEY_CURRENT_USER",
        };
      }

      // 2. SysListView32 Right Pane
      state.hList = CreateWindowEx(
        0,
        "SYSLISTVIEW32",
        "RegistryValues",
        WS_CHILD | WS_VISIBLE,
        226,
        2,
        360,
        340,
        hwnd,
        IDC_LISTVIEW
      );

      const listWin = kernel.getWindow(state.hList);
      if (listWin) {
        listWin.controlState = {
          listColumns: [
            { text: "Name", width: 130 },
            { text: "Type", width: 85 },
            { text: "Data", width: 220 },
          ],
          listRows: [],
        };
      }

      // 3. Status Bar Label
      state.hStatus = CreateWindowEx(
        0,
        "STATIC",
        "My Computer\\HKEY_CURRENT_USER",
        WS_CHILD | WS_VISIBLE,
        4,
        346,
        580,
        20,
        hwnd,
        IDC_STATUSBAR
      );

      regEditInstances.set(hwnd, state);
      refreshListView(state);

      // Create Menu Bar
      const hMenuBar = CreateMenu();

      // &Registry
      const hMenuReg = CreatePopupMenu();
      AppendMenu(hMenuReg, MF_STRING, IDM_REG_IMPORT, "&Import Registry File...");
      AppendMenu(hMenuReg, MF_STRING, IDM_REG_EXPORT, "&Export Registry File...");
      AppendMenu(hMenuReg, MF_SEPARATOR, 0, "");
      AppendMenu(hMenuReg, MF_STRING, IDM_REG_EXIT, "E&xit");
      AppendMenu(hMenuBar, MF_STRING | MF_POPUP, hMenuReg, "&Registry");

      // &Edit
      const hMenuEdit = CreatePopupMenu();
      const hMenuNew = CreatePopupMenu();
      AppendMenu(hMenuNew, MF_STRING, IDM_EDIT_NEW_KEY, "&Key");
      AppendMenu(hMenuNew, MF_SEPARATOR, 0, "");
      AppendMenu(hMenuNew, MF_STRING, IDM_EDIT_NEW_STRING, "&String Value");
      AppendMenu(hMenuNew, MF_STRING, IDM_EDIT_NEW_DWORD, "&DWORD Value");
      AppendMenu(hMenuEdit, MF_STRING | MF_POPUP, hMenuNew, "&New");
      AppendMenu(hMenuEdit, MF_SEPARATOR, 0, "");
      AppendMenu(hMenuEdit, MF_STRING, IDM_EDIT_MODIFY, "&Modify...");
      AppendMenu(hMenuEdit, MF_STRING, IDM_EDIT_DELETE, "&Delete\tDel");
      AppendMenu(hMenuBar, MF_STRING | MF_POPUP, hMenuEdit, "&Edit");

      // &View
      const hMenuView = CreatePopupMenu();
      AppendMenu(hMenuView, MF_STRING, IDM_VIEW_REFRESH, "&Refresh\tF5");
      AppendMenu(hMenuBar, MF_STRING | MF_POPUP, hMenuView, "&View");

      // &Help
      const hMenuHelp = CreatePopupMenu();
      AppendMenu(hMenuHelp, MF_STRING, IDM_HELP_ABOUT, "&About Registry Editor...");
      AppendMenu(hMenuBar, MF_STRING | MF_POPUP, hMenuHelp, "&Help");

      SetMenu(hwnd, hMenuBar);
      return 0;
    }

    case WM_SIZE: {
      const state = regEditInstances.get(hwnd);
      if (!state) return 0;
      const win = kernel.getWindow(hwnd);
      if (!win) return 0;

      const w = Math.max(win.width - 16, 400);
      const h = Math.max(win.height - 65, 200);
      const treeW = Math.max(Math.floor(w * 0.38), 160);
      const listW = w - treeW - 6;

      const treeWin = kernel.getWindow(state.hTree);
      if (treeWin) {
        treeWin.width = treeW;
        treeWin.height = h - 24;
      }

      const listWin = kernel.getWindow(state.hList);
      if (listWin) {
        listWin.x = treeW + 6;
        listWin.width = listW;
        listWin.height = h - 24;
      }

      const statusWin = kernel.getWindow(state.hStatus);
      if (statusWin) {
        statusWin.y = h - 18;
        statusWin.width = w;
      }
      return 0;
    }

    case WM_NOTIFY: {
      const state = regEditInstances.get(hwnd);
      if (!state) return 0;
      const pNmhdr = lParam as unknown as NMHDR;

      // TreeView Node Selected
      if (pNmhdr && pNmhdr.code === TVN_SELCHANGED && pNmhdr.item) {
        const item = pNmhdr.item as TreeNodeItem;
        state.selectedPath = item.id;

        if (item.id === "My Computer") {
          state.selectedHive = "";
          state.selectedSubPath = "";
        } else {
          const firstSlash = item.id.indexOf("\\");
          if (firstSlash === -1) {
            state.selectedHive = item.id;
            state.selectedSubPath = "";
          } else {
            state.selectedHive = item.id.slice(0, firstSlash);
            state.selectedSubPath = item.id.slice(firstSlash + 1);
          }
        }

        refreshListView(state);
        return 0;
      }

      // ListView Double Click (Modify Value)
      if (pNmhdr && pNmhdr.code === NM_DBLCLK) {
        const listWin = kernel.getWindow(state.hList);
        const selRowIdx = listWin?.controlState?.selectedRowIndex ?? -1;
        if (selRowIdx >= 0 && listWin?.controlState?.listRows) {
          const row = listWin.controlState.listRows[selRowIdx];
          const valName = row.text === "(Default)" ? "" : row.text;
          const pVal = { val: null as any };
          const pType = { val: 0 };
          const qRes = RegQueryValueEx(state.selectedHive, valName, 0, pType, pVal);
          const currentVal = qRes === ERROR_SUCCESS ? String(pVal.val ?? "") : "";

          const newVal = typeof window !== "undefined"
            ? window.prompt(`Edit Value for '${row.text}':`, currentVal)
            : null;

          if (newVal !== null) {
            if (pType.val === REG_DWORD) {
              RegSetValueEx(state.selectedHive, valName, 0, REG_DWORD, parseInt(newVal, 10) || 0);
            } else {
              RegSetValueEx(state.selectedHive, valName, 0, REG_SZ, newVal);
            }
            refreshListView(state);
          }
        }
        return 0;
      }
      return 0;
    }

    case WM_COMMAND: {
      const id = LOWORD(wParam);
      const state = regEditInstances.get(hwnd);
      if (!state) return 0;

      switch (id) {
        case IDM_VIEW_REFRESH: {
          const treeWin = kernel.getWindow(state.hTree);
          if (treeWin && treeWin.controlState) {
            treeWin.controlState.treeNodes = buildTreeNodes();
          }
          refreshListView(state);
          audio.playClick();
          return 0;
        }

        case IDM_EDIT_NEW_KEY: {
          if (!state.selectedHive) {
            MessageBox(hwnd, "Please select a registry key or hive first.", "Registry Editor", MB_OK | MB_ICONWARNING);
            return 0;
          }
          const name = typeof window !== "undefined" ? window.prompt("Enter new Key name:", "New Key #1") : "New Key #1";
          if (name) {
            const newPath = state.selectedSubPath ? `${state.selectedSubPath}\\${name}` : name;
            const phk = { val: 0 };
            const res = RegCreateKeyEx(state.selectedHive, newPath, 0, "", 0, 0, null, phk);
            if (res === ERROR_SUCCESS) {
              RegCloseKey(phk.val);
              const treeWin = kernel.getWindow(state.hTree);
              if (treeWin && treeWin.controlState) {
                treeWin.controlState.treeNodes = buildTreeNodes();
              }
              refreshListView(state);
            }
          }
          return 0;
        }

        case IDM_EDIT_NEW_STRING: {
          if (!state.selectedHive) {
            MessageBox(hwnd, "Please select a registry key first.", "Registry Editor", MB_OK | MB_ICONWARNING);
            return 0;
          }
          const vName = typeof window !== "undefined" ? window.prompt("Enter new String Value name:", "NewValue1") : "NewValue1";
          if (vName) {
            const vData = typeof window !== "undefined" ? window.prompt(`Enter data for '${vName}':`, "") : "";
            RegSetValueEx(state.selectedHive, vName, 0, REG_SZ, vData || "");
            refreshListView(state);
          }
          return 0;
        }

        case IDM_EDIT_NEW_DWORD: {
          if (!state.selectedHive) {
            MessageBox(hwnd, "Please select a registry key first.", "Registry Editor", MB_OK | MB_ICONWARNING);
            return 0;
          }
          const vName = typeof window !== "undefined" ? window.prompt("Enter new DWORD Value name:", "NewDword1") : "NewDword1";
          if (vName) {
            const vData = typeof window !== "undefined" ? window.prompt(`Enter integer data for '${vName}':`, "0") : "0";
            RegSetValueEx(state.selectedHive, vName, 0, REG_DWORD, parseInt(vData || "0", 10) || 0);
            refreshListView(state);
          }
          return 0;
        }

        case IDM_EDIT_DELETE: {
          const listWin = kernel.getWindow(state.hList);
          const selRowIdx = listWin?.controlState?.selectedRowIndex ?? -1;
          if (selRowIdx >= 0 && listWin?.controlState?.listRows) {
            const row = listWin.controlState.listRows[selRowIdx];
            if (row.text === "(Default)") {
              RegSetValueEx(state.selectedHive, "", 0, REG_SZ, "");
            } else {
              RegDeleteValue(state.selectedHive, row.text);
            }
            refreshListView(state);
          } else if (state.selectedSubPath) {
            // Delete key
            MessageBox(
              hwnd,
              `Are you sure you want to delete this key and all of its values?\n\n${state.selectedPath}`,
              "Confirm Key Delete",
              MB_YESNO | MB_ICONWARNING
            ).then((confirm) => {
              if (confirm === IDYES) {
                RegDeleteKey(state.selectedHive, state.selectedSubPath);
                const treeWin = kernel.getWindow(state.hTree);
                if (treeWin && treeWin.controlState) {
                  treeWin.controlState.treeNodes = buildTreeNodes();
                }
                state.selectedPath = state.selectedHive;
                state.selectedSubPath = "";
                refreshListView(state);
              }
            });
          }
          return 0;
        }

        case IDM_REG_EXPORT: {
          const regData = RegExport(state.selectedHive || undefined);
          const filePath = "C:\\My Documents\\exported_registry.reg";
          vfs.writeTextFile(filePath, regData).then(() => {
            MessageBox(
              hwnd,
              `Registry hive successfully exported to:\n${filePath}\n\nSize: ${regData.length} characters.`,
              "Registry Export",
              MB_OK | MB_ICONINFORMATION
            );
            audio.playChime();
          });
          return 0;
        }

        case IDM_REG_IMPORT: {
          const path = typeof window !== "undefined"
            ? window.prompt("Enter VFS path of .REG file to import:", "C:\\My Documents\\exported_registry.reg")
            : "C:\\My Documents\\exported_registry.reg";
          if (path) {
            vfs.readTextFile(path).then(
              (text) => {
                const res = RegImport(text);
                MessageBox(
                  hwnd,
                  `Registry import completed successfully!\n\n• Keys updated: ${res.importedKeys}\n• Values written: ${res.importedValues}`,
                  "Registry Import",
                  MB_OK | MB_ICONINFORMATION
                );
                refreshListView(state);
                audio.playTada();
              },
              (err) => {
                MessageBox(hwnd, `Failed to read file: ${err?.message || err}`, "Registry Import Error", MB_OK | MB_ICONERROR);
              }
            );
          }
          return 0;
        }

        case IDM_HELP_ABOUT: {
          MessageBox(
            hwnd,
            "Windows 98 Registry Editor (REGEDIT.EXE)\n\n" +
            "• Authentic 2-pane SysTreeView32 / SysListView32 navigation\n" +
            "• Direct synchronous advapi32.dll Win32 Registry APIs\n" +
            "• Persistent localStorage storage & .REG file Import/Export\n" +
            "• Svelte 5 + 98.css Native Sandbox",
            "About Registry Editor",
            MB_OK | MB_ICONINFORMATION
          );
          return 0;
        }

        case IDM_REG_EXIT: {
          DestroyWindow(hwnd);
          return 0;
        }
      }
      return 0;
    }

    case WM_DESTROY: {
      regEditInstances.delete(hwnd);
      return 0;
    }

    default:
      return DefWindowProc(hwnd, uMsg, wParam, lParam);
  }
}

export function StartRegEdit(x = 180, y = 60): HWND {
  RegisterClassEx({
    className: "Win32RegEdit",
    lpfnWndProc: RegEditWndProc,
  });

  const hwnd = CreateWindowEx(
    0,
    "Win32RegEdit",
    "Registry Editor",
    WS_OVERLAPPEDWINDOW,
    x,
    y,
    620,
    420,
    null,
    null
  );

  ShowWindow(hwnd, SW_SHOW);
  return hwnd;
}
