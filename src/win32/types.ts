export type HWND = number;
export type HMENU = number;
export type HANDLE = number;
export type LRESULT = any;
export type WPARAM = any;
export type LPARAM = any;
export type UINT = number;

export interface WIN32_FIND_DATA {
  dwFileAttributes: number;
  cFileName: string;
  nFileSizeHigh: number;
  nFileSizeLow: number;
  ftCreationTime: number;
  ftLastWriteTime: number;
  cAlternateFileName?: string;
}

export interface VFSFileInfo {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modified: number;
  attributes: number;
  icon?: string;
  typeDesc?: string;
  content?: string;
}

export interface DOCINFO {
  cbSize?: number;
  lpszDocName?: string;
  lpszOutput?: string;
  lpszDatatype?: string;
  fwType?: number;
}

export interface PRINTDLG {
  hwndOwner?: HWND | null;
  hDevMode?: any;
  hDevNames?: any;
  hDC?: any;
  flags?: number;
  nFromPage?: number;
  nToPage?: number;
  nMinPage?: number;
  nMaxPage?: number;
  nCopies?: number;
  printerName?: string;
}



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

export interface DropFileInfo {
  name: string;
  size?: number | string;
  type?: string;
  content?: string;
  isInternal?: boolean;
  data?: any;
}

export interface HDROP {
  files: DropFileInfo[];
  pt: POINT;
  hwndTarget?: HWND;
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

export interface NMHDR {
  hwndFrom: HWND;
  idFrom: number;
  code: number;
  [key: string]: any;
}

export interface TreeNodeItem {
  id: string;
  text: string;
  icon?: string;
  expanded?: boolean;
  children?: TreeNodeItem[];
}

export interface ListViewColumn {
  text: string;
  width?: number;
}

export interface ListViewRow {
  id: string | number;
  text: string;
  subItems?: string[];
  selected?: boolean;
  icon?: string;
  content?: string;
}

export interface WindowRecord {
  hwnd: HWND;
  parentHwnd: HWND | null;
  ownerHwnd?: HWND | null;
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
    // Common Controls (comctl32)
    statusParts?: Array<{ text: string; width?: number }>;
    tabs?: Array<{ text: string; id?: string | number }>;
    selectedTab?: number;
    treeNodes?: TreeNodeItem[];
    selectedNodeId?: string | null;
    listColumns?: ListViewColumn[];
    listRows?: ListViewRow[];
    selectedRowIndex?: number;
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
