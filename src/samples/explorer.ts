import {
  RegisterClassEx,
  CreateWindowEx,
  ShowWindow,
  DefWindowProc,
  PostQuitMessage,
  SendMessage,
  MessageBox,
  RunMessageLoop,
  CreateMenu,
  CreatePopupMenu,
  AppendMenu,
  SetMenu,
  DragAcceptFiles,
  DragQueryFile,
  DragFinish,
  audio,
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
  MB_ICONINFORMATION,
  SW_SHOW,
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
  SB_SETTEXT,
  SB_SETPARTS,
  DRAGQUERY_ALLFILES,
} from "../win32/constants";

import type { HWND, UINT, WPARAM, LPARAM, LRESULT, TreeNodeItem, NMHDR, HDROP, DropFileInfo } from "../win32/types";

// Control IDs
const IDC_EXPLORER_TREE = 8001;
const IDC_EXPLORER_LIST = 8002;
const IDC_EXPLORER_STATUS = 8003;

// Menu IDs
const IDM_FILE_NEW_FOLDER = 8101;
const IDM_FILE_PROPERTIES = 8102;
const IDM_FILE_CLOSE = 8103;
const IDM_EDIT_SELECT_ALL = 8201;
const IDM_VIEW_REFRESH = 8301;
const IDM_HELP_ABOUT = 8401;

interface FileItem {
  name: string;
  size: string;
  type: string;
  modified: string;
  icon: string;
}

const FOLDER_DATA: Record<string, FileItem[]> = {
  root: [
    { name: "3½ Floppy (A:)", size: "", type: "3½-Inch Floppy Disk", modified: "", icon: "💾" },
    { name: "Hard Disk (C:)", size: "", type: "Local Disk", modified: "", icon: "💽" },
    { name: "Audio CD (D:)", size: "", type: "CD-ROM Drive", modified: "", icon: "💿" },
    { name: "Printers", size: "", type: "System Folder", modified: "", icon: "🖨️" },
  ],
  drive_c: [
    { name: "WINDOWS", size: "", type: "File Folder", modified: "11/07/1998 12:00 PM", icon: "📁" },
    { name: "Program Files", size: "", type: "File Folder", modified: "11/07/1998 12:05 PM", icon: "📁" },
    { name: "My Documents", size: "", type: "File Folder", modified: "11/08/1998 04:30 PM", icon: "📁" },
    { name: "AUTOEXEC.BAT", size: "1 KB", type: "MS-DOS Batch File", modified: "11/05/1998 09:12 AM", icon: "📄" },
    { name: "CONFIG.SYS", size: "1 KB", type: "System file", modified: "11/05/1998 09:12 AM", icon: "⚙️" },
    { name: "COMMAND.COM", size: "93 KB", type: "MS-DOS Application", modified: "05/11/1998 08:01 PM", icon: "📟" },
  ],
  windows: [
    { name: "SYSTEM", size: "", type: "File Folder", modified: "11/07/1998 12:01 PM", icon: "📁" },
    { name: "SYSTEM32", size: "", type: "File Folder", modified: "11/07/1998 12:01 PM", icon: "📁" },
    { name: "COMMAND", size: "", type: "File Folder", modified: "11/07/1998 12:02 PM", icon: "📁" },
    { name: "NOTEPAD.EXE", size: "52 KB", type: "Application", modified: "05/11/1998 08:01 PM", icon: "📝" },
    { name: "CALC.EXE", size: "112 KB", type: "Application", modified: "05/11/1998 08:01 PM", icon: "🔢" },
    { name: "WINMINE.EXE", size: "28 KB", type: "Application", modified: "05/11/1998 08:01 PM", icon: "💣" },
    { name: "EXPLORER.EXE", size: "178 KB", type: "Application", modified: "05/11/1998 08:01 PM", icon: "🗂️" },
    { name: "WIN.INI", size: "4 KB", type: "Configuration Settings", modified: "11/09/1998 03:15 PM", icon: "⚙️" },
  ],
  prog_files: [
    { name: "Accessories", size: "", type: "File Folder", modified: "11/07/1998 12:10 PM", icon: "📁" },
    { name: "Internet Explorer", size: "", type: "File Folder", modified: "11/07/1998 12:12 PM", icon: "🌐" },
    { name: "Netscape", size: "", type: "File Folder", modified: "11/07/1998 01:25 PM", icon: "📁" },
    { name: "WinZip", size: "", type: "File Folder", modified: "11/08/1998 10:44 AM", icon: "📁" },
  ],
  my_docs: [
    { name: "Letter to Bill.doc", size: "18 KB", type: "WordPad Document", modified: "11/10/1998 02:40 PM", icon: "📄" },
    { name: "Budget98.xls", size: "34 KB", type: "Microsoft Excel Worksheet", modified: "11/09/1998 06:12 PM", icon: "📊" },
    { name: "SoundBlaster.txt", size: "2 KB", type: "Text Document", modified: "11/06/1998 11:20 AM", icon: "📄" },
    { name: "Setup.log", size: "8 KB", type: "Text Document", modified: "11/05/1998 09:15 AM", icon: "📄" },
  ],
  recycle: [
    { name: "OldShortcut.lnk", size: "1 KB", type: "Shortcut", modified: "11/09/1998 10:11 AM", icon: "🗑️" },
    { name: "Draft.bmp", size: "154 KB", type: "Bitmap Image", modified: "11/08/1998 05:22 PM", icon: "🎨" },
  ],
};

interface ExplorerControls {
  hwndTree: HWND;
  hwndList: HWND;
  hwndStatus: HWND;
  currentFolderKey: string;
}

const explorerInstances = new Map<HWND, ExplorerControls>();

function PopulateListView(hwndList: HWND, hwndStatus: HWND, folderKey: string) {
  // Clear list
  SendMessage(hwndList, LVM_DELETEALLITEMS, 0, 0);

  const items = FOLDER_DATA[folderKey] || [];
  items.forEach((item, index) => {
    SendMessage(hwndList, LVM_INSERTITEM, index, {
      id: index,
      text: item.name,
      icon: item.icon,
      subItems: [item.size, item.type, item.modified],
    });
  });

  // Update Status Bar
  SendMessage(hwndStatus, SB_SETTEXT, 0, `${items.length} object(s)`);
  SendMessage(hwndStatus, SB_SETTEXT, 1, "Disk free space: 248 MB");
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
      const width = 560;
      const height = 360;
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
                  { id: "windows", text: "WINDOWS", icon: "📁" },
                  { id: "prog_files", text: "Program Files", icon: "📁" },
                  { id: "my_docs", text: "My Documents", icon: "📁" },
                ],
              },
              { id: "drive_d", text: "Audio CD (D:)", icon: "💿" },
            ],
          },
          { id: "recycle", text: "Recycle Bin", icon: "🗑️" },
          { id: "network", text: "Network Neighborhood", icon: "🌐" },
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
      SendMessage(hwndList, LVM_INSERTCOLUMN, 0, { text: "Name", width: 130 });
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

      explorerInstances.set(hwnd, {
        hwndTree,
        hwndList,
        hwndStatus,
        currentFolderKey: "drive_c",
      });

      // Select default folder
      SendMessage(hwndTree, TVM_SELECTITEM, 0, "drive_c");
      PopulateListView(hwndList, hwndStatus, "drive_c");

      // 4. Create Menus
      const hMenuBar = CreateMenu();

      const hFileMenu = CreatePopupMenu();
      AppendMenu(hFileMenu, MF_STRING, IDM_FILE_NEW_FOLDER, "&New Folder");
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
      for (let i = 0; i < count; i++) {
        const file = DragQueryFile(hDrop, i) as DropFileInfo;
        if (file) {
          if (!FOLDER_DATA[ctx.currentFolderKey]) {
            FOLDER_DATA[ctx.currentFolderKey] = [];
          }
          FOLDER_DATA[ctx.currentFolderKey].push({
            name: file.name,
            size: typeof file.size === "number" ? `${Math.max(1, Math.round(file.size / 1024))} KB` : String(file.size || "1 KB"),
            type: file.type || "Document",
            modified: new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            icon: "📄",
          });
        }
      }
      PopulateListView(ctx.hwndList, ctx.hwndStatus, ctx.currentFolderKey);
      audio.playDing();
      DragFinish(hDrop);
      return 0;
    }

    case WM_NOTIFY: {
      const nmhdr = lParam as NMHDR;
      if (!ctx) return 0;

      // Tree View Selection Changed
      if (nmhdr.code === TVN_SELCHANGED) {
        const folderKey = nmhdr.nodeId ?? "drive_c";
        ctx.currentFolderKey = folderKey;
        PopulateListView(ctx.hwndList, ctx.hwndStatus, folderKey);
        return 0;
      }

      // List View Item Selected
      if (nmhdr.code === LVN_ITEMCHANGED) {
        const row = nmhdr.row as FileItem;
        if (row) {
          const detail = row.size ? `${row.name} (${row.size})` : row.name;
          SendMessage(ctx.hwndStatus, SB_SETTEXT, 0, detail);
        }
        return 0;
      }
      return 0;
    }

    case WM_COMMAND: {
      const cmdId = wParam;
      switch (cmdId) {
        case IDM_HELP_ABOUT:
          MessageBox(
            hwnd,
            "Windows Explorer\n\nBuilt on comctl32.dll with SysTreeView32, SysListView32, and msctls_statusbar32.\nPowered by Svelte 5 and 98.css.",
            "About Windows Explorer",
            MB_OK | MB_ICONINFORMATION
          );
          return 0;

        case IDM_VIEW_REFRESH:
          if (ctx) {
            PopulateListView(ctx.hwndList, ctx.hwndStatus, ctx.currentFolderKey);
          }
          return 0;

        case IDM_FILE_CLOSE:
          DefWindowProc(hwnd, 0x0010, 0, 0); // WM_CLOSE
          return 0;
      }
      return 0;
    }

    case WM_DESTROY: {
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
    570,
    370,
    null,
    null
  );

  ShowWindow(hwnd, SW_SHOW);
  return hwnd;
}
