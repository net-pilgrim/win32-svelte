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

import type { HWND, HMENU, UINT, WPARAM, LPARAM, LRESULT, WndProc, RECT, WindowRecord } from "./types.ts";
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
export const hInstanceBundleMap = new Map<number, ResourceBundle>();

export function RegisterResourceBundle(bundle: ResourceBundle, hInstance?: number): void {
  if (!registeredBundles.includes(bundle)) {
    registeredBundles.push(bundle);
  }
  if (hInstance !== undefined) {
    hInstanceBundleMap.set(hInstance, bundle);
    kernel.registerModule(hInstance, bundle);
  }
}

/**
 * Resolves a ResourceBundle from a WindowRecord, HWND, hInstance, or bundle object.
 * Enforces private ownership so windows and modules look up their own resources.
 */
export function resolveResourceBundle(
  source?: HWND | number | WindowRecord | ResourceBundle
): ResourceBundle | undefined {
  if (!source) return undefined;
  if (typeof source === "object") {
    if ("resourceBundle" in source && (source as any).resourceBundle) {
      return (source as any).resourceBundle;
    }
    if ("dialogs" in source || "menus" in source) {
      return source as ResourceBundle;
    }
  }
  if (typeof source === "number") {
    // 1. Check if it's a window handle first!
    const win = kernel.getWindow(source);
    if (win) {
      return kernel.getWindowResourceBundle(source);
    }
    // 2. Check if it's an hInstance / module handle
    return kernel.getModuleBundle(source);
  }
  return undefined;
}

export function FindDialogTemplate(
  templateOrId: number | string | DialogTemplate,
  bundleOrWindow?: ResourceBundle | number | WindowRecord
): DialogTemplate | undefined {
  if (typeof templateOrId === "object" && "controls" in templateOrId) {
    return templateOrId;
  }

  const resolvedBundle = resolveResourceBundle(bundleOrWindow);
  const bundlesToSearch = resolvedBundle ? [resolvedBundle] : registeredBundles;

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
  bundleOrWindow?: ResourceBundle | number | WindowRecord
): MenuTemplate | undefined {
  if (typeof menuOrId === "object" && "items" in menuOrId) {
    return menuOrId;
  }

  const resolvedBundle = resolveResourceBundle(bundleOrWindow);
  const bundlesToSearch = resolvedBundle ? [resolvedBundle] : registeredBundles;

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

export function FindBitmapResource(
  idOrName: number | string,
  bundleOrWindow?: ResourceBundle | number | WindowRecord
): any {
  const resolvedBundle = resolveResourceBundle(bundleOrWindow);
  const bundlesToSearch = resolvedBundle ? [resolvedBundle] : registeredBundles;
  const key = String(idOrName);
  for (const b of bundlesToSearch) {
    if ((b as any).bitmaps?.[key]) {
      const bmp = (b as any).bitmaps[key];
      return typeof bmp === "function" ? bmp() : bmp;
    }
  }
  return undefined;
}

export function FindIconResource(
  idOrName: number | string,
  bundleOrWindow?: ResourceBundle | number | WindowRecord
): any {
  const resolvedBundle = resolveResourceBundle(bundleOrWindow);
  const bundlesToSearch = resolvedBundle ? [resolvedBundle] : registeredBundles;
  const key = String(idOrName);
  for (const b of bundlesToSearch) {
    if ((b as any).icons?.[key]) {
      const ico = (b as any).icons[key];
      return typeof ico === "function" ? ico() : ico;
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
  hInstance: any,
  lpTemplateName: number | string | DialogTemplate,
  hWndParent: HWND | null = null,
  lpDialogFunc?: WndProc,
  dwInitParam: any = 0,
  bundle?: ResourceBundle
): HWND {
  const resolvedBundle =
    bundle ||
    resolveResourceBundle(hInstance) ||
    (hWndParent ? resolveResourceBundle(hWndParent) : undefined);

  if (resolvedBundle) {
    RegisterResourceBundle(resolvedBundle);
  }
  const template = FindDialogTemplate(lpTemplateName, resolvedBundle);
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
    (template.style || (WS_POPUP | WS_CAPTION | WS_SYSMENU)) | WS_VISIBLE;

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
    resolvedBundle || hInstance,
    dwInitParam,
    dialogProc
  );

  if (!hDlg) return 0;

  // Attach menu if specified
  if (template.menu) {
    const hMenu = LoadMenu(hDlg, template.menu);
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
 * Sets the text of a control in a dialog box to an integer string.
 */
export function SetDlgItemInt(
  hDlg: HWND,
  nIDDlgItem: number,
  uValue: number,
  bSigned = false
): boolean {
  return SetDlgItemText(hDlg, nIDDlgItem, String(bSigned ? (uValue | 0) : (uValue >>> 0)));
}

/**
 * Retrieves the text of a control in a dialog box translated into an integer.
 */
export function GetDlgItemInt(
  hDlg: HWND,
  nIDDlgItem: number,
  lpTranslated?: { val: boolean },
  bSigned = false
): number {
  const text = GetDlgItemText(hDlg, nIDDlgItem).trim();
  const val = parseInt(text, 10);
  if (isNaN(val)) {
    if (lpTranslated) lpTranslated.val = false;
    return 0;
  }
  if (lpTranslated) lpTranslated.val = true;
  return bSigned ? (val | 0) : (val >>> 0);
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

export function CheckRadioButton(
  hDlg: HWND,
  nIDFirstButton: number,
  nIDLastButton: number,
  nIDCheckButton: number
): boolean {
  for (let id = nIDFirstButton; id <= nIDLastButton; id++) {
    SendDlgItemMessage(hDlg, id, BM_SETCHECK, id === nIDCheckButton ? 1 : 0, 0);
  }
  return true;
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
    bundleOrHInstance
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
  const resolved = bundle ?? resolveResourceBundle(bundleOrHInstance);
  if (resolved?.stringTable?.[uID] !== undefined) {
    return resolved.stringTable[uID];
  }
  if (typeof bundleOrHInstance === "object" && bundleOrHInstance?.stringTable?.[uID] !== undefined) {
    return bundleOrHInstance.stringTable[uID];
  }
  if (!resolved) {
    for (const b of registeredBundles) {
      if (b?.stringTable?.[uID] !== undefined) {
        return b.stringTable[uID];
      }
    }
  }
  return "";
}
