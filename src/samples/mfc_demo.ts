import {
  CWinApp,
  CFrameWnd,
  CDialog,
  CPaintDC,
  CButton,
  CEdit,
  CProgressCtrl,
  CSliderCtrl,
  createMessageMap,
  ON_WM_MESSAGE,
  ON_COMMAND,
  ON_BN_CLICKED,
} from "../win32/mfc";

import {
  CreateMenu,
  CreatePopupMenu,
  AppendMenu,
  audio,
} from "../win32/kernel.svelte";

import {
  WM_CREATE,
  WM_PAINT,
  WM_COMMAND,
  MF_STRING,
  MF_POPUP,
  MF_SEPARATOR,
  MB_OK,
  MB_ICONINFORMATION,
  WS_CHILD,
  WS_VISIBLE,
  BS_PUSHBUTTON,
  IDOK,
  IDCANCEL,
} from "../win32/constants";

// Command & Control IDs
const ID_FILE_NEW = 9001;
const ID_FILE_EXIT = 9002;
const ID_DRAW_RECTANGLE = 9101;
const ID_DRAW_ELLIPSE = 9102;
const ID_HELP_ABOUT = 9201;

const IDC_BTN_STEP = 9301;
const IDC_SLIDER = 9302;
const IDC_PROGRESS = 9303;

/**
 * CAboutDlg: Standard MFC modal dialog box
 */
class CAboutDlg extends CDialog {
  public static override getClassName(): string {
    return "CAboutDlg";
  }

  public override onInitDialog(): boolean {
    this.setWindowText("About MFC Scribble");

    // Add dialog static text
    this.createEx(0, "STATIC", "Microsoft Foundation Classes (MFC) for Svelte 5", WS_CHILD | WS_VISIBLE, 14, 16, 260, 20, this.m_hWnd);
    this.createEx(0, "STATIC", "Version 1.0 - Pure Object-Oriented Win32", WS_CHILD | WS_VISIBLE, 14, 38, 260, 18, this.m_hWnd);
    this.createEx(0, "STATIC", "Built with CWinApp, CFrameWnd, CDialog, CDC", WS_CHILD | WS_VISIBLE, 14, 58, 260, 18, this.m_hWnd);

    // Add OK button
    const btnOk = new CButton();
    btnOk.createButton("OK", WS_CHILD | WS_VISIBLE | BS_PUSHBUTTON, 110, 96, 75, 24, this, IDOK);

    return true;
  }
}

/**
 * CMainFrame: The main top-level window frame of our MFC application
 */
class CMainFrame extends CFrameWnd {
  private m_btnStep = new CButton();
  private m_progress = new CProgressCtrl();
  private m_slider = new CSliderCtrl();

  private m_shapeType: "rectangle" | "ellipse" | "text" = "rectangle";
  private m_progressVal = 40;

  public static override getClassName(): string {
    return "CMainFrame";
  }

  protected override getMessageMap() {
    return createMessageMap(
      undefined,
      ON_WM_MESSAGE(WM_CREATE, "OnCreate"),
      ON_WM_MESSAGE(WM_PAINT, "OnPaint"),
      ON_COMMAND(ID_FILE_NEW, "OnFileNew"),
      ON_COMMAND(ID_FILE_EXIT, "OnFileExit"),
      ON_COMMAND(ID_DRAW_RECTANGLE, "OnDrawRectangle"),
      ON_COMMAND(ID_DRAW_ELLIPSE, "OnDrawEllipse"),
      ON_COMMAND(ID_HELP_ABOUT, "OnHelpAbout"),
      ON_BN_CLICKED(IDC_BTN_STEP, "OnBtnStep")
    );
  }

  public OnCreate(): number {
    this.setCustomProp("hasCanvas", true);

    // 1. Construct Menu Bar
    const hMenuBar = CreateMenu();

    const hMenuFile = CreatePopupMenu();
    AppendMenu(hMenuFile, MF_STRING, ID_FILE_NEW, "&New\tCtrl+N");
    AppendMenu(hMenuFile, MF_SEPARATOR, 0, "");
    AppendMenu(hMenuFile, MF_STRING, ID_FILE_EXIT, "E&xit");
    AppendMenu(hMenuBar, MF_POPUP, hMenuFile, "&File");

    const hMenuDraw = CreatePopupMenu();
    AppendMenu(hMenuDraw, MF_STRING, ID_DRAW_RECTANGLE, "&Rectangle");
    AppendMenu(hMenuDraw, MF_STRING, ID_DRAW_ELLIPSE, "&Ellipse");
    AppendMenu(hMenuBar, MF_POPUP, hMenuDraw, "&Draw");

    const hMenuHelp = CreatePopupMenu();
    AppendMenu(hMenuHelp, MF_STRING, ID_HELP_ABOUT, "&About MFC Scribble...");
    AppendMenu(hMenuBar, MF_POPUP, hMenuHelp, "&Help");

    this.setMenu(hMenuBar);

    // 2. Child Controls
    this.m_progress.createProgress(WS_CHILD | WS_VISIBLE, 10, 6, 200, 22, this, IDC_PROGRESS);
    this.m_progress.setPos(this.m_progressVal);

    this.m_btnStep.createButton("Step Progress", WS_CHILD | WS_VISIBLE, 218, 6, 95, 22, this, IDC_BTN_STEP);

    return 0;
  }

  public OnPaint(): void {
    // Standard MFC: construct a CPaintDC object on the stack
    const dc = new CPaintDC(this);
    if (!dc.m_hDC) return;

    const w = dc.m_hDC.canvas.width;
    const h = dc.m_hDC.canvas.height;

    // Clear background
    dc.selectStockBrush("#ffffff");
    dc.selectStockPen("#ffffff", 1);
    dc.rectangle(0, 36, w, h);

    // Draw grid lines
    dc.selectStockPen("#e0e0e0", 1);
    for (let x = 0; x < w; x += 20) {
      dc.moveTo(x, 36);
      dc.lineTo(x, h);
    }
    for (let y = 36; y < h; y += 20) {
      dc.moveTo(0, y);
      dc.lineTo(w, y);
    }

    if (this.m_shapeType === "rectangle") {
      dc.selectStockBrush("#3a6ea5");
      dc.selectStockPen("#000080", 2);
      dc.rectangle(40, 60, w - 40, h - 40);

      dc.setTextColor("#ffffff");
      dc.textOut(60, 80, "MFC CDC::Rectangle - Drawn via CPaintDC");
    } else {
      dc.selectStockBrush("#ffcc00");
      dc.selectStockPen("#b8860b", 3);
      dc.ellipse(40, 60, w - 40, h - 40);

      dc.setTextColor("#000000");
      dc.textOut(w / 2 - 70, h / 2 - 6, "MFC CDC::Ellipse");
    }

    dc.setTextColor("#000080");
    dc.textOut(10, h - 20, "CMainFrame::OnPaint() completed successfully.");

    dc.dispose();
  }

  public OnFileNew(): void {
    this.m_shapeType = "rectangle";
    this.m_progressVal = 0;
    this.m_progress.setPos(0);
    this.updateWindow();
    audio.playDing();
  }

  public OnFileExit(): void {
    this.destroyWindow();
  }

  public OnDrawRectangle(): void {
    this.m_shapeType = "rectangle";
    this.updateWindow();
    audio.playDing();
  }

  public OnDrawEllipse(): void {
    this.m_shapeType = "ellipse";
    this.updateWindow();
    audio.playDing();
  }

  public async OnHelpAbout(): Promise<void> {
    const dlg = new CAboutDlg();
    audio.playChime();
    await dlg.doModal();
  }

  public OnBtnStep(): void {
    this.m_progressVal = (this.m_progressVal + 15) % 100;
    this.m_progress.setPos(this.m_progressVal);
    audio.playClick();
  }
}

/**
 * CMfcDemoApp: The global MFC application object
 */
export class CMfcDemoApp extends CWinApp {
  public static override getClassName(): string {
    return "CMfcDemoApp";
  }

  public override async initInstance(): Promise<boolean> {
    const pFrame = new CMainFrame();
    this.m_pMainWnd = pFrame;

    pFrame.create(
      null,
      "MFC Scribble Application",
      0x00000000 | 0x00c00000 | 0x00080000 | 0x00040000 | 0x00020000 | 0x00010000 | 0x10000000,
      140,
      60,
      440,
      320
    );

    pFrame.showWindow();
    pFrame.updateWindow();
    return true;
  }
}

export function StartMfcDemo(x = 140, y = 60): number {
  const app = new CMfcDemoApp("MFC Scribble");
  const pFrame = new CMainFrame();
  app.m_pMainWnd = pFrame;

  pFrame.create(
    null,
    "MFC Scribble Application",
    0x00000000 | 0x00c00000 | 0x00080000 | 0x00040000 | 0x00020000 | 0x00010000 | 0x10000000,
    x,
    y,
    440,
    320
  );

  pFrame.showWindow();
  pFrame.updateWindow();
  return pFrame.m_hWnd;
}
