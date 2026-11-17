import { CDialog, CButton } from "../../src/win32/mfc";
import { WS_CHILD, WS_VISIBLE, BS_PUSHBUTTON, IDOK } from "../../src/win32/constants";

/**
 * CAboutDlg - Classic MFC modal "About" dialog box
 */
export class CAboutDlg extends CDialog {
  public static override getClassName(): string {
    return "CAboutDlg";
  }

  public override onInitDialog(): boolean {
    this.setWindowText("About Starter MFC Application");

    // Static text controls for dialog branding
    this.createEx(
      0,
      "STATIC",
      "Microsoft Foundation Classes (MFC) Starter Template",
      WS_CHILD | WS_VISIBLE,
      14,
      16,
      270,
      20,
      this.m_hWnd
    );

    this.createEx(
      0,
      "STATIC",
      "Version 1.0.0 (Win32-Svelte Edition)",
      WS_CHILD | WS_VISIBLE,
      14,
      38,
      270,
      18,
      this.m_hWnd
    );

    this.createEx(
      0,
      "STATIC",
      "Demonstrating CWinApp, CFrameWnd, CDialog & CDC.",
      WS_CHILD | WS_VISIBLE,
      14,
      58,
      270,
      18,
      this.m_hWnd
    );

    // Standard OK Button mapped to IDOK
    const btnOk = new CButton();
    btnOk.createButton("OK", WS_CHILD | WS_VISIBLE | BS_PUSHBUTTON, 115, 96, 75, 24, this, IDOK);

    return true;
  }
}
