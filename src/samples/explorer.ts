import {
  RegisterClassEx,
  CreateWindowEx,
  ShowWindow,
  DefWindowProc,
  PostQuitMessage,
  SendMessage,
  MessageBox,
  CreateMenu,
  CreatePopupMenu,
  AppendMenu,
  SetMenu,
  SetWindowText,
  DragAcceptFiles,
  DragQueryFile,
  DragFinish,
  audio,
  vfs,
} from "../win32/kernel.svelte";

import {
  WM_CREATE,
  WM_COMMAND,
  WM_NOTIFY,
  WM_DROPFILES,
  WM_SIZE,
  WM_DESTROY,
  WS_OVERLAPPEDWINDOW,
  WS_VISIBLE,
  WS_CHILD,
  WS_THICKFRAME,
  WS_CLIPCHILDREN,
  MF_STRING,
  MF_POPUP,
  MF_SEPARATOR,
  MB_OK,
  MB_YESNO,
  IDYES,
  MB_ICONINFORMATION,
  MB_ICONQUESTION,
  SW_SHOW,
  LOWORD,
  STATUSCLASSNAME,
  WC_TREEVIEW,
  WC_LISTVIEW,
  TVM_INSERTITEM,
  TVM_SELECTITEM,
  TVN_SELCHANGED,
  LVM_INSERTCOLUMN,
  LVM_INSERTITEM,
  LVM_DELETEALLITEMS,
  LVN_ITEMCHANGED,
  NM_DBLCLK,
  SB_SETTEXT,
  SB_SETPARTS,
  DRAGQUERY_ALLFILES,
} from "../win32/constants";

import type { HWND, UINT, WPARAM, LPARAM, LRESULT, NMHDR, HDROP, DropFileInfo, VFSFileInfo } from "../win32/types";
import { StartNotepad } from "./notepad";
import { StartCalculator } from "./calculator";
import { StartMinesweeper } from "./minesweeper";
import { StartOdbcAdmin } from "./odbc_admin";
import { StartISQL } from "./isql";
import { StartWasmApp } from "./wasm_app";



// Control IDs
const IDC_EXPLORER_TREE = 8001;
const IDC_EXPLORER_LIST = 8002;
const IDC_EXPLORER_STATUS = 8003;

// Menu IDs
const IDM_FILE_NEW_FOLDER = 8101;
const IDM_FILE_EXPORT = 8104;
const IDM_FILE_DELETE = 8105;
const IDM_FILE_PROPERTIES = 8102;
const IDM_FILE_CLOSE = 8103;
const IDM_EDIT_SELECT_ALL = 8201;
const IDM_VIEW_REFRESH = 8301;
const IDM_HELP_ABOUT = 8401;

interface ExplorerControls {
  hwnd: HWND;
  hwndTree: HWND;
  hwndList: HWND;
  hwndStatus: HWND;
  currentPath: string;
  selectedItem: VFSFileInfo | null;
  unsubscribeVfs?: () => void;
}

const explorerInstances = new Map<HWND, ExplorerControls>();

const FOLDER_PATH_MAP: Record<string, string> = {
  desktop: "C:\\",
  root: "C:\\",
  drive_a: "A:\\",
  drive_c: "C:\\",
  wasm_app: "C:\\wasm_application",
  my_docs: "C:\\My Documents",
  include: "C:\\INCLUDE",
  recycle: "C:\\Recycle Bin",
  drive_d: "D:\\",
};

async function PopulateListView(ctx: ExplorerControls, folderPath: string) {
  // Clear list
  SendMessage(ctx.hwndList, LVM_DELETEALLITEMS, 0, 0);

  ctx.currentPath = folderPath;
  ctx.selectedItem = null;

  try {
    const entries = await vfs.getDirectoryEntries(folderPath);

    entries.forEach((item, index) => {
      const sizeStr = item.isDirectory
        ? ""
        : item.size > 0
          ? `${Math.max(1, Math.round(item.size / 1024))} KB`
          : "0 KB";

      const dateStr = new Date(item.modified).toLocaleDateString() + " " +
        new Date(item.modified).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

      SendMessage(ctx.hwndList, LVM_INSERTITEM, index, {
        id: item.path,
        text: item.name,
        icon: item.icon,
        content: item.typeDesc,
        subItems: [sizeStr, item.typeDesc || (item.isDirectory ? "File Folder" : "File"), dateStr],
        customProps: item,
      });
    });

    const backendLabel = vfs.getBackendType() === "opfs" ? "OPFS Persistent Sandbox" : "In-Memory VFS";
    SendMessage(ctx.hwndStatus, SB_SETTEXT, 0, `${entries.length} object(s)`);
    SendMessage(ctx.hwndStatus, SB_SETTEXT, 1, `Storage: ${backendLabel}`);

    SetWindowText(ctx.hwnd, `Exploring - ${folderPath}`);
  } catch (err) {
    SendMessage(ctx.hwndStatus, SB_SETTEXT, 0, "0 object(s)");
    SendMessage(ctx.hwndStatus, SB_SETTEXT, 1, "Directory not accessible");
  }
}

function ExplorerWndProc(
  hwnd: HWND,
  uMsg: UINT,
  wParam: WPARAM,
  lParam: LPARAM
): LRESULT {
  const ctx = explorerInstances.get(hwnd);

  switch (uMsg) {
    case WM_CREATE: {
      const width = 580;
      const height = 370;
      const treeWidth = 190;
      const listWidth = width - treeWidth - 28;
      const contentHeight = height - 76;

      // 1. Create Tree View Control (Left Pane)
      const hwndTree = CreateWindowEx(
        0,
        WC_TREEVIEW,
        "Tree",
        WS_CHILD | WS_VISIBLE,
        8,
        6,
        treeWidth,
        contentHeight,
        hwnd,
        IDC_EXPLORER_TREE
      );

      // Populate Tree View Nodes
      SendMessage(hwndTree, TVM_INSERTITEM, 0, {
        id: "desktop",
        text: "Desktop",
        icon: "🖥️",
        expanded: true,
        children: [
          {
            id: "root",
            text: "My Computer",
            icon: "💻",
            expanded: true,
            children: [
              { id: "drive_a", text: "3½ Floppy (A:)", icon: "💾" },
              {
                id: "drive_c",
                text: "(C:) Hard Disk",
                icon: "💽",
                expanded: true,
                children: [
                  { id: "wasm_app", text: "wasm_application", icon: "📁" },
                  { id: "my_docs", text: "My Documents", icon: "📁" },
                  { id: "include", text: "INCLUDE", icon: "📁" },
                  { id: "recycle", text: "Recycle Bin", icon: "🗑️" },
                ],
              },
              { id: "drive_d", text: "Audio CD (D:)", icon: "💿" },
            ],
          },
        ],
      });

      // 2. Create List View Control (Right Pane)
      const hwndList = CreateWindowEx(
        0,
        WC_LISTVIEW,
        "ListView",
        WS_CHILD | WS_VISIBLE,
        treeWidth + 14,
        6,
        listWidth,
        contentHeight,
        hwnd,
        IDC_EXPLORER_LIST
      );

      // Add ListView columns
      SendMessage(hwndList, LVM_INSERTCOLUMN, 0, { text: "Name", width: 140 });
      SendMessage(hwndList, LVM_INSERTCOLUMN, 1, { text: "Size", width: 65 });
      SendMessage(hwndList, LVM_INSERTCOLUMN, 2, { text: "Type", width: 120 });
      SendMessage(hwndList, LVM_INSERTCOLUMN, 3, { text: "Modified", width: 130 });

      // 3. Create Status Bar (Bottom)
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
        IDC_EXPLORER_STATUS
      );
      SendMessage(hwndStatus, SB_SETPARTS, 2, [180, -1]);

      const ctrlRecord: ExplorerControls = {
        hwnd,
        hwndTree,
        hwndList,
        hwndStatus,
        currentPath: "C:\\",
        selectedItem: null,
      };

      // Subscribe to VFS live changes
      ctrlRecord.unsubscribeVfs = vfs.addChangeListener((_evt) => {
        PopulateListView(ctrlRecord, ctrlRecord.currentPath);
      });

      explorerInstances.set(hwnd, ctrlRecord);

      // Select default folder
      SendMessage(hwndTree, TVM_SELECTITEM, 0, "drive_c");
      PopulateListView(ctrlRecord, "C:\\");

      // 4. Create Menus
      const hMenuBar = CreateMenu();

      const hFileMenu = CreatePopupMenu();
      AppendMenu(hFileMenu, MF_STRING, IDM_FILE_NEW_FOLDER, "&New Folder");
      AppendMenu(hFileMenu, MF_STRING, IDM_FILE_EXPORT, "&Export to Host (Download)");
      AppendMenu(hFileMenu, MF_STRING, IDM_FILE_DELETE, "&Delete\tDel");
      AppendMenu(hFileMenu, MF_SEPARATOR, 0, "");
      AppendMenu(hFileMenu, MF_STRING, IDM_FILE_PROPERTIES, "&Properties");
      AppendMenu(hFileMenu, MF_SEPARATOR, 0, "");
      AppendMenu(hFileMenu, MF_STRING, IDM_FILE_CLOSE, "&Close");
      AppendMenu(hMenuBar, MF_POPUP, hFileMenu, "&File");

      const hEditMenu = CreatePopupMenu();
      AppendMenu(hEditMenu, MF_STRING, IDM_EDIT_SELECT_ALL, "Select &All\tCtrl+A");
      AppendMenu(hMenuBar, MF_POPUP, hEditMenu, "&Edit");

      const hViewMenu = CreatePopupMenu();
      AppendMenu(hViewMenu, MF_STRING, IDM_VIEW_REFRESH, "&Refresh\tF5");
      AppendMenu(hMenuBar, MF_POPUP, hViewMenu, "&View");

      const hHelpMenu = CreatePopupMenu();
      AppendMenu(hHelpMenu, MF_STRING, IDM_HELP_ABOUT, "&About Windows Explorer");
      AppendMenu(hMenuBar, MF_POPUP, hHelpMenu, "&Help");

      SetMenu(hwnd, hMenuBar);

      // Register Explorer to accept dropped files
      DragAcceptFiles(hwnd, true);
      return 0;
    }

    case WM_DROPFILES: {
      const hDrop = wParam as HDROP;
      if (!ctx) return 0;
      const count = DragQueryFile(hDrop, DRAGQUERY_ALLFILES) as number;

      (async () => {
        for (let i = 0; i < count; i++) {
          const file = DragQueryFile(hDrop, i) as DropFileInfo;
          if (file) {
            await vfs.importFileFromHost(
              ctx.currentPath,
              file.name,
              file.content !== undefined ? file.content : new Uint8Array()
            );
          }
        }
        await PopulateListView(ctx, ctx.currentPath);
        audio.playDing();
      })();

      DragFinish(hDrop);
      return 0;
    }

    case WM_NOTIFY: {
      const nmhdr = lParam as NMHDR;
      if (!ctx) return 0;

      // Tree View Selection Changed
      if (nmhdr.code === TVN_SELCHANGED) {
        const folderKey = nmhdr.nodeId ?? "drive_c";
        const path = FOLDER_PATH_MAP[folderKey] || folderKey;
        PopulateListView(ctx, path);
        return 0;
      }

      // List View Item Selected
      if (nmhdr.code === LVN_ITEMCHANGED) {
        const row = nmhdr.row;
        if (row) {
          ctx.selectedItem = (row.customProps as VFSFileInfo) || {
            name: row.text,
            path: `${ctx.currentPath}\\${row.text}`,
            isDirectory: !row.subItems?.[0],
            size: 0,
            modified: Date.now(),
            attributes: 0,
          };
          const detail = row.subItems?.[0] ? `${row.text} (${row.subItems[0]})` : row.text;
          SendMessage(ctx.hwndStatus, SB_SETTEXT, 0, detail);
        }
        return 0;
      }

      // List View Item Double-Clicked
      if (nmhdr.code === NM_DBLCLK) {
        const row = nmhdr.row;
        if (!row) return 0;
        const itemInfo = (row.customProps as VFSFileInfo);
        const name = row.text;
        const targetPath = itemInfo?.path || `${ctx.currentPath}\\${name}`;

        if (itemInfo?.isDirectory || !row.subItems?.[0]) {
          // Navigate into subdirectory
          PopulateListView(ctx, targetPath);
        } else {
          // Open file depending on extension
          const ext = name.includes(".") ? name.split(".").pop()?.toUpperCase() : "";
          if (ext === "EXE") {
            const baseName = name.toUpperCase();
            if (baseName === "NOTEPAD.EXE") {
              StartNotepad(220, 90);
            } else if (baseName === "CALC.EXE") {
              StartCalculator(260, 110);
            } else if (baseName === "WINMINE.EXE") {
              StartMinesweeper(240, 100);
            } else if (baseName === "ODBCAD32.EXE") {
              StartOdbcAdmin(200, 80);
            } else if (baseName === "ISQL.EXE") {
              StartISQL(160, 90);
            } else if (baseName === "DOOM95.EXE" || baseName === "DOOM.EXE") {
              import("./doom").then(({ StartDoom }) => {
                StartDoom(100, 50);
              });
            } else {

              MessageBox(hwnd, `Executed virtual application: ${name}`, "Windows Explorer", MB_OK);
            }
          } else if (ext === "WASM") {
            StartWasmApp(260, 90, targetPath);
          } else if (ext === "WAD") {
            import("./doom").then(({ StartDoom }) => {
              StartDoom(100, 50);
            });
          } else if (ext === "LUA") {
            import("./lua_host").then(({ StartLuaHost }) => {
              StartLuaHost(240, 70, targetPath);
            });
          } else {
            // Open in Notepad
            StartNotepad(220, 80, targetPath);
          }
        }
        return 0;
      }

      return 0;
    }

    case WM_COMMAND: {
      const cmdId = LOWORD(wParam);
      if (!ctx) return 0;

      switch (cmdId) {
        case IDM_FILE_NEW_FOLDER: {
          const folderName = typeof window !== "undefined"
            ? window.prompt("Enter new folder name:", "New Folder")
            : "New Folder";
          if (folderName) {
            vfs.CreateDirectory(`${ctx.currentPath}\\${folderName}`).then(() => {
              PopulateListView(ctx, ctx.currentPath);
            });
          }
          return 0;
        }

        case IDM_FILE_EXPORT: {
          if (!ctx.selectedItem || ctx.selectedItem.isDirectory) {
            MessageBox(hwnd, "Please select a file to export to host.", "Export to Host", MB_OK);
            return 0;
          }
          vfs.exportFileToHost(ctx.selectedItem.path)
            .then(() => {
              audio.playDing();
            })
            .catch((err) => {
              MessageBox(hwnd, `Export failed: ${err.message}`, "Export Error", MB_OK);
            });
          return 0;
        }

        case IDM_FILE_DELETE: {
          if (!ctx.selectedItem) {
            MessageBox(hwnd, "Please select an item to delete.", "Delete", MB_OK);
            return 0;
          }
          const item = ctx.selectedItem;
          MessageBox(
            hwnd,
            `Are you sure you want to delete '${item.name}' from OPFS storage?`,
            "Confirm Delete",
            MB_YESNO | MB_ICONQUESTION
          ).then((res) => {
            if (res === IDYES) {
              const op = item.isDirectory
                ? vfs.RemoveDirectory(item.path, true)
                : vfs.DeleteFile(item.path);
              op.then(() => {
                PopulateListView(ctx, ctx.currentPath);
                audio.playChime();
              });
            }
          });
          return 0;
        }

        case IDM_FILE_PROPERTIES: {
          if (!ctx.selectedItem) {
            MessageBox(
              hwnd,
              `Location: ${ctx.currentPath}\nStorage: Origin Private File System (OPFS)\nStatus: Online & Persistent`,
              "Folder Properties",
              MB_OK | MB_ICONINFORMATION
            );
          } else {
            const item = ctx.selectedItem;
            MessageBox(
              hwnd,
              `Name: ${item.name}\nPath: ${item.path}\nSize: ${item.size} bytes\nType: ${item.typeDesc || (item.isDirectory ? "Folder" : "File")}\nModified: ${new Date(item.modified).toLocaleString()}`,
              "File Properties",
              MB_OK | MB_ICONINFORMATION
            );
          }
          return 0;
        }

        case IDM_VIEW_REFRESH:
          PopulateListView(ctx, ctx.currentPath);
          return 0;

        case IDM_FILE_CLOSE:
          DefWindowProc(hwnd, 0x0010, 0, 0); // WM_CLOSE
          return 0;

        case IDM_HELP_ABOUT:
          MessageBox(
            hwnd,
            "Windows Explorer for Win32-Svelte\n\nBacked by the Origin Private File System (OPFS).\nSupports live directory browsing, host drag & drop, file exports, and Win32 application launching.",
            "About Windows Explorer",
            MB_OK | MB_ICONINFORMATION
          );
          return 0;
      }
      return 0;
    }

    case WM_DESTROY: {
      if (ctx?.unsubscribeVfs) {
        ctx.unsubscribeVfs();
      }
      explorerInstances.delete(hwnd);
      return 0;
    }

    default:
      return DefWindowProc(hwnd, uMsg, wParam, lParam);
  }
}

export function StartExplorer(x = 160, y = 80): HWND {
  const className = "Win32ExplorerApp";
  RegisterClassEx({
    className,
    lpfnWndProc: ExplorerWndProc,
  });

  const hwnd = CreateWindowEx(
    0,
    className,
    "Exploring - (C:) Hard Disk",
    WS_OVERLAPPEDWINDOW | WS_VISIBLE | WS_THICKFRAME | WS_CLIPCHILDREN,
    x,
    y,
    580,
    370,
    null,
    null
  );

  ShowWindow(hwnd, SW_SHOW);
  return hwnd;
}
