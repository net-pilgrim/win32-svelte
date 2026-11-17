import { kernel, SendMessage } from "../kernel.svelte";
import { CObject, CWnd, CWinApp, CFrameWnd, CDialog, CPaintDC } from "../mfc";
import {
  CStarterMfcApp,
  CMainFrame,
  CAboutDlg,
  StartStarterMfcApp,
  ID_DRAW_ELLIPSE,
  ID_FILE_NEW,
  IDC_BTN_STEP,
  IDC_BTN_APPLY,
  IDC_EDIT_TEXT,
  IDC_PROGRESS,
} from "../../../examples/starter_mfc_app";
import { WM_COMMAND, BN_CLICKED, IDOK } from "../constants";

async function runMfcTests() {
  console.log("Starting Win32 MFC Architecture Tests...\n");

  // Test 1: CObject RTTI & isKindOf
  console.log("Test 1: Testing CObject RTTI and isKindOf()...");
  const frame = new CMainFrame();
  if (frame.getRuntimeClass() !== "CStarterMainFrame") {
    throw new Error(`Unexpected runtime class: ${frame.getRuntimeClass()}`);
  }
  if (!frame.isKindOf("CFrameWnd") || !frame.isKindOf("CWnd") || !frame.isKindOf("CCmdTarget") || !frame.isKindOf("CObject")) {
    throw new Error("isKindOf failed on inheritance chain");
  }
  console.log("✓ CObject RTTI and inheritance checks passed");

  // Test 2: CWinApp Lifecycle & Main Window Binding
  console.log("Test 2: Testing CWinApp initialization & m_pMainWnd...");
  const app = new CStarterMfcApp("Test MFC App");
  const bInited = await app.initInstance();
  if (!bInited) throw new Error("CWinApp::initInstance failed");
  if (!app.m_pMainWnd || !app.m_pMainWnd.m_hWnd) {
    throw new Error("app.m_pMainWnd not assigned or created");
  }
  const mainHwnd = app.m_pMainWnd.m_hWnd;
  const mainWin = kernel.getWindow(mainHwnd);
  if (!mainWin || mainWin.title !== "Test MFC App") {
    throw new Error(`Main window title mismatch: ${mainWin?.title}`);
  }
  console.log(`✓ CWinApp initialized successfully: HWND ${mainHwnd}, title: "${mainWin.title}"`);

  // Test 3: Verify Child Controls Creation
  console.log("Test 3: Verifying child controls in CMainFrame...");
  const children = kernel.windows.filter((w) => w.parentHwnd === mainHwnd);
  if (children.length < 5) {
    throw new Error(`Expected at least 5 child controls, got ${children.length}`);
  }
  const editCtrl = children.find((c) => c.className === "EDIT");
  const stepBtn = children.find((c) => c.title?.includes("Step"));
  const applyBtn = children.find((c) => c.title === "Apply");
  const progressCtrl = children.find((c) => c.className === "msctls_progress32");

  if (!editCtrl || !stepBtn || !applyBtn || !progressCtrl) {
    throw new Error("Missing expected child controls (edit, buttons, progress)");
  }
  console.log("✓ Child controls verified: CEdit, CButton, CProgressCtrl");

  // Test 4: Message Map Routing via ON_BN_CLICKED
  console.log("Test 4: Testing ON_BN_CLICKED message map dispatch...");
  // Click Step button
  SendMessage(mainHwnd, WM_COMMAND, (BN_CLICKED << 16) | IDC_BTN_STEP, stepBtn.hwnd);
  console.log("✓ Step button clicked via WM_COMMAND / ON_BN_CLICKED");

  // Test 5: Message Map Routing via ON_COMMAND
  console.log("Test 5: Testing ON_COMMAND menu command dispatch...");
  SendMessage(mainHwnd, WM_COMMAND, ID_DRAW_ELLIPSE, 0);
  SendMessage(mainHwnd, WM_COMMAND, ID_FILE_NEW, 0);
  const updatedEditText = kernel.GetWindowText(editCtrl.hwnd);
  if (updatedEditText !== "New MFC Document") {
    throw new Error(`Expected "New MFC Document", got "${updatedEditText}"`);
  }
  console.log(`✓ ON_COMMAND dispatched, text updated to "${updatedEditText}"`);

  // Test 6: Modal CDialog Execution (CAboutDlg)
  console.log("Test 6: Testing modal CDialog (CAboutDlg)...");
  const dlg = new CAboutDlg(undefined, app.m_pMainWnd);
  const modalPromise = dlg.doModal();

  const dlgWin = kernel.getWindow(dlg.m_hWnd);
  if (!dlgWin || dlgWin.title !== "About Starter MFC Application") {
    throw new Error(`CAboutDlg modal window not found in kernel: ${dlgWin?.title}`);
  }

  const dlgChildren = kernel.windows.filter((w) => w.parentHwnd === dlg.m_hWnd);
  const okBtn = dlgChildren.find((c) => c.title === "OK");
  if (!okBtn) throw new Error("OK button not found in dialog");

  // Click OK on modal dialog
  SendMessage(dlgWin.hwnd, WM_COMMAND, IDOK, okBtn.hwnd);
  const nResult = await modalPromise;
  if (nResult !== IDOK) {
    throw new Error(`Expected modal result IDOK (${IDOK}), got ${nResult}`);
  }
  console.log(`✓ CDialog::doModal executed and closed cleanly with IDOK (${nResult})`);

  // Test 7: StartStarterMfcApp standalone helper
  console.log("Test 7: Testing StartStarterMfcApp launcher...");
  const launcherHwnd = StartStarterMfcApp(200, 100);
  if (!launcherHwnd) throw new Error("StartStarterMfcApp returned 0");
  const launcherWin = kernel.getWindow(launcherHwnd);
  if (!launcherWin) throw new Error("Launcher window not registered in kernel");
  console.log(`✓ StartStarterMfcApp created window HWND ${launcherHwnd}`);

  console.log("\nALL MFC ARCHITECTURE & STARTER APP TESTS PASSED! 📐⚡🎉");
  process.exit(0);
}

runMfcTests().catch((err) => {
  console.error("MFC Test Failed:", err);
  process.exit(1);
});
