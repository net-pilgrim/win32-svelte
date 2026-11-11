export type HWND = number;
export type HMENU = number;
export type LRESULT = number;
export type WPARAM = number;
export type LPARAM = number;
export type UINT = number;

export interface MenuItem {
  id: number;
  text: string;
  flags: number;
  shortcut?: string;
  checked?: boolean;
  disabled?: boolean;
  isSeparator?: boolean;
  hSubMenu?: HMENU;
}

export interface MenuRecord {
  hMenu: HMENU;
  items: MenuItem[];
}

export interface POINT {
  x: number;
  y: number;
}

export interface RECT {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface MSG {
  hwnd: HWND;
  message: UINT;
  wParam: WPARAM;
  lParam: LPARAM;
  time: number;
  pt: POINT;
}

export type WndProc = (
  hwnd: HWND,
  uMsg: UINT,
  wParam: WPARAM,
  lParam: LPARAM
) => LRESULT;

export interface WNDCLASSEX {
  className: string;
  lpfnWndProc: WndProc;
  hbrBackground?: string;
  style?: number;
}

export interface CREATESTRUCT {
  lpCreateParams?: any;
  hInstance?: any;
  hMenu?: any;
  hwndParent: HWND | null;
  cy: number;
  cx: number;
  y: number;
  x: number;
  style: number;
  lpszName: string;
  lpszClass: string;
  dwExStyle: number;
}

export interface WindowRecord {
  hwnd: HWND;
  parentHwnd: HWND | null;
  className: string;
  wndProc: WndProc;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  style: number;
  exStyle: number;
  menuId: number | null;
  hMenu?: HMENU | null;
  visible: boolean;
  minimized: boolean;
  maximized: boolean;
  enabled: boolean;
  zIndex: number;
  // Control-specific state
  controlState?: {
    isPressed?: boolean;
    value?: string;
    checked?: number;
    items?: string[];
    selectedIndex?: number;
    progressPos?: number;
    rangeMin?: number;
    rangeMax?: number;
  };
  customProps: Record<string, any>;
}

export interface MessageBoxOptions {
  hwndOwner?: HWND | null;
  text: string;
  caption: string;
  type: number;
  resolve: (result: number) => void;
}
