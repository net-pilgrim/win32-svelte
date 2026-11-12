export interface DialogFont {
  pointSize: number;
  typeface: string;
  weight?: number;
  italic?: boolean;
  charset?: number;
}

export interface DialogControlTemplate {
  id: number;
  idName?: string;
  type: string; // "LTEXT", "DEFPUSHBUTTON", "PUSHBUTTON", "EDITTEXT", "CONTROL", etc.
  className: string; // "STATIC", "BUTTON", "EDIT", "COMBOBOX", etc.
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  style: number;
  exStyle: number;
  helpId?: number;
}

export interface DialogTemplate {
  id: number | string;
  name: string;
  isExtended?: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  helpId?: number;
  caption: string;
  style: number;
  exStyle: number;
  font?: DialogFont;
  menu?: number | string;
  className?: string;
  controls: DialogControlTemplate[];
}

export interface MenuItemTemplate {
  id?: number;
  idName?: string;
  text: string;
  flags: number;
  shortcut?: string;
  isSeparator?: boolean;
  subItems?: MenuItemTemplate[];
}

export interface MenuTemplate {
  id: number | string;
  name: string;
  items: MenuItemTemplate[];
}

export interface AcceleratorItem {
  event: string | number;
  id: number;
  idName?: string;
  flags: number; // VIRTKEY, ASCII, CONTROL, SHIFT, ALT
}

export interface AcceleratorTable {
  id: number | string;
  name: string;
  items: AcceleratorItem[];
}

export interface ResourceBundle {
  dialogs: Record<string, DialogTemplate>;
  menus: Record<string, MenuTemplate>;
  stringTable: Record<number, string>;
  accelerators: Record<string, AcceleratorTable>;
  icons: Record<string, string>;
  bitmaps: Record<string, string>;
  symbols: Record<string, number>;
}

export interface CompilerOptions {
  includeDirs?: string[];
  readFile?: (path: string) => string | Promise<string>;
  sourcePath?: string;
}
