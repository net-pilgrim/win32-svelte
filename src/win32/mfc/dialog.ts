import { CWnd } from "./wnd";
import { AfxGetMainWnd } from "./app";
import { EnableWindow } from "../kernel.svelte";
import { IDOK, IDCANCEL, WS_POPUP, WS_CAPTION, WS_SYSMENU, WM_INITDIALOG, WM_COMMAND, WM_CLOSE, WM_DESTROY, LOWORD } from "../constants";

export class CDialog extends CWnd {
  private m_modalResolve?: (result: number) => void;
  public m_nResult: number = IDCANCEL;

  public static getClassName(): string {
    return "CDialog";
  }

  public async doModal(): Promise<number> {
    const owner = AfxGetMainWnd();
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
    const dwStyle = WS_POPUP | WS_CAPTION | WS_SYSMENU;
    return this.createEx(0, null, caption, dwStyle, x, y, width, height, null, null);
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
