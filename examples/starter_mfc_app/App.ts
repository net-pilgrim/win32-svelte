import { CWinApp } from "../../src/win32/mfc";
import { CMainFrame } from "./MainFrame";
import { WS_OVERLAPPEDWINDOW, WS_VISIBLE } from "../../src/win32/constants";

/**
 * CStarterMfcApp - Application object managing lifecycle and main window initialization
 */
export class CStarterMfcApp extends CWinApp {
  public static override getClassName(): string {
    return "CStarterMfcApp";
  }

  constructor(appName = "MFC Starter Application") {
    super(appName);
  }

  public override async initInstance(): Promise<boolean> {
    const pFrame = new CMainFrame();
    this.m_pMainWnd = pFrame;

    // Create Single-Document Interface (SDI) frame window
    const bCreated = pFrame.create(
      null,
      this.m_pszAppName,
      WS_OVERLAPPEDWINDOW | WS_VISIBLE,
      150,
      70,
      440,
      320
    );

    if (!bCreated) {
      return false;
    }

    pFrame.showWindow();
    pFrame.updateWindow();

    return true;
  }
}
