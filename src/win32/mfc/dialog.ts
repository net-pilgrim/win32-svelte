import { CWnd } from "./wnd";
import { IDOK, IDCANCEL, WS_POPUP, WS_CAPTION, WS_SYSMENU, WS_VISIBLE, WM_INITDIALOG, WM_COMMAND, LOWORD } from "../constants";

export class CDialog extends CWnd {
  private m_modalResolve?: (result: number) => void;
  public m_nResult: number = 0;

  public static getClassName(): string {
    return "CDialog";
  }

  public async doModal(): Promise<number> {
    const created = this.createDialog();
    if (!created) return IDCANCEL;

    this.onInitDialog();
    this.showWindow();

    return new Promise<number>((resolve) => {
      this.m_modalResolve = resolve;
    });
  }

  protected createDialog(
    caption = "Dialog",
    width = 300,
    height = 180,
    x = 240,
    y = 160
  ): boolean {
    const dwStyle = WS_POPUP | WS_CAPTION | WS_SYSMENU | WS_VISIBLE;
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
    this.destroyWindow();
    if (this.m_modalResolve) {
      this.m_modalResolve(nResult);
      this.m_modalResolve = undefined;
    }
  }

  public override windowProc(uMsg: number, wParam: any, lParam: any): any {
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
    return super.windowProc(uMsg, wParam, lParam);
  }
}
