import {
  CreateWindowEx,
  RegisterClassEx,
  ShowWindow,
  DestroyWindow,
  DefWindowProc,
  CreateMenu,
  CreatePopupMenu,
  AppendMenu,
  SetMenu,
  MessageBox,
  kernel,
} from "../win32/kernel.svelte";
import {
  WS_OVERLAPPEDWINDOW,
  WS_VISIBLE,
  SW_SHOW,
  WM_CREATE,
  WM_COMMAND,
  WM_PAINT,
  WM_KEYDOWN,
  WM_KEYUP,
  WM_LBUTTONDOWN,
  WM_LBUTTONUP,
  WM_CLOSE,
  WM_DESTROY,
  MF_STRING,
  MF_SEPARATOR,
  MB_OK,
  MB_ICONINFORMATION,
} from "../win32/constants";
import type { HWND, UINT, WPARAM, LPARAM, LRESULT } from "../win32/types";
import { GetWindowCanvas } from "../win32/gdi";
import { DoomRuntime } from "../win32/doom_runtime";

// Menu Command IDs
const IDM_GAME_NEW = 1001;
const IDM_GAME_PAUSE = 1002;
const IDM_GAME_EXIT = 1003;
const IDM_HELP_CONTROLS = 2001;
const IDM_HELP_ABOUT = 2002;

// Track active runtime per window
const doomRuntimes = new Map<HWND, DoomRuntime>();

function DoomWndProc(hwnd: HWND, uMsg: UINT, wParam: WPARAM, lParam: LPARAM): LRESULT {
  const runtime = doomRuntimes.get(hwnd);

  switch (uMsg) {
    case WM_CREATE: {
      return 0;
    }

    case WM_COMMAND: {
      const commandId = wParam;
      switch (commandId) {
        case IDM_GAME_NEW:
          if (runtime) {
            // Trigger F2 in DOOM (New Game)
            runtime.sendKey(0, 113);
            setTimeout(() => runtime.sendKey(1, 113), 50);
          }
          return 0;

        case IDM_GAME_PAUSE:
          if (runtime) {
            if (runtime.isRunning()) {
              runtime.pause();
              MessageBox(hwnd, "Game Paused. Click OK to resume.", "DOOM 95", MB_OK);
              runtime.resume();
            } else {
              runtime.resume();
            }
          }
          return 0;

        case IDM_GAME_EXIT:
          SendMessageClose(hwnd);
          return 0;

        case IDM_HELP_CONTROLS:
          MessageBox(
            hwnd,
            "DOOM Controls:\n\n" +
              "• Move: Arrow Keys or W / A / S / D\n" +
              "• Fire: Ctrl or Left Mouse Click\n" +
              "• Open / Use: Spacebar or E\n" +
              "• Speed / Run: Shift\n" +
              "• Strafe: Alt\n" +
              "• Weapons: 1 - 7\n" +
              "• Automap: Tab\n" +
              "• Menu: Esc\n",
            "DOOM 95 Controls",
            MB_OK | MB_ICONINFORMATION
          );
          return 0;

        case IDM_HELP_ABOUT:
          MessageBox(
            hwnd,
            "DOOM 95 for win32-svelte\n\n" +
              "Classic DOOM (1993) running as WebAssembly inside the Svelte 5 Win32 subsystem.\n" +
              "Port based on doomgeneric / Cornelius Diekmann wasm-fizzbuzz.\n" +
              "DOOM is © 1993 id Software.",
            "About DOOM 95",
            MB_OK | MB_ICONINFORMATION
          );
          return 0;
      }
      return 0;
    }

    case WM_KEYDOWN: {
      if (runtime) {
        runtime.sendKey(0, wParam);
      }
      return 0;
    }

    case WM_KEYUP: {
      if (runtime) {
        runtime.sendKey(1, wParam);
      }
      return 0;
    }

    case WM_LBUTTONDOWN: {
      if (runtime) {
        // Fire primary weapon on left click
        runtime.sendKey(0, 17); // Ctrl
      }
      return 0;
    }

    case WM_LBUTTONUP: {
      if (runtime) {
        runtime.sendKey(1, 17); // Release fire
      }
      return 0;
    }

    case WM_PAINT: {
      // Frame rendering is driven directly by DoomRuntime loop into canvas
      return 0;
    }

    case WM_CLOSE: {
      if (runtime) {
        runtime.stop();
        doomRuntimes.delete(hwnd);
      }
      DestroyWindow(hwnd);
      return 0;
    }

    case WM_DESTROY: {
      if (runtime) {
        runtime.stop();
        doomRuntimes.delete(hwnd);
      }
      return 0;
    }

    default:
      return DefWindowProc(hwnd, uMsg, wParam, lParam);
  }
}

function SendMessageClose(hwnd: HWND) {
  const runtime = doomRuntimes.get(hwnd);
  if (runtime) {
    runtime.stop();
    doomRuntimes.delete(hwnd);
  }
  DestroyWindow(hwnd);
}

let isClassRegistered = false;

function ensureClassRegistered() {
  if (isClassRegistered) return;
  RegisterClassEx({
    className: "DOOM95",
    lpfnWndProc: DoomWndProc,
  });
  isClassRegistered = true;
}

/**
 * Start DOOM 95 Application Window
 */
export async function StartDoom(x = 100, y = 50): Promise<HWND> {
  ensureClassRegistered();

  // Create Window with canvas properties
  const hwnd = CreateWindowEx(
    0,
    "DOOM95",
    "DOOM 95 (WASM Win32 Subsystem)",
    WS_OVERLAPPEDWINDOW | WS_VISIBLE,
    x,
    y,
    656,
    468,
    null,
    null
  );

  // Set custom canvas props for generic canvas rendering in Window.svelte
  const win = kernel.windows.find((w) => w.hwnd === hwnd);
  if (win) {
    win.customProps = {
      hasCanvas: true,
      canvasWidth: 640,
      canvasHeight: 400,
      canvasStyle: "background: #000000; image-rendering: pixelated; cursor: default;",
    };
  }

  // Setup Menu
  const hMenu = CreateMenu();
  const hGameMenu = CreatePopupMenu();
  AppendMenu(hGameMenu, MF_STRING, IDM_GAME_NEW, "&New Game\tF2");
  AppendMenu(hGameMenu, MF_STRING, IDM_GAME_PAUSE, "&Pause\tP");
  AppendMenu(hGameMenu, MF_SEPARATOR, 0, "");
  AppendMenu(hGameMenu, MF_STRING, IDM_GAME_EXIT, "E&xit\tAlt+F4");
  AppendMenu(hMenu, MF_STRING, hGameMenu, "&Game");

  const hHelpMenu = CreatePopupMenu();
  AppendMenu(hHelpMenu, MF_STRING, IDM_HELP_CONTROLS, "&Controls...\tF1");
  AppendMenu(hHelpMenu, MF_STRING, IDM_HELP_ABOUT, "&About DOOM 95...");
  AppendMenu(hMenu, MF_STRING, hHelpMenu, "&Help");

  SetMenu(hwnd, hMenu);

  ShowWindow(hwnd, SW_SHOW);

  // Initialize DOOM runtime
  const runtime = new DoomRuntime();
  doomRuntimes.set(hwnd, runtime);

  // Wait a tick for DOM canvas to mount
  setTimeout(async () => {
    const canvas = GetWindowCanvas(hwnd);
    if (canvas) {
      runtime.setCanvas(canvas);
      try {
        await runtime.init();
        runtime.start();
      } catch (err) {
        console.error("Failed to start DOOM runtime:", err);
        MessageBox(
          hwnd,
          "Failed to load DOOM WebAssembly binary. Please check network connection or /wasm/doom.wasm.",
          "DOOM 95 Error",
          MB_OK
        );
      }
    }
  }, 50);

  return hwnd;
}
