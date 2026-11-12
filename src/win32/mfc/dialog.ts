import { CWnd } from "./wnd";
import { AfxGetMainWnd } from "./app";
import {
  EnableWindow,
  CreateDialogParam,
  GetDlgItem,
  GetDlgItemText,
  SetDlgItemText,
  CheckDlgButton,
  IsDlgButtonChecked,
} from "../kernel.svelte";
import {
  IDOK,
  IDCANCEL,
  WS_POPUP,
  WS_CAPTION,
  WS_SYSMENU,
  WM_COMMAND,
  WM_CLOSE,
  WM_DESTROY,
  LOWORD,
} from "../constants";
import type { HWND } from "../types";
import type { ResourceBundle, DialogTemplate } from "../../rc/types";

export class CDialog extends CWnd {
  private m_modalResolve?: (result: number) => void;
  public m_nResult: number = IDCANCEL;
  protected m_pParentWnd?: CWnd;
  protected m_nIDTemplate?: number | string | DialogTemplate;
  protected m_resourceBundle?: ResourceBundle;

  public static getClassName(): string {
    return "CDialog";
  }

  constructor(
    lpszTemplateName?: number | string | DialogTemplate,
    pParentWnd?: CWnd,
    bundle?: ResourceBundle
  ) {
    super();
    this.m_nIDTemplate = lpszTemplateName;
    this.m_resourceBundle = bundle;
    if (pParentWnd) {
      this.m_pParentWnd = pParentWnd;
    }
  }

  public async doModal(): Promise<number> {
    const owner = this.m_pParentWnd ?? AfxGetMainWnd();
    const ownerHwnd = owner?.m_hWnd ?? 0;
    const ownerWasEnabled = ownerHwnd ? EnableWindow(ownerHwnd, false) : false;

    try {
      if (!this.createDialog()) return IDCANCEL;

      const modalResult = new Promise<number>((resolve) => {
        this.m_modalResolve = resolve;
      });
      this.onInitDialog();
      if (this.m_hWnd) this.showWindow();
      return await modalResult;
    } finally {
      if (ownerHwnd) EnableWindow(ownerHwnd, ownerWasEnabled);
    }
  }

  protected createDialog(
    caption = "Dialog",
    width = 300,
    height = 180,
    x = 240,
    y = 160
  ): boolean {
    const owner = this.m_pParentWnd ?? AfxGetMainWnd();
    const ownerHwnd = owner?.m_hWnd ?? null;

    if (this.m_nIDTemplate) {
      const hDlg = CreateDialogParam(
        null,
        this.m_nIDTemplate,
        ownerHwnd,
        (_hwnd, uMsg, wParam, lParam) => this.windowProc(uMsg, wParam, lParam),
        0,
        this.m_resourceBundle
      );
      if (!hDlg) return false;
      this.attach(hDlg);
      return true;
    }

    const dwStyle = WS_POPUP | WS_CAPTION | WS_SYSMENU;
    return this.createEx(0, null, caption, dwStyle, x, y, width, height, ownerHwnd, null);
  }

  public onInitDialog(): boolean {
    return true;
  }

  public onOK(): void {
    this.endDialog(IDOK);
  }

  public onCancel(): void {
    this.endDialog(IDCANCEL);
  }

  public endDialog(nResult: number): void {
    this.m_nResult = nResult;
    if (!this.destroyWindow()) this.resolveModal(nResult);
  }

  public getDlgItem(nID: number): HWND {
    if (!this.m_hWnd) return 0;
    return GetDlgItem(this.m_hWnd, nID);
  }

  public getDlgItemText(nID: number): string {
    if (!this.m_hWnd) return "";
    return GetDlgItemText(this.m_hWnd, nID);
  }

  public setDlgItemText(nID: number, text: string): boolean {
    if (!this.m_hWnd) return false;
    return SetDlgItemText(this.m_hWnd, nID, text);
  }

  public checkDlgButton(nID: number, uCheck: number): boolean {
    if (!this.m_hWnd) return false;
    return CheckDlgButton(this.m_hWnd, nID, uCheck);
  }

  public isDlgButtonChecked(nID: number): number {
    if (!this.m_hWnd) return 0;
    return IsDlgButtonChecked(this.m_hWnd, nID);
  }

  public override windowProc(uMsg: number, wParam: any, lParam: any): any {
    if (uMsg === WM_CLOSE) {
      this.onCancel();
      return 0;
    }

    if (uMsg === WM_COMMAND) {
      const id = LOWORD(wParam);
      if (id === IDOK) {
        this.onOK();
        return 0;
      }
      if (id === IDCANCEL) {
        this.onCancel();
        return 0;
      }
    }
    try {
      return super.windowProc(uMsg, wParam, lParam);
    } finally {
      if (uMsg === WM_DESTROY) this.resolveModal(this.m_nResult);
    }
  }

  private resolveModal(result: number): void {
    const resolve = this.m_modalResolve;
    this.m_modalResolve = undefined;
    resolve?.(result);
  }
}
