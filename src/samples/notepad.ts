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
  DragAcceptFiles,
  DragQueryFile,
  DragFinish,
  audio,
  vfs,
  PrintTextDocument,
} from "../win32/kernel.svelte";


import {
  WM_CREATE,
  WM_SIZE,
  WM_COMMAND,
  WM_DROPFILES,
  WM_CLOSE,
  WM_DESTROY,
  WS_OVERLAPPEDWINDOW,
  WS_VISIBLE,
  WS_CHILD,
  ES_MULTILINE,
  MF_STRING,
  MF_POPUP,
  MF_SEPARATOR,
  DRAGQUERY_ALLFILES,
  LOWORD,
  MB_OK,
  MB_ICONASTERISK,
  SW_SHOW,
} from "../win32/constants";

import type { HWND, UINT, WPARAM, LPARAM, LRESULT, HDROP, DropFileInfo } from "../win32/types";

const ID_EDIT = 3001;

// Menu IDs
const ID_FILE_NEW = 3101;
const ID_FILE_OPEN = 3102;
const ID_FILE_SAVE = 3103;
const ID_FILE_SAVEAS = 3105;
const ID_FILE_PRINT = 3106;
const ID_FILE_PRINTPREVIEW = 3107;
const ID_FILE_EXIT = 3104;


const ID_EDIT_UNDO = 3201;
const ID_EDIT_SELECTALL = 3202;
const ID_EDIT_TIMEDATE = 3203;

const ID_HELP_ABOUT = 3301;

interface NotepadState {
  hwndEdit: HWND;
  filePath: string | null;
}

const notepadStateByWindow = new Map<HWND, NotepadState>();

function NotepadWndProc(
  hwnd: HWND,
  uMsg: UINT,
  wParam: WPARAM,
  lParam: LPARAM
): LRESULT {
  const state = notepadStateByWindow.get(hwnd);

  switch (uMsg) {
    case WM_CREATE: {
      // 1. Create Menu Bar
      const hMenuBar = CreateMenu();

      // File Popup
      const hMenuFile = CreatePopupMenu();
      AppendMenu(hMenuFile, MF_STRING, ID_FILE_NEW, "&New", "Ctrl+N");
      AppendMenu(hMenuFile, MF_STRING, ID_FILE_OPEN, "&Open...", "Ctrl+O");
      AppendMenu(hMenuFile, MF_STRING, ID_FILE_SAVE, "&Save", "Ctrl+S");
      AppendMenu(hMenuFile, MF_STRING, ID_FILE_SAVEAS, "Save &As...");
      AppendMenu(hMenuFile, MF_SEPARATOR, 0, "");
      AppendMenu(hMenuFile, MF_STRING, ID_FILE_PRINT, "&Print...", "Ctrl+P");
      AppendMenu(hMenuFile, MF_STRING, ID_FILE_PRINTPREVIEW, "Print Pre&view");
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
      const hwndEdit = CreateWindowEx(
        0,
        "EDIT",
        "Welcome to Win32 Notepad in JavaScript!\r\n\r\nBacked by Origin Private File System (OPFS) storage:\r\n• Open & Save files directly to virtual drives (C:\\, A:\\, etc.)\r\n• Changes are permanently stored in your browser's private sandbox.\r\n• Drag and drop files from Windows Explorer or your real computer!\r\n\r\nTry clicking File -> Save, File -> Open, or Edit -> Time/Date!",
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

      notepadStateByWindow.set(hwnd, {
        hwndEdit,
        filePath: null,
      });

      // Register window for Win32 Shell Drag & Drop
      DragAcceptFiles(hwnd, true);
      return 0;
    }

    case WM_DROPFILES: {
      const hDrop = wParam as HDROP;
      const count = DragQueryFile(hDrop, DRAGQUERY_ALLFILES) as number;
      if (state && count > 0) {
        const file = DragQueryFile(hDrop, 0) as DropFileInfo;
        if (file) {
          const filePath = (file as any).path || `C:\\My Documents\\${file.name}`;
          state.filePath = filePath;
          if (file.content !== undefined) {
            SetWindowText(state.hwndEdit, file.content);
          } else {
            vfs.readTextFile(filePath)
              .then((content) => SetWindowText(state.hwndEdit, content))
              .catch(() => {});
          }
          SetWindowText(hwnd, `${file.name} - Notepad`);
          audio.playChime();
        }
      }
      DragFinish(hDrop);
      return 0;
    }

    case WM_SIZE: {
      const width = lParam & 0xffff;
      const height = (lParam >> 16) & 0xffff;
      if (state) {
        // Full client area filling
        MoveWindow(state.hwndEdit, 0, 0, Math.max(100, width - 8), Math.max(50, height - 60));
      }
      return 0;
    }

    case WM_COMMAND: {
      const menuId = LOWORD(wParam);
      if (!state) return 0;
      const hwndEdit = state.hwndEdit;

      switch (menuId) {
        case ID_FILE_NEW:
          state.filePath = null;
          SetWindowText(hwndEdit, "");
          SetWindowText(hwnd, "Untitled - Notepad");
          return 0;

        case ID_FILE_OPEN: {
          const defaultPath = state.filePath || "C:\\My Documents\\Welcome.txt";
          const promptPath = typeof window !== "undefined"
            ? window.prompt("Open file from OPFS virtual storage:", defaultPath)
            : defaultPath;

          if (!promptPath) return 0;

          vfs.readTextFile(promptPath)
            .then((text) => {
              state.filePath = promptPath;
              SetWindowText(hwndEdit, text);
              const fileName = promptPath.replace(/\\/g, "/").split("/").pop() || "Untitled";
              SetWindowText(hwnd, `${fileName} - Notepad`);
              audio.playChime();
            })
            .catch(() => {
              MessageBox(hwnd, `Cannot open file "${promptPath}". File not found in virtual filesystem.`, "Notepad", MB_OK);
            });
          return 0;
        }

        case ID_FILE_SAVE: {
          const text = GetWindowText(hwndEdit);
          let targetPath = state.filePath;

          if (!targetPath) {
            const promptName = typeof window !== "undefined"
              ? window.prompt("Save file to OPFS virtual storage path:", "C:\\My Documents\\Untitled.txt")
              : "C:\\My Documents\\Untitled.txt";
            if (!promptName) return 0;
            targetPath = promptName;
            state.filePath = targetPath;
          }

          vfs.writeTextFile(targetPath, text).then((ok) => {
            if (ok) {
              const fileName = targetPath!.replace(/\\/g, "/").split("/").pop() || "Untitled";
              SetWindowText(hwnd, `${fileName} - Notepad`);
              audio.playChime();
              MessageBox(hwnd, `File saved successfully to OPFS storage:\n${targetPath}`, "Notepad", MB_OK);
            } else {
              MessageBox(hwnd, `Error saving file to ${targetPath}`, "Notepad Error", MB_OK);
            }
          });
          return 0;
        }

        case ID_FILE_SAVEAS: {
          const text = GetWindowText(hwndEdit);
          const defaultPath = state.filePath || "C:\\My Documents\\Document.txt";
          const promptName = typeof window !== "undefined"
            ? window.prompt("Save As path in OPFS virtual drive:", defaultPath)
            : defaultPath;

          if (!promptName) return 0;
          state.filePath = promptName;

          vfs.writeTextFile(promptName, text).then((ok) => {
            if (ok) {
              const fileName = promptName.replace(/\\/g, "/").split("/").pop() || "Untitled";
              SetWindowText(hwnd, `${fileName} - Notepad`);
              audio.playChime();
              MessageBox(hwnd, `File saved successfully to OPFS storage:\n${promptName}`, "Notepad", MB_OK);
            } else {
              MessageBox(hwnd, `Error saving file to ${promptName}`, "Notepad Error", MB_OK);
            }
          });
          return 0;
        }

        case ID_FILE_PRINT: {
          const text = GetWindowText(hwndEdit);
          const docTitle = state.filePath ? state.filePath.split("\\").pop() : "Untitled";
          PrintTextDocument(text, docTitle, "dialog");
          return 0;
        }

        case ID_FILE_PRINTPREVIEW: {
          const text = GetWindowText(hwndEdit);
          const docTitle = state.filePath ? state.filePath.split("\\").pop() : "Untitled";
          PrintTextDocument(text, docTitle, "preview");
          return 0;
        }

        case ID_FILE_EXIT:

          DefWindowProc(hwnd, WM_CLOSE, 0, 0);
          return 0;

        case ID_EDIT_TIMEDATE: {
          const cur = GetWindowText(hwndEdit);
          const nowStr = new Date().toLocaleString();
          SetWindowText(hwndEdit, cur + (cur ? "\r\n" : "") + nowStr);
          return 0;
        }

        case ID_HELP_ABOUT:
          MessageBox(
            hwnd,
            "Microsoft Notepad for Win32-Svelte\nVersion 5.0 (Build 2222)\n\nEquipped with Origin Private File System (OPFS) persistent storage and shell drag & drop.",
            "About Notepad",
            MB_OK | MB_ICONASTERISK
          );
          return 0;
      }
      return 0;
    }

    case WM_DESTROY: {
      notepadStateByWindow.delete(hwnd);
      PostQuitMessage(0);
      return 0;
    }
  }

  return DefWindowProc(hwnd, uMsg, wParam, lParam);
}

export function StartNotepad(x = 520, y = 40, initialFilePath?: string): HWND {
  const CLASS_NAME = "Win32Notepad";

  RegisterClassEx({
    className: CLASS_NAME,
    lpfnWndProc: NotepadWndProc,
  });

  const title = initialFilePath
    ? `${initialFilePath.replace(/\\/g, "/").split("/").pop()} - Notepad`
    : "Untitled - Notepad";

  const hwnd = CreateWindowEx(
    0,
    CLASS_NAME,
    title,
    WS_OVERLAPPEDWINDOW | WS_VISIBLE,
    x,
    y,
    420,
    300,
    null,
    null,
    null,
    null
  );

  ShowWindow(hwnd, SW_SHOW);

  // If initial file specified, load it
  if (initialFilePath) {
    const state = notepadStateByWindow.get(hwnd);
    if (state) {
      state.filePath = initialFilePath;
      vfs.readTextFile(initialFilePath)
        .then((content) => {
          SetWindowText(state.hwndEdit, content);
        })
        .catch(() => {});
    }
  }

  RunMessageLoop();
  return hwnd;
}
