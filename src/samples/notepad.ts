import {
  RegisterClassEx,
  CreateWindowEx,
  ShowWindow,
  DefWindowProc,
  PostQuitMessage,
  MoveWindow,
  SetWindowText,
  GetWindowText,
  MessageBox,
  RunMessageLoop,
  CreateMenu,
  CreatePopupMenu,
  AppendMenu,
  SetMenu,
} from "../win32/kernel.svelte";

import {
  WM_CREATE,
  WM_SIZE,
  WM_COMMAND,
  WM_CLOSE,
  WM_DESTROY,
  WS_OVERLAPPEDWINDOW,
  WS_VISIBLE,
  WS_CHILD,
  ES_MULTILINE,
  MF_STRING,
  MF_POPUP,
  MF_SEPARATOR,
  LOWORD,
  MB_OK,
  MB_ICONASTERISK,
  SW_SHOW,
} from "../win32/constants";

import type { HWND, UINT, WPARAM, LPARAM, LRESULT } from "../win32/types";

const ID_EDIT = 3001;

// Menu IDs
const ID_FILE_NEW = 3101;
const ID_FILE_OPEN = 3102;
const ID_FILE_SAVE = 3103;
const ID_FILE_EXIT = 3104;

const ID_EDIT_UNDO = 3201;
const ID_EDIT_SELECTALL = 3202;
const ID_EDIT_TIMEDATE = 3203;

const ID_HELP_ABOUT = 3301;

let hwndEdit: HWND = 0;

function NotepadWndProc(
  hwnd: HWND,
  uMsg: UINT,
  wParam: WPARAM,
  lParam: LPARAM
): LRESULT {
  switch (uMsg) {
    case WM_CREATE: {
      // 1. Create Menu Bar
      const hMenuBar = CreateMenu();

      // File Popup
      const hMenuFile = CreatePopupMenu();
      AppendMenu(hMenuFile, MF_STRING, ID_FILE_NEW, "&New", "Ctrl+N");
      AppendMenu(hMenuFile, MF_STRING, ID_FILE_OPEN, "&Open...", "Ctrl+O");
      AppendMenu(hMenuFile, MF_STRING, ID_FILE_SAVE, "&Save", "Ctrl+S");
      AppendMenu(hMenuFile, MF_SEPARATOR, 0, "");
      AppendMenu(hMenuFile, MF_STRING, ID_FILE_EXIT, "E&xit");
      AppendMenu(hMenuBar, MF_POPUP, hMenuFile, "&File");

      // Edit Popup
      const hMenuEdit = CreatePopupMenu();
      AppendMenu(hMenuEdit, MF_STRING, ID_EDIT_UNDO, "&Undo", "Ctrl+Z");
      AppendMenu(hMenuEdit, MF_SEPARATOR, 0, "");
      AppendMenu(hMenuEdit, MF_STRING, ID_EDIT_SELECTALL, "Select &All", "Ctrl+A");
      AppendMenu(hMenuEdit, MF_STRING, ID_EDIT_TIMEDATE, "Time/&Date", "F5");
      AppendMenu(hMenuBar, MF_POPUP, hMenuEdit, "&Edit");

      // Help Popup
      const hMenuHelp = CreatePopupMenu();
      AppendMenu(hMenuHelp, MF_STRING, ID_HELP_ABOUT, "&About Notepad");
      AppendMenu(hMenuBar, MF_POPUP, hMenuHelp, "&Help");

      // Attach menu to this window
      SetMenu(hwnd, hMenuBar);

      // 2. Create Multiline Edit Control filling client area
      hwndEdit = CreateWindowEx(
        0,
        "EDIT",
        "Welcome to Win32 Notepad in JavaScript!\n\nThis window has a full Win32 HMENU bar with File, Edit, and Help submenus.\n\nTry clicking File -> New, Edit -> Time/Date, or Help -> About Notepad!",
        WS_CHILD | WS_VISIBLE | ES_MULTILINE,
        0,
        0,
        380,
        240,
        hwnd,
        ID_EDIT,
        null,
        null
      );
      return 0;
    }

    case WM_SIZE: {
      const width = lParam & 0xffff;
      const height = (lParam >> 16) & 0xffff;
      if (hwndEdit) {
        // Full client area filling
        MoveWindow(hwndEdit, 0, 0, Math.max(100, width - 8), Math.max(50, height - 60));
      }
      return 0;
    }

    case WM_COMMAND: {
      const menuId = LOWORD(wParam);

      switch (menuId) {
        case ID_FILE_NEW:
          SetWindowText(hwndEdit, "");
          return 0;

        case ID_FILE_OPEN:
          SetWindowText(
            hwndEdit,
            "C:\\WINDOWS\\SYSTEM.INI\n\n[boot]\nshell=Explorer.exe\nmouse.drv=mouse.drv\nnetwork.drv=null\n"
          );
          return 0;

        case ID_FILE_SAVE:
          MessageBox(hwnd, "File saved to virtual disk memory!", "Notepad", MB_OK);
          return 0;

        case ID_FILE_EXIT:
          DefWindowProc(hwnd, WM_CLOSE, 0, 0);
          return 0;

        case ID_EDIT_TIMEDATE: {
          const cur = GetWindowText(hwndEdit);
          const nowStr = new Date().toLocaleString();
          SetWindowText(hwndEdit, cur + (cur ? "\n" : "") + nowStr);
          return 0;
        }

        case ID_HELP_ABOUT:
          MessageBox(
            hwnd,
            "Microsoft Notepad for Win32-JS\nVersion 4.0 (Build 1381)\n\nSimulating Win32 menus (HMENU), popup menus, and WM_COMMAND message routing.",
            "About Notepad",
            MB_OK | MB_ICONASTERISK
          );
          return 0;
      }
      return 0;
    }

    case WM_DESTROY: {
      PostQuitMessage(0);
      return 0;
    }
  }

  return DefWindowProc(hwnd, uMsg, wParam, lParam);
}

export function StartNotepad(x = 520, y = 40): HWND {
  const CLASS_NAME = "Win32Notepad";

  RegisterClassEx({
    className: CLASS_NAME,
    lpfnWndProc: NotepadWndProc,
  });

  const hwnd = CreateWindowEx(
    0,
    CLASS_NAME,
    "Untitled - Notepad",
    WS_OVERLAPPEDWINDOW | WS_VISIBLE,
    x,
    y,
    400,
    290,
    null,
    null,
    null,
    null
  );

  ShowWindow(hwnd, SW_SHOW);
  RunMessageLoop();
  return hwnd;
}
