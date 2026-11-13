import {
  CreateWindowEx,
  RegisterClassEx,
  ShowWindow,
  DefWindowProc,
  SetWindowText,
  GetWindowText,
  MessageBox,
  CreateMenu,
  CreatePopupMenu,
  AppendMenu,
  SetMenu,
  vfs,
  kernel,
} from "../win32/kernel.svelte";
import {
  WS_OVERLAPPEDWINDOW,
  WS_CHILD,
  WS_VISIBLE,
  SW_SHOW,
  WM_CREATE,
  WM_COMMAND,
  WM_SIZE,
  WM_DESTROY,
  BS_PUSHBUTTON,
  ES_MULTILINE,
  ES_AUTOVSCROLL,
  MF_STRING,
  MF_SEPARATOR,
  MB_OK,
  MB_ICONINFORMATION,
  LOWORD,
} from "../win32/constants";
import type { HWND, UINT, WPARAM, LPARAM, LRESULT } from "../win32/types";
import { Win32LuaRuntime } from "../win32/lua_engine";

// Command Identifiers
const IDC_BTN_RUN = 1001;
const IDC_BTN_RESET = 1002;
const IDC_BTN_CLEAR = 1003;
const IDC_BTN_SAMPLE1 = 1004;
const IDC_BTN_SAMPLE2 = 1005;
const IDC_BTN_SAMPLE3 = 1006;

const IDM_FILE_NEW = 2001;
const IDM_FILE_OPEN = 2002;
const IDM_FILE_SAVE = 2003;
const IDM_FILE_EXIT = 2004;
const IDM_RUN_EXECUTE = 2005;
const IDM_RUN_RESET = 2006;
const IDM_RUN_CLEAR = 2007;
const IDM_HELP_ABOUT = 2008;

const SAMPLE_HELLO = `-- ========================================================
-- Sample 1: Hello Win32 & Audio
-- ========================================================
print("Starting Lua 5.3 Scripting Engine...")
print("Running inside win32-svelte on Svelte 5 + 98.css")

win32.PlaySound("Chime")

win32.MessageBox(
    "Hello from Lua 5.3 running in Windows 98!\\n\\n" ..
    "• Engine: Fengari Lua 5.3 VM\\n" ..
    "• OS Subsystem: Win32 User & GDI\\n" ..
    "• Standard libraries: math, string, table, os",
    "Lua 5.3 Command Center",
    win32.MB_OK | win32.MB_ICONINFORMATION
)

local sum = 0
for i = 1, 10 do
    sum = sum + i
end
print("Computation test: Sum 1..10 is " .. sum)
print("Finished!")
`;

const SAMPLE_GUI = `-- ========================================================
-- Sample 2: Dynamic Win32 GUI & State
-- ========================================================
print("Creating dynamic Win32 GUI application from Lua...")

local win = win32.CreateWindow(
    "LuaDynamicApp",
    "Dynamic Lua Win32 Application",
    180, 100, 340, 210,
    win32.WS_OVERLAPPEDWINDOW | win32.WS_VISIBLE
)

local clicks = 0
local btnCounter = nil

btnCounter = win32.CreateButton("Clicks: 0", 20, 20, 140, 30, win, function(h)
    clicks = clicks + 1
    win32.SetWindowText(h, "Clicks: " .. clicks)
    win32.PlaySound("Ding")
    print("Button clicked from Lua! Total clicks:", clicks)
    if clicks == 5 then
        win32.MessageBox(win, "High five! You clicked 5 times!", "Lua Counter", win32.MB_ICONINFORMATION)
        win32.PlaySound("Tada")
    end
end)

win32.CreateButton("Show Message", 170, 20, 140, 30, win, function()
    win32.MessageBox(win, "Hello from secondary Lua button!", "Notice", win32.MB_OK)
end)

win32.CreateStatic("Edit this script and click Run to test live changes!", 20, 70, 290, 30, win)
`;

const SAMPLE_GDI = `-- ========================================================
-- Sample 3: Procedural GDI Graphics & Paint
-- ========================================================
print("Registering custom GDI drawing window in Lua...")

win32.RegisterClass("LuaGdiClass", function(hwnd, msg, wp, lp)
    if msg == win32.WM_PAINT then
        local hdc = win32.BeginPaint(hwnd)
        for i = 1, 8 do
            win32.Rectangle(hdc, 15 + i*16, 15 + i*10, 290 - i*14, 180 - i*8)
            win32.Ellipse(hdc, 35 + i*12, 25 + i*8, 270 - i*12, 160 - i*8)
        end
        win32.TextOut(hdc, 50, 95, "Generated Procedurally by Lua 5.3!")
        win32.EndPaint(hwnd)
        return 0
    end
    return win32.DefWindowProc(hwnd, msg, wp, lp)
end)

local win = win32.CreateWindow("LuaGdiClass", "Lua GDI Procedural Art", 240, 130, 330, 230)
win32.ShowWindow(win, win32.SW_SHOW)
win32.PlaySound("Chime")
`;

interface LuaHostContext {
  runtime: Win32LuaRuntime;
  hEditScript: HWND;
  hEditConsole: HWND;
  hBtnRun: HWND;
  hBtnReset: HWND;
  hBtnClear: HWND;
  hBtnSample1: HWND;
  hBtnSample2: HWND;
  hBtnSample3: HWND;
  consoleLines: string[];
}

const hostContexts = new Map<HWND, LuaHostContext>();

function appendConsole(ctx: LuaHostContext, text: string) {
  ctx.consoleLines.push(text);
  if (ctx.consoleLines.length > 500) {
    ctx.consoleLines.shift();
  }
  SetWindowText(ctx.hEditConsole, ctx.consoleLines.join("\r\n"));
}

function runCurrentScript(ctx: LuaHostContext) {
  const code = GetWindowText(ctx.hEditScript);
  appendConsole(ctx, `\r\n--- Executing Lua Script ---`);
  const result = ctx.runtime.execute(code);
  if (!result.success) {
    appendConsole(ctx, `[ERROR] ${result.error}`);
  }
}

function LuaHostWndProc(hwnd: HWND, uMsg: UINT, wParam: WPARAM, lParam: LPARAM): LRESULT {
  switch (uMsg) {
    case WM_CREATE: {
      const runtime = new Win32LuaRuntime();

      // Top Toolbar Buttons
      const hBtnRun = CreateWindowEx(
        0, "BUTTON", "▶ Run (F5)",
        WS_CHILD | WS_VISIBLE | BS_PUSHBUTTON,
        8, 6, 85, 24,
        hwnd, IDC_BTN_RUN
      );

      const hBtnReset = CreateWindowEx(
        0, "BUTTON", "🔄 Reset VM",
        WS_CHILD | WS_VISIBLE | BS_PUSHBUTTON,
        98, 6, 85, 24,
        hwnd, IDC_BTN_RESET
      );

      const hBtnClear = CreateWindowEx(
        0, "BUTTON", "🧹 Clear",
        WS_CHILD | WS_VISIBLE | BS_PUSHBUTTON,
        188, 6, 65, 24,
        hwnd, IDC_BTN_CLEAR
      );

      const hBtnSample1 = CreateWindowEx(
        0, "BUTTON", "Hello",
        WS_CHILD | WS_VISIBLE | BS_PUSHBUTTON,
        270, 6, 60, 24,
        hwnd, IDC_BTN_SAMPLE1
      );

      const hBtnSample2 = CreateWindowEx(
        0, "BUTTON", "GUI Demo",
        WS_CHILD | WS_VISIBLE | BS_PUSHBUTTON,
        335, 6, 75, 24,
        hwnd, IDC_BTN_SAMPLE2
      );

      const hBtnSample3 = CreateWindowEx(
        0, "BUTTON", "GDI Art",
        WS_CHILD | WS_VISIBLE | BS_PUSHBUTTON,
        415, 6, 65, 24,
        hwnd, IDC_BTN_SAMPLE3
      );

      // Script Source Code Editor
      const hEditScript = CreateWindowEx(
        0, "EDIT", SAMPLE_HELLO,
        WS_CHILD | WS_VISIBLE | ES_MULTILINE | ES_AUTOVSCROLL,
        8, 36, 500, 200,
        hwnd, 1101
      );

      // Execution Console Log
      const initialLog = "Lua 5.3 Embedded Console for Win32-Svelte\r\nType Lua code above and click Run or press F5.\r\n==========================================";
      const hEditConsole = CreateWindowEx(
        0, "EDIT", initialLog,
        WS_CHILD | WS_VISIBLE | ES_MULTILINE | ES_AUTOVSCROLL,
        8, 242, 500, 150,
        hwnd, 1102
      );

      const ctx: LuaHostContext = {
        runtime,
        hEditScript,
        hEditConsole,
        hBtnRun,
        hBtnReset,
        hBtnClear,
        hBtnSample1,
        hBtnSample2,
        hBtnSample3,
        consoleLines: [initialLog],
      };

      runtime.onLog = (msg) => {
        appendConsole(ctx, `[${msg.type.toUpperCase()}] ${msg.text}`);
      };

      hostContexts.set(hwnd, ctx);

      // Create Menu Bar
      const hMenuBar = CreateMenu();
      const hFileMenu = CreatePopupMenu();
      AppendMenu(hFileMenu, MF_STRING, IDM_FILE_NEW, "&New Script");
      AppendMenu(hFileMenu, MF_STRING, IDM_FILE_OPEN, "&Open Script...");
      AppendMenu(hFileMenu, MF_STRING, IDM_FILE_SAVE, "&Save to VFS...");
      AppendMenu(hFileMenu, MF_SEPARATOR, 0, "");
      AppendMenu(hFileMenu, MF_STRING, IDM_FILE_EXIT, "E&xit");
      AppendMenu(hMenuBar, MF_STRING, hFileMenu, "&File");

      const hRunMenu = CreatePopupMenu();
      AppendMenu(hRunMenu, MF_STRING, IDM_RUN_EXECUTE, "&Run Script\tF5");
      AppendMenu(hRunMenu, MF_STRING, IDM_RUN_RESET, "Reset &VM");
      AppendMenu(hRunMenu, MF_STRING, IDM_RUN_CLEAR, "&Clear Console");
      AppendMenu(hMenuBar, MF_STRING, hRunMenu, "&Run");

      const hHelpMenu = CreatePopupMenu();
      AppendMenu(hHelpMenu, MF_STRING, IDM_HELP_ABOUT, "&About Lua 5.3...");
      AppendMenu(hMenuBar, MF_STRING, hHelpMenu, "&Help");

      SetMenu(hwnd, hMenuBar);
      return 0;
    }

    case WM_COMMAND: {
      const id = LOWORD(wParam);
      const ctx = hostContexts.get(hwnd);
      if (!ctx) return 0;

      switch (id) {
        case IDC_BTN_RUN:
        case IDM_RUN_EXECUTE: {
          runCurrentScript(ctx);
          return 0;
        }

        case IDC_BTN_RESET:
        case IDM_RUN_RESET: {
          ctx.runtime.initVM();
          appendConsole(ctx, "\r\n🔄 Lua Virtual Machine reset to clean state.");
          return 0;
        }

        case IDC_BTN_CLEAR:
        case IDM_RUN_CLEAR: {
          ctx.consoleLines = [];
          ctx.runtime.clearLogs();
          SetWindowText(ctx.hEditConsole, "");
          return 0;
        }

        case IDC_BTN_SAMPLE1: {
          SetWindowText(ctx.hEditScript, SAMPLE_HELLO);
          return 0;
        }

        case IDC_BTN_SAMPLE2: {
          SetWindowText(ctx.hEditScript, SAMPLE_GUI);
          return 0;
        }

        case IDC_BTN_SAMPLE3: {
          SetWindowText(ctx.hEditScript, SAMPLE_GDI);
          return 0;
        }

        case IDM_FILE_NEW: {
          SetWindowText(ctx.hEditScript, "-- New Lua Script\nprint('Hello World')\n");
          return 0;
        }

        case IDM_FILE_OPEN: {
          const path = typeof window !== "undefined"
            ? window.prompt("Enter VFS path to open (e.g. C:\\lua\\hello.lua):", "C:\\lua\\hello.lua")
            : "C:\\lua\\hello.lua";
          if (path) {
            vfs.readTextFile(path).then(
              (text) => {
                SetWindowText(ctx.hEditScript, text);
                appendConsole(ctx, `✓ Loaded file: ${path}`);
              },
              (err) => {
                MessageBox(hwnd, `Failed to open file: ${err?.message || err}`, "Open Error", MB_OK);
              }
            );
          }
          return 0;
        }

        case IDM_FILE_SAVE: {
          const path = typeof window !== "undefined"
            ? window.prompt("Enter VFS path to save (e.g. C:\\lua\\my_script.lua):", "C:\\lua\\my_script.lua")
            : "C:\\lua\\my_script.lua";
          if (path) {
            const content = GetWindowText(ctx.hEditScript);
            vfs.writeTextFile(path, content).then((ok) => {
              if (ok) {
                appendConsole(ctx, `✓ Saved script to: ${path}`);
                MessageBox(hwnd, `Script saved successfully to ${path}`, "Save Script", MB_OK);
              } else {
                MessageBox(hwnd, "Failed to save file.", "Save Error", MB_OK);
              }
            });
          }
          return 0;
        }

        case IDM_FILE_EXIT: {
          kernel.DestroyWindow(hwnd);
          return 0;
        }

        case IDM_HELP_ABOUT: {
          MessageBox(
            hwnd,
            "Lua 5.3 Command Center for Win32-Svelte\n\n" +
            "• Powered by the Fengari Lua 5.3 Virtual Machine\n" +
            "• Full Win32 user32/gdi32/audio/vfs integration\n" +
            "• Register custom window classes and window procedures in Lua\n" +
            "• Run scripts directly with F5",
            "About Lua 5.3",
            MB_OK | MB_ICONINFORMATION
          );
          return 0;
        }
      }
      return 0;
    }

    case WM_SIZE: {
      const ctx = hostContexts.get(hwnd);
      if (!ctx) return 0;
      const win = kernel.getWindow(hwnd);
      if (!win) return 0;

      const clientW = Math.max(win.width - 24, 300);
      const clientH = Math.max(win.height - 70, 200);

      const splitH = Math.floor((clientH - 45) * 0.58);
      const consoleH = clientH - 45 - splitH;

      // Script Editor sizing
      const scriptWin = kernel.getWindow(ctx.hEditScript);
      if (scriptWin) {
        scriptWin.width = clientW;
        scriptWin.height = splitH;
      }

      // Console sizing
      const consoleWin = kernel.getWindow(ctx.hEditConsole);
      if (consoleWin) {
        consoleWin.y = 40 + splitH + 6;
        consoleWin.width = clientW;
        consoleWin.height = consoleH;
      }
      return 0;
    }

    case WM_DESTROY: {
      const ctx = hostContexts.get(hwnd);
      if (ctx) {
        ctx.runtime.dispose();
        hostContexts.delete(hwnd);
      }
      return 0;
    }

    default:
      return DefWindowProc(hwnd, uMsg, wParam, lParam);
  }
}

export function StartLuaHost(
  x = 220,
  y = 70,
  initialScriptOrPath?: string
): HWND {
  RegisterClassEx({
    className: "Win32LuaHost",
    lpfnWndProc: LuaHostWndProc,
  });

  const hwnd = CreateWindowEx(
    0,
    "Win32LuaHost",
    "🌙 Lua 5.3 Command Center",
    WS_OVERLAPPEDWINDOW,
    x,
    y,
    520,
    440,
    null,
    null
  );

  ShowWindow(hwnd, SW_SHOW);

  // If a file path or initial code was provided, load it into the editor
  if (initialScriptOrPath) {
    const ctx = hostContexts.get(hwnd);
    if (ctx) {
      if (initialScriptOrPath.includes("\n")) {
        // Direct script code
        SetWindowText(ctx.hEditScript, initialScriptOrPath);
      } else {
        // VFS Path
        vfs.readTextFile(initialScriptOrPath).then(
          (content) => {
            SetWindowText(ctx.hEditScript, content);
            appendConsole(ctx, `✓ Loaded initial script: ${initialScriptOrPath}`);
          },
          () => {}
        );
      }
    }
  }

  return hwnd;
}
