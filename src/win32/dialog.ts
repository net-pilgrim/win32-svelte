import {
  kernel,
  CreateWindowEx,
  ShowWindow,
  DestroyWindow,
  EnableWindow,
  SendMessage,
  GetWindowText,
  SetWindowText,
  CreateMenu,
  CreatePopupMenu,
  AppendMenu,
  SetMenu,
} from "./kernel.svelte.ts";

import {
  WM_INITDIALOG,
  WM_COMMAND,
  WM_CLOSE,
  WM_DESTROY,
  WS_POPUP,
  WS_CAPTION,
  WS_SYSMENU,
  WS_CHILD,
  WS_VISIBLE,
  WS_TABSTOP,
  DS_CENTER,
  BS_DEFPUSHBUTTON,
  BM_GETCHECK,
  BM_SETCHECK,
  IDOK,
  IDCANCEL,
  LOWORD,
  SW_SHOW,
  SW_HIDE,
} from "./constants.ts";

import type { HWND, HMENU, UINT, WPARAM, LPARAM, LRESULT, WndProc, RECT } from "./types.ts";
import type {
  ResourceBundle,
  DialogTemplate,
  DialogFont,
  MenuTemplate,
  MenuItemTemplate,
} from "../rc/types.ts";
import { dluToPixelsX, dluToPixelsY, mapDialogRect } from "../rc/dlu.ts";

export { dluToPixelsX, dluToPixelsY, mapDialogRect };

// Global registry for loaded resource bundles
const registeredBundles: ResourceBundle[] = [];

export function RegisterResourceBundle(bundle: ResourceBundle): void {
  if (!registeredBundles.includes(bundle)) {
    registeredBundles.push(bundle);
  }
}

export function FindDialogTemplate(
  templateOrId: number | string | DialogTemplate,
  bundle?: ResourceBundle
): DialogTemplate | undefined {
  if (typeof templateOrId === "object" && "controls" in templateOrId) {
    return templateOrId;
  }

  const bundlesToSearch = bundle ? [bundle, ...registeredBundles] : registeredBundles;

  const key = String(templateOrId);
  for (const b of bundlesToSearch) {
    if (b.dialogs[key]) {
      return b.dialogs[key];
    }
    // Also search by numeric ID or name
    for (const dlg of Object.values(b.dialogs)) {
      if (dlg.id === templateOrId || dlg.name === key) {
        return dlg;
      }
    }
  }

  return undefined;
}

export function FindMenuTemplate(
  menuOrId: number | string | MenuTemplate,
  bundle?: ResourceBundle
): MenuTemplate | undefined {
  if (typeof menuOrId === "object" && "items" in menuOrId) {
    return menuOrId;
  }

  const bundlesToSearch = bundle ? [bundle, ...registeredBundles] : registeredBundles;

  const key = String(menuOrId);
  for (const b of bundlesToSearch) {
    if (b.menus[key]) {
      return b.menus[key];
    }
    for (const m of Object.values(b.menus)) {
      if (m.id === menuOrId || m.name === key) {
        return m;
      }
    }
  }

  return undefined;
}

export function MapDialogRect(_hDlg: HWND, lpRect: RECT, font?: DialogFont): boolean {
  lpRect.left = dluToPixelsX(lpRect.left, font);
  lpRect.top = dluToPixelsY(lpRect.top, font);
  lpRect.right = dluToPixelsX(lpRect.right, font);
  lpRect.bottom = dluToPixelsY(lpRect.bottom, font);
  return true;
}

// Active modal dialog tracking
interface ModalDialogState {
  hDlg: HWND;
  ownerHwnd: HWND | null;
  ownerWasEnabled: boolean;
  resolve: (result: number) => void;
  result: number;
}

const activeModals = new Map<HWND, ModalDialogState>();

/**
 * Creates a modeless dialog box from a dialog template.
 */
export function CreateDialogParam(
  _hInstance: any,
  lpTemplateName: number | string | DialogTemplate,
  hWndParent: HWND | null = null,
  lpDialogFunc?: WndProc,
  dwInitParam: any = 0,
  bundle?: ResourceBundle
): HWND {
  const template = FindDialogTemplate(lpTemplateName, bundle);
  if (!template) {
    console.error(`CreateDialogParam: Dialog template '${String(lpTemplateName)}' not found.`);
    return 0;
  }

  const font = template.font;
  const clientWidth = dluToPixelsX(template.width, font);
  const clientHeight = dluToPixelsY(template.height, font);

  // Compute outer window size (accounting for title bar and borders in 98.css)
  const windowWidth = clientWidth + 18;
  const windowHeight = clientHeight + 36 + (template.menu ? 24 : 0);

  // Positioning: default or DS_CENTER
  let x = dluToPixelsX(template.x, font);
  let y = dluToPixelsY(template.y, font);

  const shouldCenter = (template.style & DS_CENTER) !== 0 || (template.x === 0 && template.y === 0);

  if (shouldCenter) {
    if (hWndParent) {
      const ownerWin = kernel.getWindow(hWndParent);
      if (ownerWin) {
        x = Math.max(20, Math.round(ownerWin.x + (ownerWin.width - windowWidth) / 2));
        y = Math.max(20, Math.round(ownerWin.y + (ownerWin.height - windowHeight) / 2));
      } else {
        x = Math.max(20, Math.round((window.innerWidth - windowWidth) / 2));
        y = Math.max(20, Math.round((window.innerHeight - windowHeight) / 2));
      }
    } else {
      x = Math.max(20, Math.round((window.innerWidth - windowWidth) / 2));
      y = Math.max(20, Math.round((window.innerHeight - windowHeight) / 2));
    }
  }

  const dwStyle =
    template.style ||
    (WS_POPUP | WS_CAPTION | WS_SYSMENU | WS_VISIBLE);

  // Wrapped dialog procedure handling default dialog behavior
  const dialogProc: WndProc = (hwnd: HWND, uMsg: UINT, wParam: WPARAM, lParam: LPARAM): LRESULT => {
    // Let user dialog procedure handle the message first
    if (lpDialogFunc) {
      const result = lpDialogFunc(hwnd, uMsg, wParam, lParam);
      if (result !== 0 && result !== false && result !== undefined) {
        return result;
      }
    }

    // Default dialog handling
    if (uMsg === WM_CLOSE) {
      EndDialog(hwnd, IDCANCEL);
      return 0;
    }

    if (uMsg === WM_COMMAND) {
      const cmdId = LOWORD(wParam);
      if (cmdId === IDOK || cmdId === IDCANCEL) {
        EndDialog(hwnd, cmdId);
        return 0;
      }
    }

    if (uMsg === WM_DESTROY) {
      const modal = activeModals.get(hwnd);
      if (modal) {
        activeModals.delete(hwnd);
        if (modal.ownerHwnd) {
          EnableWindow(modal.ownerHwnd, modal.ownerWasEnabled);
        }
        modal.resolve(modal.result);
      }
      return 0;
    }

    return 0;
  };

  // Create the main dialog window
  const hDlg = CreateWindowEx(
    template.exStyle || 0,
    template.className || "CDialog",
    template.caption || "Dialog",
    dwStyle,
    x,
    y,
    windowWidth,
    windowHeight,
    hWndParent,
    null,
    null,
    dwInitParam,
    dialogProc
  );

  if (!hDlg) return 0;

  // Attach menu if specified
  if (template.menu) {
    const hMenu = LoadMenu(bundle, template.menu);
    if (hMenu) {
      SetMenu(hDlg, hMenu);
    }
  }

  // Create child controls
  for (const ctrl of template.controls) {
    const ctrlX = dluToPixelsX(ctrl.x, font);
    const ctrlY = dluToPixelsY(ctrl.y, font);
    const ctrlW = dluToPixelsX(ctrl.width, font);
    const ctrlH = dluToPixelsY(ctrl.height, font);

    const hCtrl = CreateWindowEx(
      ctrl.exStyle || 0,
      ctrl.className,
      ctrl.text,
      ctrl.style | WS_CHILD | WS_VISIBLE,
      ctrlX,
      ctrlY,
      ctrlW,
      ctrlH,
      hDlg,
      ctrl.id
    );

    // Apply default font or styles
    if (hCtrl && ctrl.type === "DEFPUSHBUTTON") {
      kernel.getWindow(hCtrl)?.controlState;
    }
  }

  // Send WM_INITDIALOG
  const defaultFocusHwnd = template.controls[0]?.id
    ? GetDlgItem(hDlg, template.controls[0].id)
    : 0;
  SendMessage(hDlg, WM_INITDIALOG, defaultFocusHwnd, dwInitParam);

  return hDlg;
}

export function CreateDialog(
  hInstance: any,
  lpTemplateName: number | string | DialogTemplate,
  hWndParent: HWND | null = null,
  lpDialogFunc?: WndProc,
  bundle?: ResourceBundle
): HWND {
  return CreateDialogParam(hInstance, lpTemplateName, hWndParent, lpDialogFunc, 0, bundle);
}

/**
 * Creates a modal dialog box from a dialog template.
 */
export function DialogBoxParam(
  hInstance: any,
  lpTemplateName: number | string | DialogTemplate,
  hWndParent: HWND | null = null,
  lpDialogFunc?: WndProc,
  dwInitParam: any = 0,
  bundle?: ResourceBundle
): Promise<number> {
  return new Promise<number>((resolve) => {
    const ownerWasEnabled = hWndParent ? EnableWindow(hWndParent, false) : false;

    const hDlg = CreateDialogParam(
      hInstance,
      lpTemplateName,
      hWndParent,
      lpDialogFunc,
      dwInitParam,
      bundle
    );

    if (!hDlg) {
      if (hWndParent) EnableWindow(hWndParent, ownerWasEnabled);
      resolve(IDCANCEL);
      return;
    }

    activeModals.set(hDlg, {
      hDlg,
      ownerHwnd: hWndParent,
      ownerWasEnabled,
      resolve,
      result: IDCANCEL,
    });

    ShowWindow(hDlg, SW_SHOW);
  });
}

export function DialogBox(
  hInstance: any,
  lpTemplateName: number | string | DialogTemplate,
  hWndParent: HWND | null = null,
  lpDialogFunc?: WndProc,
  bundle?: ResourceBundle
): Promise<number> {
  return DialogBoxParam(hInstance, lpTemplateName, hWndParent, lpDialogFunc, 0, bundle);
}

/**
 * Destroys a modal dialog box, causing DialogBoxParam to return the given value.
 */
export function EndDialog(hDlg: HWND, nResult: number): boolean {
  const modal = activeModals.get(hDlg);
  if (modal) {
    modal.result = nResult;
  }
  ShowWindow(hDlg, SW_HIDE);
  DestroyWindow(hDlg);
  return true;
}

/**
 * Retrieves a handle to a control in the specified dialog box.
 */
export function GetDlgItem(hDlg: HWND, nIDDlgItem: number): HWND {
  const child = kernel.windows.find(
    (w) => w.parentHwnd === hDlg && w.menuId === nIDDlgItem
  );
  return child?.hwnd ?? 0;
}

/**
 * Sets the title or text of a control in a dialog box.
 */
export function SetDlgItemText(hDlg: HWND, nIDDlgItem: number, lpString: string): boolean {
  const hCtrl = GetDlgItem(hDlg, nIDDlgItem);
  if (!hCtrl) return false;
  return SetWindowText(hCtrl, lpString);
}

/**
 * Retrieves the title or text of a control in a dialog box.
 */
export function GetDlgItemText(hDlg: HWND, nIDDlgItem: number): string {
  const hCtrl = GetDlgItem(hDlg, nIDDlgItem);
  if (!hCtrl) return "";
  return GetWindowText(hCtrl);
}

/**
 * Sends a message to the specified control in a dialog box.
 */
export function SendDlgItemMessage(
  hDlg: HWND,
  nIDDlgItem: number,
  uMsg: UINT,
  wParam: WPARAM = 0,
  lParam: LPARAM = 0
): LRESULT {
  const hCtrl = GetDlgItem(hDlg, nIDDlgItem);
  if (!hCtrl) return 0;
  return SendMessage(hCtrl, uMsg, wParam, lParam);
}

/**
 * Changes the check state of a button control in a dialog box.
 */
export function CheckDlgButton(hDlg: HWND, nIDDlgItem: number, uCheck: number): boolean {
  SendDlgItemMessage(hDlg, nIDDlgItem, BM_SETCHECK, uCheck, 0);
  return true;
}

/**
 * Retrieves the check state of a button control in a dialog box.
 */
export function IsDlgButtonChecked(hDlg: HWND, nIDDlgItem: number): number {
  return SendDlgItemMessage(hDlg, nIDDlgItem, BM_GETCHECK, 0, 0) || 0;
}

/**
 * Retrieves the identifier of the specified control.
 */
export function GetDlgCtrlID(hwnd: HWND): number {
  const win = kernel.getWindow(hwnd);
  return win?.menuId ?? 0;
}

/**
 * Loads a menu from a resource bundle and creates the HMENU tree.
 */
export function LoadMenu(
  bundleOrHInstance: any,
  lpMenuNameOrId: number | string
): HMENU | null {
  const menuTemplate = FindMenuTemplate(
    lpMenuNameOrId,
    typeof bundleOrHInstance === "object" && bundleOrHInstance?.menus
      ? bundleOrHInstance
      : undefined
  );
  if (!menuTemplate) return null;

  const hMainMenu = CreateMenu();

  function buildItems(parentHMenu: HMENU, items: MenuItemTemplate[]): void {
    for (const item of items) {
      if (item.subItems && item.subItems.length > 0) {
        const hSub = CreatePopupMenu();
        buildItems(hSub, item.subItems);
        AppendMenu(parentHMenu, item.flags, hSub, item.text, item.shortcut);
      } else {
        AppendMenu(
          parentHMenu,
          item.flags,
          item.id ?? 0,
          item.text,
          item.shortcut
        );
      }
    }
  }

  buildItems(hMainMenu, menuTemplate.items);
  return hMainMenu;
}

/**
 * Loads a string resource from a resource bundle.
 */
export function LoadString(
  bundleOrHInstance: any,
  uID: number,
  bundle?: ResourceBundle
): string {
  const b =
    bundle ||
    (typeof bundleOrHInstance === "object" && bundleOrHInstance?.stringTable
      ? bundleOrHInstance
      : registeredBundles[0]);

  if (b?.stringTable?.[uID] !== undefined) {
    return b.stringTable[uID];
  }
  return "";
}
