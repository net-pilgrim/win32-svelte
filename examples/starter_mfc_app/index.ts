/**
 * Starter MFC Application for win32-svelte
 *
 * Demonstrates:
 * - CWinApp application class lifecycle and initInstance().
 * - CFrameWnd top-level SDI frame window with hierarchical menus.
 * - Message maps: ON_COMMAND, ON_BN_CLICKED, ON_WM_MESSAGE.
 * - CPaintDC device context painting with custom pens, brushes, and text.
 * - Controls: CStatic, CEdit, CButton, CProgressCtrl, CComboBox.
 * - Modal CDialog: CAboutDlg with onInitDialog() and doModal().
 */

export * from "./Resource";
export * from "./AboutDlg";
export * from "./MainFrame";
export * from "./App";

import { CStarterMfcApp } from "./App";
import { CMainFrame } from "./MainFrame";
import { WS_OVERLAPPEDWINDOW, WS_VISIBLE } from "../../src/win32/constants";

/**
 * Entry point helper to launch the Starter MFC application
 */
export function StartStarterMfcApp(x = 160, y = 70): number {
  const app = new CStarterMfcApp("MFC Starter Application");
  const pFrame = new CMainFrame();
  app.m_pMainWnd = pFrame;

  pFrame.create(
    null,
    "MFC Starter Application",
    WS_OVERLAPPEDWINDOW | WS_VISIBLE,
    x,
    y,
    440,
    320
  );

  pFrame.showWindow();
  pFrame.updateWindow();

  return pFrame.m_hWnd;
}
