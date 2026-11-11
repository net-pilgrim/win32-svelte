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
  CreateMenu,
  CreatePopupMenu,
  AppendMenu,
  SetMenu,
  audio,
  kernel,
} from "../win32/kernel.svelte";

import {
  WM_CREATE,
  WM_COMMAND,
  WM_TIMER,
  WM_CLOSE,
  WM_DESTROY,
  WS_OVERLAPPEDWINDOW,
  WS_VISIBLE,
  WS_CHILD,
  MF_STRING,
  MF_POPUP,
  MF_SEPARATOR,
  MF_CHECKED,
  LOWORD,
  HIWORD,
  BN_CLICKED,
  BN_RIGHTCLICK,
  MB_OK,
  SW_SHOW,
} from "../win32/constants";

import type { HWND, UINT, WPARAM, LPARAM, LRESULT } from "../win32/types";

const ROWS = 9;
const COLS = 9;
const TOTAL_CELLS = ROWS * COLS;
const TOTAL_MINES = 10;
const CELL_SIZE = 20;

const ID_SMILEY = 5000;
const ID_MINES_LED = 5001;
const ID_TIMER_LED = 5002;
const ID_CELL_BASE = 5100;

const ID_GAME_NEW = 5201;
const ID_GAME_BEGINNER = 5202;
const ID_GAME_EXIT = 5203;
const ID_HELP_ABOUT = 5204;

const TIMER_EVENT_ID = 2;

const NUMBER_COLORS: Record<number, string> = {
  1: "#0000ff",
  2: "#008000",
  3: "#ff0000",
  4: "#000080",
  5: "#800000",
  6: "#008080",
  7: "#000000",
  8: "#808080",
};

interface GameSession {
  hwndMain: HWND;
  hwndSmiley: HWND;
  hwndMinesLed: HWND;
  hwndTimerLed: HWND;
  cellHwnds: HWND[];
  mines: Set<number>;
  revealed: boolean[];
  flagged: boolean[];
  state: "idle" | "playing" | "won" | "lost";
  seconds: number;
}

const sessions = new Map<HWND, GameSession>();

function format3Digits(n: number): string {
  const clamped = Math.max(-99, Math.min(999, n));
  if (clamped < 0) {
    return "-" + String(Math.abs(clamped)).padStart(2, "0");
  }
  return String(clamped).padStart(3, "0");
}

function getNeighbors(idx: number): number[] {
  const r = Math.floor(idx / COLS);
  const c = idx % COLS;
  const result: number[] = [];

  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
        result.push(nr * COLS + nc);
      }
    }
  }
  return result;
}

function countNeighborMines(idx: number, mines: Set<number>): number {
  return getNeighbors(idx).filter((n) => mines.has(n)).length;
}

function initGame(session: GameSession) {
  session.mines.clear();
  session.revealed.fill(false);
  session.flagged.fill(false);
  session.state = "idle";
  session.seconds = 0;

  KillTimer(session.hwndMain, TIMER_EVENT_ID);

  SetWindowText(session.hwndSmiley, "🙂");
  SetWindowText(session.hwndMinesLed, format3Digits(TOTAL_MINES));
  SetWindowText(session.hwndTimerLed, "000");

  for (let i = 0; i < TOTAL_CELLS; i++) {
    const hwndCell = session.cellHwnds[i];
    const rec = kernel.getWindow(hwndCell);
    if (rec) {
      rec.title = "";
      rec.customProps = {
        className: "mine-cell",
        style: "",
      };
    }
  }
}

function placeMines(avoidIdx: number, session: GameSession) {
  const candidates: number[] = [];
  for (let i = 0; i < TOTAL_CELLS; i++) {
    if (i !== avoidIdx) candidates.push(i);
  }

  // Shuffle
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  session.mines.clear();
  for (let i = 0; i < TOTAL_MINES; i++) {
    session.mines.add(candidates[i]);
  }
}

function revealCell(idx: number, session: GameSession) {
  if (session.revealed[idx] || session.flagged[idx]) return;

  session.revealed[idx] = true;
  const cellHwnd = session.cellHwnds[idx];
  const rec = kernel.getWindow(cellHwnd);
  if (!rec) return;

  const count = countNeighborMines(idx, session.mines);
  rec.customProps = {
    className: "mine-cell mine-cell-revealed",
    style: count > 0 ? `color: ${NUMBER_COLORS[count]}; font-weight: bold;` : "",
  };
  rec.title = count > 0 ? String(count) : "";

  // If 0, cascade reveal neighbors
  if (count === 0) {
    const neighbors = getNeighbors(idx);
    for (const n of neighbors) {
      revealCell(n, session);
    }
  }
}

function checkWin(session: GameSession): boolean {
  let revealedCount = 0;
  for (let i = 0; i < TOTAL_CELLS; i++) {
    if (session.revealed[i]) revealedCount++;
  }
  return revealedCount === TOTAL_CELLS - TOTAL_MINES;
}

function handleGameOver(boomIdx: number, session: GameSession) {
  session.state = "lost";
  audio.playExplosion();
  KillTimer(session.hwndMain, TIMER_EVENT_ID);
  SetWindowText(session.hwndSmiley, "😵");

  // Reveal all mines
  for (let i = 0; i < TOTAL_CELLS; i++) {
    const isMine = session.mines.has(i);
    const rec = kernel.getWindow(session.cellHwnds[i]);
    if (!rec) continue;

    if (isMine) {
      if (i === boomIdx) {
        rec.title = "💥";
        rec.customProps = { className: "mine-cell mine-cell-boom" };
      } else if (!session.flagged[i]) {
        rec.title = "💣";
        rec.customProps = { className: "mine-cell mine-cell-revealed" };
      }
    } else if (session.flagged[i]) {
      // False flag
      rec.title = "❌";
      rec.customProps = { className: "mine-cell mine-cell-revealed" };
    }
  }

  MessageBox(session.hwndMain, "Game Over! You stepped on a mine.", "Minesweeper", MB_OK);
}

function handleGameWin(session: GameSession) {
  session.state = "won";
  audio.playTada();
  KillTimer(session.hwndMain, TIMER_EVENT_ID);
  SetWindowText(session.hwndSmiley, "😎");
  SetWindowText(session.hwndMinesLed, "000");

  // Flag all remaining mines
  for (const mineIdx of session.mines) {
    const rec = kernel.getWindow(session.cellHwnds[mineIdx]);
    if (rec) {
      rec.title = "🚩";
    }
  }

  MessageBox(
    session.hwndMain,
    `Congratulations! You cleared the minefield in ${session.seconds} seconds!`,
    "Minesweeper",
    MB_OK
  );
}

function MinesweeperWndProc(
  hwnd: HWND,
  uMsg: UINT,
  wParam: WPARAM,
  lParam: LPARAM
): LRESULT {
  const session = sessions.get(hwnd);

  switch (uMsg) {
    case WM_CREATE: {
      const newSession: GameSession = {
        hwndMain: hwnd,
        hwndSmiley: 0,
        hwndMinesLed: 0,
        hwndTimerLed: 0,
        cellHwnds: [],
        mines: new Set(),
        revealed: new Array(TOTAL_CELLS).fill(false),
        flagged: new Array(TOTAL_CELLS).fill(false),
        state: "idle",
        seconds: 0,
      };
      sessions.set(hwnd, newSession);

      // Create Menu Bar
      const hMenuBar = CreateMenu();
      const hMenuGame = CreatePopupMenu();
      AppendMenu(hMenuGame, MF_STRING, ID_GAME_NEW, "&New", "F2");
      AppendMenu(hMenuGame, MF_SEPARATOR, 0, "");
      AppendMenu(hMenuGame, MF_STRING | MF_CHECKED, ID_GAME_BEGINNER, "&Beginner");
      AppendMenu(hMenuGame, MF_SEPARATOR, 0, "");
      AppendMenu(hMenuGame, MF_STRING, ID_GAME_EXIT, "E&xit");
      AppendMenu(hMenuBar, MF_POPUP, hMenuGame, "&Game");

      const hMenuHelp = CreatePopupMenu();
      AppendMenu(hMenuHelp, MF_STRING, ID_HELP_ABOUT, "&About Minesweeper...");
      AppendMenu(hMenuBar, MF_POPUP, hMenuHelp, "&Help");

      SetMenu(hwnd, hMenuBar);

      // Top Header Controls
      newSession.hwndMinesLed = CreateWindowEx(
        0,
        "STATIC",
        "010",
        WS_CHILD | WS_VISIBLE,
        14,
        12,
        42,
        26,
        hwnd,
        ID_MINES_LED,
        null,
        null
      );
      const minesLedWin = kernel.getWindow(newSession.hwndMinesLed);
      if (minesLedWin) minesLedWin.customProps = { className: "win32-led" };

      newSession.hwndSmiley = CreateWindowEx(
        0,
        "BUTTON",
        "🙂",
        WS_CHILD | WS_VISIBLE,
        86,
        12,
        26,
        26,
        hwnd,
        ID_SMILEY,
        null,
        null
      );
      const smileyWin = kernel.getWindow(newSession.hwndSmiley);
      if (smileyWin) smileyWin.customProps = { className: "smiley-button" };

      newSession.hwndTimerLed = CreateWindowEx(
        0,
        "STATIC",
        "000",
        WS_CHILD | WS_VISIBLE,
        138,
        12,
        42,
        26,
        hwnd,
        ID_TIMER_LED,
        null,
        null
      );
      const timerLedWin = kernel.getWindow(newSession.hwndTimerLed);
      if (timerLedWin) timerLedWin.customProps = { className: "win32-led" };

      // 9x9 Grid of Buttons
      const gridTop = 48;
      const gridLeft = 8;

      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const idx = r * COLS + c;
          const cellHwnd = CreateWindowEx(
            0,
            "BUTTON",
            "",
            WS_CHILD | WS_VISIBLE,
            gridLeft + c * CELL_SIZE,
            gridTop + r * CELL_SIZE,
            CELL_SIZE,
            CELL_SIZE,
            hwnd,
            ID_CELL_BASE + idx,
            null,
            null
          );
          const cellWin = kernel.getWindow(cellHwnd);
          if (cellWin) {
            cellWin.customProps = { className: "mine-cell" };
          }
          newSession.cellHwnds.push(cellHwnd);
        }
      }

      initGame(newSession);
      return 0;
    }

    case WM_TIMER: {
      if (session && session.state === "playing" && wParam === TIMER_EVENT_ID) {
        session.seconds = Math.min(999, session.seconds + 1);
        SetWindowText(session.hwndTimerLed, format3Digits(session.seconds));
      }
      return 0;
    }

    case WM_COMMAND: {
      if (!session) return 0;
      const controlId = LOWORD(wParam);
      const notifCode = HIWORD(wParam);

      // Menu Commands
      if (controlId === ID_GAME_NEW) {
        initGame(session);
        return 0;
      }
      if (controlId === ID_GAME_EXIT) {
        DefWindowProc(hwnd, WM_CLOSE, 0, 0);
        return 0;
      }
      if (controlId === ID_HELP_ABOUT) {
        MessageBox(
          hwnd,
          "Minesweeper for Win32-JS\n\nClassic Minesweeper running entirely in TypeScript & Svelte 5 with Win32 message pumps.",
          "About Minesweeper",
          MB_OK
        );
        return 0;
      }

      // Smiley Click -> Restart
      if (controlId === ID_SMILEY && notifCode === BN_CLICKED) {
        initGame(session);
        return 0;
      }

      // Cell interactions
      if (controlId >= ID_CELL_BASE && controlId < ID_CELL_BASE + TOTAL_CELLS) {
        const cellIdx = controlId - ID_CELL_BASE;

        // Left Click
        if (notifCode === BN_CLICKED) {
          if (session.state === "won" || session.state === "lost" || session.flagged[cellIdx]) {
            return 0;
          }

          if (session.state === "idle") {
            placeMines(cellIdx, session);
            session.state = "playing";
            SetTimer(hwnd, TIMER_EVENT_ID, 1000);
          }

          if (session.mines.has(cellIdx)) {
            handleGameOver(cellIdx, session);
            return 0;
          }

          revealCell(cellIdx, session);

          if (checkWin(session)) {
            handleGameWin(session);
          }
          return 0;
        }

        // Right Click
        if (notifCode === BN_RIGHTCLICK) {
          if (session.state === "won" || session.state === "lost" || session.revealed[cellIdx]) {
            return 0;
          }

          session.flagged[cellIdx] = !session.flagged[cellIdx];
          const rec = kernel.getWindow(session.cellHwnds[cellIdx]);
          if (rec) {
            rec.title = session.flagged[cellIdx] ? "🚩" : "";
          }

          const flagCount = session.flagged.filter(Boolean).length;
          SetWindowText(session.hwndMinesLed, format3Digits(TOTAL_MINES - flagCount));
          return 0;
        }
      }
      return 0;
    }

    case WM_DESTROY: {
      if (session) {
        KillTimer(hwnd, TIMER_EVENT_ID);
        sessions.delete(hwnd);
      }
      PostQuitMessage(0);
      return 0;
    }
  }

  return DefWindowProc(hwnd, uMsg, wParam, lParam);
}

export function StartMinesweeper(x = 100, y = 100): HWND {
  const CLASS_NAME = "Win32Minesweeper";

  RegisterClassEx({
    className: CLASS_NAME,
    lpfnWndProc: MinesweeperWndProc,
  });

  const hwnd = CreateWindowEx(
    0,
    CLASS_NAME,
    "Minesweeper",
    WS_OVERLAPPEDWINDOW | WS_VISIBLE,
    x,
    y,
    212,
    306,
    null,
    null,
    null,
    null
  );

  ShowWindow(hwnd, SW_SHOW);
  RunMessageLoop();
  return hwnd;
}
