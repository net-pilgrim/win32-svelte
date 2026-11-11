import {
  RegisterClassEx,
  CreateWindowEx,
  ShowWindow,
  DefWindowProc,
  PostQuitMessage,
  SetWindowText,
  SetTimer,
  KillTimer,
  MessageBox,
  RunMessageLoop,
} from "../win32/kernel.svelte";

import {
  WM_CREATE,
  WM_COMMAND,
  WM_TIMER,
  WM_DESTROY,
  WS_OVERLAPPEDWINDOW,
  WS_VISIBLE,
  WS_CHILD,
  LOWORD,
  MB_YESNO,
  MB_ICONQUESTION,
  IDYES,
  SW_SHOW,
} from "../win32/constants";

import type { HWND, UINT, WPARAM, LPARAM, LRESULT } from "../win32/types";

const ID_LABEL = 4001;
const ID_BTN_START = 4002;
const ID_BTN_STOP = 4003;
const ID_BTN_RESET = 4004;
const ID_BTN_PROMPT = 4005;

const TIMER_ID = 1;

let hwndLabel: HWND = 0;
let counterValue = 0;
let isRunning = false;

function CounterWndProc(
  hwnd: HWND,
  uMsg: UINT,
  wParam: WPARAM,
  lParam: LPARAM
): LRESULT {
  switch (uMsg) {
    case WM_CREATE: {
      hwndLabel = CreateWindowEx(
        0,
        "STATIC",
        "Counter: 0",
        WS_CHILD | WS_VISIBLE,
        20,
        18,
        220,
        24,
        hwnd,
        ID_LABEL,
        null,
        null
      );

      CreateWindowEx(
        0,
        "BUTTON",
        "Start Timer",
        WS_CHILD | WS_VISIBLE,
        20,
        50,
        90,
        26,
        hwnd,
        ID_BTN_START,
        null,
        null
      );

      CreateWindowEx(
        0,
        "BUTTON",
        "Stop Timer",
        WS_CHILD | WS_VISIBLE,
        120,
        50,
        90,
        26,
        hwnd,
        ID_BTN_STOP,
        null,
        null
      );

      CreateWindowEx(
        0,
        "BUTTON",
        "Reset",
        WS_CHILD | WS_VISIBLE,
        20,
        84,
        90,
        26,
        hwnd,
        ID_BTN_RESET,
        null,
        null
      );

      CreateWindowEx(
        0,
        "BUTTON",
        "Ask Question",
        WS_CHILD | WS_VISIBLE,
        120,
        84,
        90,
        26,
        hwnd,
        ID_BTN_PROMPT,
        null,
        null
      );
      return 0;
    }

    case WM_TIMER: {
      if (wParam === TIMER_ID) {
        counterValue++;
        SetWindowText(hwndLabel, `Counter: ${counterValue} ticks (WM_TIMER)`);
      }
      return 0;
    }

    case WM_COMMAND: {
      const id = LOWORD(wParam);
      if (id === ID_BTN_START) {
        if (!isRunning) {
          isRunning = true;
          SetTimer(hwnd, TIMER_ID, 500); // Trigger every 500ms
        }
      } else if (id === ID_BTN_STOP) {
        if (isRunning) {
          isRunning = false;
          KillTimer(hwnd, TIMER_ID);
        }
      } else if (id === ID_BTN_RESET) {
        counterValue = 0;
        SetWindowText(hwndLabel, `Counter: 0`);
      } else if (id === ID_BTN_PROMPT) {
        MessageBox(
          hwnd,
          "Do you want to reset the counter to 100?",
          "Timer Question",
          MB_YESNO | MB_ICONQUESTION
        ).then((res) => {
          if (res === IDYES) {
            counterValue = 100;
            SetWindowText(hwndLabel, `Counter: ${counterValue}`);
          }
        });
      }
      return 0;
    }

    case WM_DESTROY: {
      KillTimer(hwnd, TIMER_ID);
      PostQuitMessage(0);
      return 0;
    }
  }

  return DefWindowProc(hwnd, uMsg, wParam, lParam);
}

export function StartCounter(x = 180, y = 300): HWND {
  const CLASS_NAME = "Win32Counter";

  RegisterClassEx({
    className: CLASS_NAME,
    lpfnWndProc: CounterWndProc,
  });

  const hwnd = CreateWindowEx(
    0,
    CLASS_NAME,
    "Win32 Timer & Controls",
    WS_OVERLAPPEDWINDOW | WS_VISIBLE,
    x,
    y,
    250,
    160,
    null,
    null,
    null,
    null
  );

  ShowWindow(hwnd, SW_SHOW);
  RunMessageLoop();
  return hwnd;
}
