import { CWnd } from "./wnd";
import {
  WS_CHILD,
  WS_VISIBLE,
  BM_GETCHECK,
  BM_SETCHECK,
  CB_ADDSTRING,
  CB_SETCURSEL,
  CB_GETCURSEL,
  CB_GETLBTEXT,
  PBM_SETPOS,
  PBM_SETRANGE,
  PBM_STEPIT,
  TBM_GETPOS,
  TBM_SETPOS,
  TBM_SETRANGE,
  MAKELPARAM,
  TVM_INSERTITEM,
  TVM_DELETEITEM,
  TVM_EXPAND,
  LVM_INSERTCOLUMN,
  LVM_INSERTITEM,
  LVM_DELETEITEM,
  LVM_DELETEALLITEMS,
  STATUSCLASSNAME,
  WC_TABCONTROL,
  WC_TREEVIEW,
  WC_LISTVIEW,
  PROGRESS_CLASS,
  TRACKBAR_CLASS,
} from "../constants";

export class CButton extends CWnd {
  public static override getClassName(): string {
    return "CButton";
  }

  public createButton(
    lpszCaption: string,
    dwStyle: number = WS_CHILD | WS_VISIBLE,
    x = 0,
    y = 0,
    nWidth = 80,
    nHeight = 24,
    pParentWnd: CWnd | null = null,
    nID: number = 0
  ): boolean {
    return this.create("BUTTON", lpszCaption, dwStyle, x, y, nWidth, nHeight, pParentWnd, nID);
  }

  public getCheck(): number {
    return this.sendMessage(BM_GETCHECK, 0, 0);
  }

  public setCheck(nCheck: number): void {
    this.sendMessage(BM_SETCHECK, nCheck, 0);
  }
}

export class CEdit extends CWnd {
  public static override getClassName(): string {
    return "CEdit";
  }

  public createEdit(
    lpszText = "",
    dwStyle: number = WS_CHILD | WS_VISIBLE,
    x = 0,
    y = 0,
    nWidth = 140,
    nHeight = 22,
    pParentWnd: CWnd | null = null,
    nID: number = 0
  ): boolean {
    return this.create("EDIT", lpszText, dwStyle, x, y, nWidth, nHeight, pParentWnd, nID);
  }
}

export class CStatic extends CWnd {
  public static override getClassName(): string {
    return "CStatic";
  }

  public createStatic(
    lpszText: string,
    dwStyle: number = WS_CHILD | WS_VISIBLE,
    x = 0,
    y = 0,
    nWidth = 100,
    nHeight = 18,
    pParentWnd: CWnd | null = null,
    nID: number = 0
  ): boolean {
    return this.create("STATIC", lpszText, dwStyle, x, y, nWidth, nHeight, pParentWnd, nID);
  }
}

export class CComboBox extends CWnd {
  public static override getClassName(): string {
    return "CComboBox";
  }

  public createComboBox(
    dwStyle: number = WS_CHILD | WS_VISIBLE,
    x = 0,
    y = 0,
    nWidth = 140,
    nHeight = 24,
    pParentWnd: CWnd | null = null,
    nID: number = 0
  ): boolean {
    return this.create("COMBOBOX", "", dwStyle, x, y, nWidth, nHeight, pParentWnd, nID);
  }

  public addString(str: string): number {
    return this.sendMessage(CB_ADDSTRING, 0, str as any);
  }

  public setCurSel(nSelect: number): number {
    return this.sendMessage(CB_SETCURSEL, nSelect, 0);
  }

  public getCurSel(): number {
    return this.sendMessage(CB_GETCURSEL, 0, 0);
  }

  public getLBText(nIndex: number): string {
    return this.sendMessage(CB_GETLBTEXT, nIndex, 0);
  }
}

export class CProgressCtrl extends CWnd {
  public static override getClassName(): string {
    return "CProgressCtrl";
  }

  public createProgress(
    dwStyle: number = WS_CHILD | WS_VISIBLE,
    x = 0,
    y = 0,
    nWidth = 160,
    nHeight = 20,
    pParentWnd: CWnd | null = null,
    nID: number = 0
  ): boolean {
    return this.create(PROGRESS_CLASS, "", dwStyle, x, y, nWidth, nHeight, pParentWnd, nID);
  }

  public setRange(nLower: number, nUpper: number): void {
    this.sendMessage(PBM_SETRANGE, 0, MAKELPARAM(nLower, nUpper));
  }

  public setPos(nPos: number): number {
    return this.sendMessage(PBM_SETPOS, nPos, 0);
  }

  public stepIt(): number {
    return this.sendMessage(PBM_STEPIT, 0, 0);
  }
}

export class CSliderCtrl extends CWnd {
  public static override getClassName(): string {
    return "CSliderCtrl";
  }

  public createSlider(
    dwStyle: number = WS_CHILD | WS_VISIBLE,
    x = 0,
    y = 0,
    nWidth = 160,
    nHeight = 22,
    pParentWnd: CWnd | null = null,
    nID: number = 0
  ): boolean {
    return this.create(TRACKBAR_CLASS, "", dwStyle, x, y, nWidth, nHeight, pParentWnd, nID);
  }

  public setRange(nMin: number, nMax: number): void {
    this.sendMessage(TBM_SETRANGE, 0, MAKELPARAM(nMin, nMax));
  }

  public setPos(nPos: number): void {
    this.sendMessage(TBM_SETPOS, 0, nPos);
  }

  public getPos(): number {
    return this.sendMessage(TBM_GETPOS, 0, 0);
  }
}

export class CTreeCtrl extends CWnd {
  public static override getClassName(): string {
    return "CTreeCtrl";
  }

  public createTree(
    dwStyle: number = WS_CHILD | WS_VISIBLE,
    x = 0,
    y = 0,
    nWidth = 180,
    nHeight = 200,
    pParentWnd: CWnd | null = null,
    nID: number = 0
  ): boolean {
    return this.create(WC_TREEVIEW, "", dwStyle, x, y, nWidth, nHeight, pParentWnd, nID);
  }

  public insertItem(itemData: any): any {
    return this.sendMessage(TVM_INSERTITEM, 0, itemData);
  }

  public deleteItem(hItem: any): boolean {
    return this.sendMessage(TVM_DELETEITEM, 0, hItem) === 1;
  }
}

export class CListCtrl extends CWnd {
  public static override getClassName(): string {
    return "CListCtrl";
  }

  public createList(
    dwStyle: number = WS_CHILD | WS_VISIBLE,
    x = 0,
    y = 0,
    nWidth = 240,
    nHeight = 200,
    pParentWnd: CWnd | null = null,
    nID: number = 0
  ): boolean {
    return this.create(WC_LISTVIEW, "", dwStyle, x, y, nWidth, nHeight, pParentWnd, nID);
  }

  public insertColumn(nCol: number, text: string, width?: number): number {
    return this.sendMessage(LVM_INSERTCOLUMN, nCol, { text, width });
  }

  public insertItem(nItem: number, text: string, icon?: string, subItems?: string[]): number {
    return this.sendMessage(LVM_INSERTITEM, nItem, { id: nItem, text, icon, subItems });
  }

  public deleteAllItems(): boolean {
    return this.sendMessage(LVM_DELETEALLITEMS, 0, 0) === 1;
  }
}
