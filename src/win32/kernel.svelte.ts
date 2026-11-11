import {
  WM_NULL,
  WM_CREATE,
  WM_DESTROY,
  WM_MOVE,
  WM_SIZE,
  WM_CLOSE,
  WM_QUIT,
  WM_COMMAND,
  WM_SETTEXT,
  WM_GETTEXT,
  WM_LBUTTONDOWN,
  WM_LBUTTONUP,
  WM_RBUTTONDOWN,
  WM_RBUTTONUP,
  WM_TIMER,
  WS_VISIBLE,
  WS_CHILD,
  SW_HIDE,
  SW_SHOW,
  SW_MINIMIZE,
  SW_MAXIMIZE,
  SW_RESTORE,
  BS_CHECKBOX,
  BS_AUTOCHECKBOX,
  BS_RADIOBUTTON,
  BS_AUTORADIOBUTTON,
  BS_GROUPBOX,
  BN_CLICKED,
  BN_RIGHTCLICK,
  BM_GETCHECK,
  BM_SETCHECK,
  BST_UNCHECKED,
  BST_CHECKED,
  CB_ADDSTRING,
  CB_SETCURSEL,
  CB_GETCURSEL,
  CB_GETLBTEXT,
  CBN_SELCHANGE,
  PBM_SETRANGE,
  PBM_SETPOS,
  PBM_STEPIT,
  TBM_GETPOS,
  TBM_SETPOS,
  TBM_SETRANGE,
  MF_STRING,
  MF_POPUP,
  MF_SEPARATOR,
  MF_DISABLED,
  MF_GRAYED,
  MF_CHECKED,
  MF_UNCHECKED,
  EN_CHANGE,
  IDOK,
  IDCANCEL,
  IDYES,
  IDNO,
  MB_OK,
  MB_OKCANCEL,
  MB_YESNO,
  MAKEWPARAM,
  LOWORD,
  HIWORD,
} from "./constants";

import { MessageBeep } from "./audio";

import type {
  HWND,
  HMENU,
  UINT,
  WPARAM,
  LPARAM,
  LRESULT,
  MSG,
  WndProc,
  WNDCLASSEX,
  WindowRecord,
  MenuRecord,
  MenuItem,
  MessageBoxOptions,
} from "./types";

class Win32Kernel {
  private nextHwnd = 100;
  private topZIndex = 10;
  private classes = new Map<string, WNDCLASSEX>();
  private messageQueue: MSG[] = [];
  private messageQueueWaiters: Array<(msg: MSG | null) => void> = [];
  private timers = new Map<number, { timerId: number; hwnd: HWND; interval: number; intervalId: any }>();
  private nextTimerId = 1;
  private nextHmenu = 500;

  // Svelte 5 reactive state
  public windows = $state<WindowRecord[]>([]);
  public menus = $state<MenuRecord[]>([]);
  public activeHwnd = $state<HWND | null>(null);
  public activeMessageBox = $state<MessageBoxOptions | null>(null);

  constructor() {
    this.registerBuiltInClasses();
  }

  private registerBuiltInClasses() {
    // BUTTON window class (handles Pushbuttons, Checkboxes, Radio buttons, Groupboxes)
    this.RegisterClassEx({
      className: "BUTTON",
      lpfnWndProc: (hwnd, msg, wParam, lParam) => {
        const win = this.getWindow(hwnd);
        if (!win) return 0;

        switch (msg) {
          case WM_LBUTTONDOWN:
            if (win.controlState) {
              win.controlState.isPressed = true;
            }
            return 0;

          case WM_LBUTTONUP:
            if (win.controlState && win.controlState.isPressed) {
              win.controlState.isPressed = false;

              // Checkbox auto-toggle
              if ((win.style & BS_AUTOCHECKBOX) === BS_AUTOCHECKBOX || (win.style & BS_CHECKBOX) === BS_CHECKBOX) {
                win.controlState.checked = win.controlState.checked === BST_CHECKED ? BST_UNCHECKED : BST_CHECKED;
              }

              // Radio button auto-select
              if ((win.style & BS_AUTORADIOBUTTON) === BS_AUTORADIOBUTTON || (win.style & BS_RADIOBUTTON) === BS_RADIOBUTTON) {
                win.controlState.checked = BST_CHECKED;
                // Uncheck sibling radio buttons with same parent
                if (win.parentHwnd !== null) {
                  const siblings = this.windows.filter(
                    (w) => w.parentHwnd === win.parentHwnd &&
                           w.hwnd !== win.hwnd &&
                           w.className.toUpperCase() === "BUTTON" &&
                           ((w.style & BS_AUTORADIOBUTTON) === BS_AUTORADIOBUTTON || (w.style & BS_RADIOBUTTON) === BS_RADIOBUTTON) &&
                           (w.customProps?.groupName ?? "") === (win.customProps?.groupName ?? "")
                  );
                  for (const s of siblings) {
                    if (s.controlState) s.controlState.checked = BST_UNCHECKED;
                  }
                }
              }

              if (win.parentHwnd !== null) {
                const cmdWParam = MAKEWPARAM(win.menuId ?? 0, BN_CLICKED);
                this.SendMessage(win.parentHwnd, WM_COMMAND, cmdWParam, hwnd);
              }
            }
            return 0;

          case WM_RBUTTONDOWN:
            return 0;

          case WM_RBUTTONUP:
            if (win.parentHwnd !== null) {
              const cmdWParam = MAKEWPARAM(win.menuId ?? 0, BN_RIGHTCLICK);
              this.SendMessage(win.parentHwnd, WM_COMMAND, cmdWParam, hwnd);
            }
            return 0;

          case BM_GETCHECK:
            return (win.controlState?.checked ?? BST_UNCHECKED) as any;

          case BM_SETCHECK:
            if (!win.controlState) win.controlState = {};
            win.controlState.checked = wParam;
            return 0;

          case WM_SETTEXT: {
            win.title = String(lParam);
            return 1;
          }

          case WM_GETTEXT: {
            return win.title as any;
          }
        }
        return this.DefWindowProc(hwnd, msg, wParam, lParam);
      },
    });

    // STATIC window class
    this.RegisterClassEx({
      className: "STATIC",
      lpfnWndProc: (hwnd, msg, wParam, lParam) => {
        const win = this.getWindow(hwnd);
        if (!win) return 0;

        switch (msg) {
          case WM_SETTEXT:
            win.title = String(lParam);
            return 1;
          case WM_GETTEXT:
            return win.title as any;
        }
        return this.DefWindowProc(hwnd, msg, wParam, lParam);
      },
    });

    // EDIT window class
    this.RegisterClassEx({
      className: "EDIT",
      lpfnWndProc: (hwnd, msg, wParam, lParam) => {
        const win = this.getWindow(hwnd);
        if (!win) return 0;

        switch (msg) {
          case WM_SETTEXT:
            if (!win.controlState) win.controlState = {};
            win.controlState.value = String(lParam);
            return 1;

          case WM_GETTEXT:
            return (win.controlState?.value ?? "") as any;

          case WM_COMMAND:
            if (win.parentHwnd !== null) {
              const cmdWParam = MAKEWPARAM(win.menuId ?? 0, EN_CHANGE);
              this.SendMessage(win.parentHwnd, WM_COMMAND, cmdWParam, hwnd);
            }
            return 0;
        }
        return this.DefWindowProc(hwnd, msg, wParam, lParam);
      },
    });

    // COMBOBOX window class
    const comboboxProc: WndProc = (hwnd, msg, wParam, lParam) => {
      const win = this.getWindow(hwnd);
      if (!win) return 0;
      if (!win.controlState) {
        win.controlState = { items: [], selectedIndex: 0 };
      }
      if (!win.controlState.items) {
        win.controlState.items = [];
      }

      switch (msg) {
        case CB_ADDSTRING: {
          const str = String(lParam);
          win.controlState.items.push(str);
          return win.controlState.items.length - 1;
        }
        case CB_SETCURSEL: {
          win.controlState.selectedIndex = wParam;
          return wParam;
        }
        case CB_GETCURSEL: {
          return win.controlState.selectedIndex ?? 0;
        }
        case CB_GETLBTEXT: {
          return (win.controlState.items[wParam] ?? "") as any;
        }
      }
      return this.DefWindowProc(hwnd, msg, wParam, lParam);
    };
    this.RegisterClassEx({ className: "COMBOBOX", lpfnWndProc: comboboxProc });

    // PROGRESS window class (msctls_progress32)
    const progressProc: WndProc = (hwnd, msg, wParam, lParam) => {
      const win = this.getWindow(hwnd);
      if (!win) return 0;
      if (!win.controlState) {
        win.controlState = { progressPos: 0, rangeMin: 0, rangeMax: 100 };
      }

      switch (msg) {
        case PBM_SETPOS: {
          const old = win.controlState.progressPos ?? 0;
          win.controlState.progressPos = Math.max(0, Math.min(100, wParam));
          return old;
        }
        case PBM_SETRANGE: {
          win.controlState.rangeMin = LOWORD(lParam);
          win.controlState.rangeMax = HIWORD(lParam);
          return 0;
        }
        case PBM_STEPIT: {
          const pos = (win.controlState.progressPos ?? 0) + 10;
          win.controlState.progressPos = Math.min(100, pos);
          return win.controlState.progressPos;
        }
      }
      return this.DefWindowProc(hwnd, msg, wParam, lParam);
    };
    this.RegisterClassEx({ className: "PROGRESS", lpfnWndProc: progressProc });
    this.RegisterClassEx({ className: "MSCTLS_PROGRESS32", lpfnWndProc: progressProc });

    // TRACKBAR / Slider window class (msctls_trackbar32)
    const trackbarProc: WndProc = (hwnd, msg, wParam, lParam) => {
      const win = this.getWindow(hwnd);
      if (!win) return 0;
      if (!win.controlState) {
        win.controlState = { progressPos: 50, rangeMin: 0, rangeMax: 100 };
      }

      switch (msg) {
        case TBM_SETPOS: {
          win.controlState.progressPos = lParam;
          return 0;
        }
        case TBM_GETPOS: {
          return win.controlState.progressPos ?? 0;
        }
        case TBM_SETRANGE: {
          win.controlState.rangeMin = LOWORD(lParam);
          win.controlState.rangeMax = HIWORD(lParam);
          return 0;
        }
      }
      return this.DefWindowProc(hwnd, msg, wParam, lParam);
    };
    this.RegisterClassEx({ className: "TRACKBAR", lpfnWndProc: trackbarProc });
    this.RegisterClassEx({ className: "MSCTLS_TRACKBAR32", lpfnWndProc: trackbarProc });
  }

  public getWindow(hwnd: HWND): WindowRecord | undefined {
    return this.windows.find((w) => w.hwnd === hwnd);
  }

  public RegisterClassEx(wc: WNDCLASSEX): boolean {
    this.classes.set(wc.className.toUpperCase(), wc);
    return true;
  }

  public CreateWindowEx(
    exStyle: number,
    className: string,
    title: string,
    style: number,
    x: number,
    y: number,
    width: number,
    height: number,
    parentHwnd: HWND | null = null,
    menuId: number | null = null,
    _instance: any = null,
    param: any = null
  ): HWND {
    const classDef = this.classes.get(className.toUpperCase());
    if (!classDef) {
      console.error(`RegisterClassEx must be called before CreateWindowEx for "${className}"`);
      return 0;
    }

    const hwnd = ++this.nextHwnd;
    const isVisible = (style & WS_VISIBLE) !== 0;

    const record: WindowRecord = {
      hwnd,
      parentHwnd,
      className,
      wndProc: classDef.lpfnWndProc,
      title,
      x,
      y,
      width,
      height,
      style,
      exStyle,
      menuId,
      visible: isVisible,
      minimized: false,
      maximized: false,
      enabled: true,
      zIndex: ++this.topZIndex,
      controlState: {
        isPressed: false,
        value: className.toUpperCase() === "EDIT" ? title : "",
      },
      customProps: {},
    };

    this.windows.push(record);

    if (parentHwnd === null) {
      this.activeHwnd = hwnd;
    }

    // WM_CREATE message (synchronous)
    const createStruct = {
      lpCreateParams: param,
      hwndParent: parentHwnd,
      cy: height,
      cx: width,
      y,
      x,
      style,
      lpszName: title,
      lpszClass: className,
      dwExStyle: exStyle,
    };

    const res = this.SendMessage(hwnd, WM_CREATE, 0, createStruct as any);
    if (res === -1) {
      this.DestroyWindow(hwnd);
      return 0;
    }

    return hwnd;
  }

  public ShowWindow(hwnd: HWND, nCmdShow: number): boolean {
    const win = this.getWindow(hwnd);
    if (!win) return false;

    switch (nCmdShow) {
      case SW_HIDE:
        win.visible = false;
        break;
      case SW_SHOW:
      case 1: // SW_SHOWNORMAL
        win.visible = true;
        win.minimized = false;
        this.BringToFront(hwnd);
        break;
      case SW_MINIMIZE:
        win.minimized = true;
        break;
      case SW_MAXIMIZE:
        win.maximized = true;
        win.minimized = false;
        this.BringToFront(hwnd);
        break;
      case SW_RESTORE:
        win.minimized = false;
        win.maximized = false;
        this.BringToFront(hwnd);
        break;
    }
    return true;
  }

  public BringToFront(hwnd: HWND) {
    const win = this.getWindow(hwnd);
    if (!win || win.parentHwnd !== null) return;
    win.zIndex = ++this.topZIndex;
    this.activeHwnd = hwnd;
  }

  public DestroyWindow(hwnd: HWND): boolean {
    const win = this.getWindow(hwnd);
    if (!win) return false;

    // Recursively destroy children
    const children = this.windows.filter((w) => w.parentHwnd === hwnd);
    for (const child of children) {
      this.DestroyWindow(child.hwnd);
    }

    // Send WM_DESTROY
    this.SendMessage(hwnd, WM_DESTROY, 0, 0);

    // Remove window
    const idx = this.windows.findIndex((w) => w.hwnd === hwnd);
    if (idx !== -1) {
      this.windows.splice(idx, 1);
    }

    if (this.activeHwnd === hwnd) {
      const topRemaining = this.windows
        .filter((w) => w.parentHwnd === null && w.visible && !w.minimized)
        .sort((a, b) => b.zIndex - a.zIndex)[0];
      this.activeHwnd = topRemaining ? topRemaining.hwnd : null;
    }

    return true;
  }

  public SendMessage(
    hwnd: HWND,
    uMsg: UINT,
    wParam: WPARAM,
    lParam: LPARAM
  ): LRESULT {
    const win = this.getWindow(hwnd);
    if (!win) return 0;
    return win.wndProc(hwnd, uMsg, wParam, lParam);
  }

  public PostMessage(
    hwnd: HWND,
    message: UINT,
    wParam: WPARAM,
    lParam: LPARAM
  ): boolean {
    const msg: MSG = {
      hwnd,
      message,
      wParam,
      lParam,
      time: Date.now(),
      pt: { x: 0, y: 0 },
    };

    if (this.messageQueueWaiters.length > 0) {
      const waiter = this.messageQueueWaiters.shift()!;
      waiter(msg);
    } else {
      this.messageQueue.push(msg);
    }

    return true;
  }

  public PostQuitMessage(exitCode: number = 0): void {
    this.PostMessage(0, WM_QUIT, exitCode, 0);
  }

  public async GetMessage(outMsg: MSG): Promise<boolean> {
    const msg = await new Promise<MSG | null>((resolve) => {
      if (this.messageQueue.length > 0) {
        resolve(this.messageQueue.shift()!);
      } else {
        this.messageQueueWaiters.push(resolve);
      }
    });

    if (!msg || msg.message === WM_QUIT) {
      return false;
    }

    Object.assign(outMsg, msg);
    return true;
  }

  public TranslateMessage(_msg: MSG): boolean {
    // In full Win32 this translates virtual keys to character messages (WM_CHAR)
    return true;
  }

  public DispatchMessage(msg: MSG): LRESULT {
    return this.SendMessage(msg.hwnd, msg.message, msg.wParam, msg.lParam);
  }

  public DefWindowProc(
    hwnd: HWND,
    uMsg: UINT,
    wParam: WPARAM,
    lParam: LPARAM
  ): LRESULT {
    switch (uMsg) {
      case WM_CLOSE:
        this.DestroyWindow(hwnd);
        return 0;
    }
    return 0;
  }

  public SetWindowText(hwnd: HWND, text: string): boolean {
    this.SendMessage(hwnd, WM_SETTEXT, 0, text as any);
    return true;
  }

  public GetWindowText(hwnd: HWND): string {
    const win = this.getWindow(hwnd);
    if (!win) return "";
    if (win.className.toUpperCase() === "EDIT") {
      return win.controlState?.value ?? "";
    }
    return win.title;
  }

  public MoveWindow(
    hwnd: HWND,
    x: number,
    y: number,
    width: number,
    height: number,
    _repaint: boolean = true
  ): boolean {
    const win = this.getWindow(hwnd);
    if (!win) return false;

    win.x = x;
    win.y = y;
    win.width = width;
    win.height = height;

    this.SendMessage(hwnd, WM_MOVE, 0, (y << 16) | (x & 0xffff));
    this.SendMessage(hwnd, WM_SIZE, 0, (height << 16) | (width & 0xffff));
    return true;
  }

  public SetWindowLongPtr(hwnd: HWND, index: number, newLong: any): any {
    const win = this.getWindow(hwnd);
    if (!win) return 0;
    if (index === -4) {
      // GWLP_WNDPROC
      const old = win.wndProc;
      win.wndProc = newLong;
      return old;
    }
    return 0;
  }

  public SetTimer(
    hwnd: HWND,
    nIDEvent: number,
    uElapse: number,
    lpTimerFunc: any = null
  ): number {
    const id = nIDEvent || this.nextTimerId++;
    const intervalId = setInterval(() => {
      if (typeof lpTimerFunc === "function") {
        lpTimerFunc(hwnd, WM_TIMER, id, Date.now());
      } else {
        this.PostMessage(hwnd, WM_TIMER, id, 0);
      }
    }, uElapse);

    this.timers.set(id, { timerId: id, hwnd, interval: uElapse, intervalId });
    return id;
  }

  public KillTimer(hwnd: HWND, uIDEvent: number): boolean {
    const item = this.timers.get(uIDEvent);
    if (item && item.hwnd === hwnd) {
      clearInterval(item.intervalId);
      this.timers.delete(uIDEvent);
      return true;
    }
    return false;
  }

  public MessageBox(
    hwndOwner: HWND | null,
    text: string,
    caption: string,
    type: number = MB_OK
  ): Promise<number> {
    MessageBeep(type & 0xf0);
    return new Promise<number>((resolve) => {
      this.activeMessageBox = {
        hwndOwner,
        text,
        caption,
        type,
        resolve: (result: number) => {
          this.activeMessageBox = null;
          resolve(result);
        },
      };
    });
  }

  public CreateMenu(): HMENU {
    const hMenu = ++this.nextHmenu;
    this.menus.push({ hMenu, items: [] });
    return hMenu;
  }

  public CreatePopupMenu(): HMENU {
    return this.CreateMenu();
  }

  public GetMenuRecord(hMenu: HMENU): MenuRecord | undefined {
    return this.menus.find((m) => m.hMenu === hMenu);
  }

  public AppendMenu(
    hMenu: HMENU,
    uFlags: number,
    uIDNewItem: number | HMENU,
    lpNewItem: string,
    shortcut?: string
  ): boolean {
    const record = this.GetMenuRecord(hMenu);
    if (!record) return false;

    const isSeparator = (uFlags & MF_SEPARATOR) === MF_SEPARATOR;
    const isPopup = (uFlags & MF_POPUP) === MF_POPUP;

    const item: MenuItem = {
      id: isPopup ? 0 : (uIDNewItem as number),
      text: lpNewItem,
      flags: uFlags,
      shortcut,
      checked: (uFlags & MF_CHECKED) === MF_CHECKED,
      disabled: (uFlags & MF_DISABLED) === MF_DISABLED || (uFlags & MF_GRAYED) === MF_GRAYED,
      isSeparator,
      hSubMenu: isPopup ? (uIDNewItem as HMENU) : undefined,
    };

    record.items.push(item);
    return true;
  }

  public SetMenu(hwnd: HWND, hMenu: HMENU | null): boolean {
    const win = this.getWindow(hwnd);
    if (!win) return false;
    win.hMenu = hMenu;
    return true;
  }

  public GetMenu(hwnd: HWND): HMENU | null {
    const win = this.getWindow(hwnd);
    return win?.hMenu ?? null;
  }

  public CheckMenuItem(hMenu: HMENU, uIDCheckItem: number, uCheck: number): boolean {
    const record = this.GetMenuRecord(hMenu);
    if (!record) return false;
    const item = record.items.find((i) => i.id === uIDCheckItem);
    if (item) {
      item.checked = (uCheck & MF_CHECKED) === MF_CHECKED;
      return true;
    }
    for (const it of record.items) {
      if (it.hSubMenu && this.CheckMenuItem(it.hSubMenu, uIDCheckItem, uCheck)) {
        return true;
      }
    }
    return false;
  }

  public EnableMenuItem(hMenu: HMENU, uIDEnableItem: number, uEnable: number): boolean {
    const record = this.GetMenuRecord(hMenu);
    if (!record) return false;
    const item = record.items.find((i) => i.id === uIDEnableItem);
    if (item) {
      item.disabled = (uEnable & MF_DISABLED) === MF_DISABLED || (uEnable & MF_GRAYED) === MF_GRAYED;
      return true;
    }
    for (const it of record.items) {
      if (it.hSubMenu && this.EnableMenuItem(it.hSubMenu, uIDEnableItem, uEnable)) {
        return true;
      }
    }
    return false;
  }
}

export const kernel = new Win32Kernel();

// Export convenient global-like functions to mirror Win32 C API
export const RegisterClassEx = (wc: WNDCLASSEX) => kernel.RegisterClassEx(wc);
export const CreateWindowEx = (
  exStyle: number,
  className: string,
  title: string,
  style: number,
  x: number,
  y: number,
  w: number,
  h: number,
  parent: HWND | null,
  menuId: number | null,
  instance: any = null,
  param: any = null
) => kernel.CreateWindowEx(exStyle, className, title, style, x, y, w, h, parent, menuId, instance, param);

export const ShowWindow = (hwnd: HWND, cmd: number) => kernel.ShowWindow(hwnd, cmd);
export const DestroyWindow = (hwnd: HWND) => kernel.DestroyWindow(hwnd);
export const SendMessage = (hwnd: HWND, msg: UINT, wParam: WPARAM = 0, lParam: LPARAM = 0) =>
  kernel.SendMessage(hwnd, msg, wParam, lParam);
export const PostMessage = (hwnd: HWND, msg: UINT, wParam: WPARAM = 0, lParam: LPARAM = 0) =>
  kernel.PostMessage(hwnd, msg, wParam, lParam);
export const GetMessage = (msg: MSG) => kernel.GetMessage(msg);
export const TranslateMessage = (msg: MSG) => kernel.TranslateMessage(msg);
export const DispatchMessage = (msg: MSG) => kernel.DispatchMessage(msg);
export const PostQuitMessage = (code: number = 0) => kernel.PostQuitMessage(code);
export const DefWindowProc = (hwnd: HWND, msg: UINT, wParam: WPARAM, lParam: LPARAM) =>
  kernel.DefWindowProc(hwnd, msg, wParam, lParam);
export const SetWindowText = (hwnd: HWND, text: string) => kernel.SetWindowText(hwnd, text);
export const GetWindowText = (hwnd: HWND) => kernel.GetWindowText(hwnd);
export const MoveWindow = (hwnd: HWND, x: number, y: number, w: number, h: number, repaint = true) =>
  kernel.MoveWindow(hwnd, x, y, w, h, repaint);
export const SetTimer = (hwnd: HWND, id: number, elapse: number, func?: any) =>
  kernel.SetTimer(hwnd, id, elapse, func);
export const KillTimer = (hwnd: HWND, id: number) => kernel.KillTimer(hwnd, id);
export const MessageBox = (hwnd: HWND | null, text: string, caption: string, type?: number) =>
  kernel.MessageBox(hwnd, text, caption, type);
export { MessageBeep, audio } from "./audio";
export const CreateMenu = () => kernel.CreateMenu();
export const CreatePopupMenu = () => kernel.CreatePopupMenu();
export const AppendMenu = (
  hMenu: HMENU,
  uFlags: number,
  uIDNewItem: number | HMENU,
  lpNewItem: string,
  shortcut?: string
) => kernel.AppendMenu(hMenu, uFlags, uIDNewItem, lpNewItem, shortcut);
export const SetMenu = (hwnd: HWND, hMenu: HMENU | null) => kernel.SetMenu(hwnd, hMenu);
export const GetMenu = (hwnd: HWND) => kernel.GetMenu(hwnd);
export const CheckMenuItem = (hMenu: HMENU, id: number, check: number) =>
  kernel.CheckMenuItem(hMenu, id, check);
export const EnableMenuItem = (hMenu: HMENU, id: number, enable: number) =>
  kernel.EnableMenuItem(hMenu, id, enable);

/**
 * Standard message loop helper:
 * while (await GetMessage(msg)) {
 *   TranslateMessage(msg);
 *   DispatchMessage(msg);
 * }
 */
export async function RunMessageLoop(): Promise<void> {
  const msg: MSG = {
    hwnd: 0,
    message: WM_NULL,
    wParam: 0,
    lParam: 0,
    time: 0,
    pt: { x: 0, y: 0 },
  };

  while (await GetMessage(msg)) {
    TranslateMessage(msg);
    DispatchMessage(msg);
  }
}
