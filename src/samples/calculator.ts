import {
  RegisterClassEx,
  CreateWindowEx,
  ShowWindow,
  DefWindowProc,
  PostQuitMessage,
  SetWindowText,
  GetWindowText,
  MessageBox,
  RunMessageLoop,
} from "../win32/kernel.svelte";

import {
  WM_CREATE,
  WM_COMMAND,
  WM_DESTROY,
  WS_OVERLAPPEDWINDOW,
  WS_VISIBLE,
  WS_CHILD,
  ES_READONLY,
  ES_RIGHT,
  LOWORD,
  MB_OK,
  MB_ICONERROR,
  SW_SHOW,
} from "../win32/constants";

import type { HWND, UINT, WPARAM, LPARAM, LRESULT } from "../win32/types";

// Control IDs
const ID_DISPLAY = 1000;
const ID_CLEAR = 1001;
const ID_EQUALS = 1002;
const ID_ADD = 1003;
const ID_SUB = 1004;
const ID_MUL = 1005;
const ID_DIV = 1006;
const ID_DIGIT_BASE = 2000; // 2000..2009 for digits 0..9

let hwndDisplay: HWND = 0;
let currentExpression = "0";
let resetOnNextDigit = false;

function CalculatorWndProc(
  hwnd: HWND,
  uMsg: UINT,
  wParam: WPARAM,
  lParam: LPARAM
): LRESULT {
  switch (uMsg) {
    case WM_CREATE: {
      // Create Calculator Display (EDIT control)
      hwndDisplay = CreateWindowEx(
        0,
        "EDIT",
        "0",
        WS_CHILD | WS_VISIBLE | ES_READONLY | ES_RIGHT,
        14,
        14,
        192,
        26,
        hwnd,
        ID_DISPLAY,
        null,
        null
      );

      // Create Keypad buttons
      const buttons: Array<{ text: string; id: number; x: number; y: number; w?: number }> = [
        // Row 1
        { text: "C", id: ID_CLEAR, x: 14, y: 50, w: 42 },
        { text: "/", id: ID_DIV, x: 64, y: 50, w: 42 },
        { text: "*", id: ID_MUL, x: 114, y: 50, w: 42 },
        { text: "-", id: ID_SUB, x: 164, y: 50, w: 42 },

        // Row 2: 7, 8, 9, +
        { text: "7", id: ID_DIGIT_BASE + 7, x: 14, y: 84, w: 42 },
        { text: "8", id: ID_DIGIT_BASE + 8, x: 64, y: 84, w: 42 },
        { text: "9", id: ID_DIGIT_BASE + 9, x: 114, y: 84, w: 42 },
        { text: "+", id: ID_ADD, x: 164, y: 84, w: 42 },

        // Row 3: 4, 5, 6
        { text: "4", id: ID_DIGIT_BASE + 4, x: 14, y: 118, w: 42 },
        { text: "5", id: ID_DIGIT_BASE + 5, x: 64, y: 118, w: 42 },
        { text: "6", id: ID_DIGIT_BASE + 6, x: 114, y: 118, w: 42 },

        // Row 4: 1, 2, 3, =
        { text: "1", id: ID_DIGIT_BASE + 1, x: 14, y: 152, w: 42 },
        { text: "2", id: ID_DIGIT_BASE + 2, x: 64, y: 152, w: 42 },
        { text: "3", id: ID_DIGIT_BASE + 3, x: 114, y: 152, w: 42 },
        { text: "=", id: ID_EQUALS, x: 164, y: 118, w: 42 },

        // Row 5: 0
        { text: "0", id: ID_DIGIT_BASE + 0, x: 14, y: 186, w: 92 },
        { text: ".", id: 2010, x: 114, y: 186, w: 42 },
      ];

      for (const btn of buttons) {
        CreateWindowEx(
          0,
          "BUTTON",
          btn.text,
          WS_CHILD | WS_VISIBLE,
          btn.x,
          btn.y,
          btn.w ?? 42,
          btn.id === ID_EQUALS ? 62 : 28,
          hwnd,
          btn.id,
          null,
          null
        );
      }
      return 0;
    }

    case WM_COMMAND: {
      const controlId = LOWORD(wParam);

      // Digit pressed
      if (controlId >= ID_DIGIT_BASE && controlId <= ID_DIGIT_BASE + 9) {
        const digit = String(controlId - ID_DIGIT_BASE);
        if (currentExpression === "0" || resetOnNextDigit) {
          currentExpression = digit;
          resetOnNextDigit = false;
        } else {
          currentExpression += digit;
        }
        SetWindowText(hwndDisplay, currentExpression);
        return 0;
      }

      if (controlId === 2010) {
        // Decimal point
        if (!currentExpression.includes(".")) {
          currentExpression += ".";
          SetWindowText(hwndDisplay, currentExpression);
        }
        return 0;
      }

      // Operators
      if (controlId === ID_CLEAR) {
        currentExpression = "0";
        resetOnNextDigit = false;
        SetWindowText(hwndDisplay, currentExpression);
        return 0;
      }

      const opMap: Record<number, string> = {
        [ID_ADD]: "+",
        [ID_SUB]: "-",
        [ID_MUL]: "*",
        [ID_DIV]: "/",
      };

      if (opMap[controlId]) {
        currentExpression += ` ${opMap[controlId]} `;
        resetOnNextDigit = false;
        SetWindowText(hwndDisplay, currentExpression);
        return 0;
      }

      if (controlId === ID_EQUALS) {
        try {
          // Check divide by zero
          if (currentExpression.includes("/ 0")) {
            MessageBox(hwnd, "Cannot divide by zero!", "Calculator Error", MB_OK | MB_ICONERROR);
            currentExpression = "0";
            SetWindowText(hwndDisplay, currentExpression);
            return 0;
          }
          // Simple safe evaluation
          const result = Function(`"use strict"; return (${currentExpression})`)();
          currentExpression = String(result);
          resetOnNextDigit = true;
          SetWindowText(hwndDisplay, currentExpression);
        } catch {
          MessageBox(hwnd, "Invalid Expression!", "Calculator Error", MB_OK | MB_ICONERROR);
        }
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

export function StartCalculator(x = 60, y = 60): HWND {
  const CLASS_NAME = "Win32Calculator";

  RegisterClassEx({
    className: CLASS_NAME,
    lpfnWndProc: CalculatorWndProc,
  });

  const hwnd = CreateWindowEx(
    0,
    CLASS_NAME,
    "Calculator",
    WS_OVERLAPPEDWINDOW | WS_VISIBLE,
    x,
    y,
    230,
    270,
    null,
    null,
    null,
    null
  );

  ShowWindow(hwnd, SW_SHOW);
  RunMessageLoop();
  return hwnd;
}
