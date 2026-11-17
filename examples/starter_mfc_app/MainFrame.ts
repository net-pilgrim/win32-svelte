import {
  CFrameWnd,
  CPaintDC,
  CButton,
  CEdit,
  CStatic,
  CProgressCtrl,
  CComboBox,
  createMessageMap,
  ON_WM_MESSAGE,
  ON_COMMAND,
  ON_BN_CLICKED,
} from "../../src/win32/mfc";

import {
  CreateMenu,
  CreatePopupMenu,
  AppendMenu,
  audio,
} from "../../src/win32/kernel.svelte";

import {
  WM_CREATE,
  WM_PAINT,
  MF_STRING,
  MF_POPUP,
  MF_SEPARATOR,
  WS_CHILD,
  WS_VISIBLE,
  BS_PUSHBUTTON,
} from "../../src/win32/constants";

import {
  ID_FILE_NEW,
  ID_FILE_RESET,
  ID_FILE_EXIT,
  ID_DRAW_RECTANGLE,
  ID_DRAW_ELLIPSE,
  ID_DRAW_ROUNDRECT,
  ID_HELP_ABOUT,
  IDC_STATIC_LABEL,
  IDC_EDIT_TEXT,
  IDC_BTN_APPLY,
  IDC_BTN_STEP,
  IDC_PROGRESS,
  IDC_COMBO_STYLE,
} from "./Resource";

import { CAboutDlg } from "./AboutDlg";

/**
 * CMainFrame - Single-Document Interface (SDI) Main Frame Window
 */
export class CMainFrame extends CFrameWnd {
  // Child Controls
  private m_staticPrompt = new CStatic();
  private m_editInput = new CEdit();
  private m_btnApply = new CButton();
  private m_btnStep = new CButton();
  private m_progress = new CProgressCtrl();
  private m_comboStyle = new CComboBox();

  // Application State
  private m_displayText = "Hello from MFC Starter!";
  private m_progressVal = 25;
  private m_shape: "rectangle" | "ellipse" | "roundrect" = "rectangle";

  public static override getClassName(): string {
    return "CStarterMainFrame";
  }

  protected override getMessageMap() {
    return createMessageMap(
      undefined,
      ON_WM_MESSAGE(WM_CREATE, "OnCreate"),
      ON_WM_MESSAGE(WM_PAINT, "OnPaint"),
      ON_COMMAND(ID_FILE_NEW, "OnFileNew"),
      ON_COMMAND(ID_FILE_RESET, "OnFileReset"),
      ON_COMMAND(ID_FILE_EXIT, "OnFileExit"),
      ON_COMMAND(ID_DRAW_RECTANGLE, "OnDrawRectangle"),
      ON_COMMAND(ID_DRAW_ELLIPSE, "OnDrawEllipse"),
      ON_COMMAND(ID_DRAW_ROUNDRECT, "OnDrawRoundRect"),
      ON_COMMAND(ID_HELP_ABOUT, "OnHelpAbout"),
      ON_BN_CLICKED(IDC_BTN_APPLY, "OnBtnApply"),
      ON_BN_CLICKED(IDC_BTN_STEP, "OnBtnStep")
    );
  }

  public OnCreate(): number {
    // Enable GDI HTML5 canvas rendering for this window
    this.setCustomProp("hasCanvas", true);

    // 1. Construct Menu Bar
    const hMenuBar = CreateMenu();

    // File Menu
    const hMenuFile = CreatePopupMenu();
    AppendMenu(hMenuFile, MF_STRING, ID_FILE_NEW, "&New\tCtrl+N");
    AppendMenu(hMenuFile, MF_STRING, ID_FILE_RESET, "&Reset State");
    AppendMenu(hMenuFile, MF_SEPARATOR, 0, "");
    AppendMenu(hMenuFile, MF_STRING, ID_FILE_EXIT, "E&xit");
    AppendMenu(hMenuBar, MF_POPUP, hMenuFile, "&File");

    // Draw Menu
    const hMenuDraw = CreatePopupMenu();
    AppendMenu(hMenuDraw, MF_STRING, ID_DRAW_RECTANGLE, "&Rectangle");
    AppendMenu(hMenuDraw, MF_STRING, ID_DRAW_ELLIPSE, "&Ellipse");
    AppendMenu(hMenuDraw, MF_STRING, ID_DRAW_ROUNDRECT, "Ro&und Rectangle");
    AppendMenu(hMenuBar, MF_POPUP, hMenuDraw, "&Draw");

    // Help Menu
    const hMenuHelp = CreatePopupMenu();
    AppendMenu(hMenuHelp, MF_STRING, ID_HELP_ABOUT, "&About Starter MFC...");
    AppendMenu(hMenuBar, MF_POPUP, hMenuHelp, "&Help");

    this.setMenu(hMenuBar);

    // 2. Toolbar & Child Controls Layout
    this.m_staticPrompt.createStatic("Banner Text:", WS_CHILD | WS_VISIBLE, 10, 8, 80, 20, this, IDC_STATIC_LABEL);
    this.m_editInput.createEdit(this.m_displayText, WS_CHILD | WS_VISIBLE, 95, 6, 175, 22, this, IDC_EDIT_TEXT);
    this.m_btnApply.createButton("Apply", WS_CHILD | WS_VISIBLE | BS_PUSHBUTTON, 276, 6, 60, 22, this, IDC_BTN_APPLY);

    this.m_progress.createProgress(WS_CHILD | WS_VISIBLE, 10, 34, 210, 20, this, IDC_PROGRESS);
    this.m_progress.setRange(0, 100);
    this.m_progress.setPos(this.m_progressVal);

    this.m_btnStep.createButton("Step +15%", WS_CHILD | WS_VISIBLE | BS_PUSHBUTTON, 226, 33, 80, 22, this, IDC_BTN_STEP);

    return 0;
  }

  public OnPaint(): void {
    const dc = new CPaintDC(this);
    if (!dc.m_hDC) return;

    const w = dc.m_hDC.canvas.width;
    const h = dc.m_hDC.canvas.height;

    // 1. Fill canvas background
    dc.selectStockBrush("#f0f0f0");
    dc.selectStockPen("#808080", 1);
    dc.rectangle(0, 62, w, h);

    // 2. Draw subtle background grid
    dc.selectStockPen("#e4e4e4", 1);
    for (let x = 0; x < w; x += 25) {
      dc.moveTo(x, 62);
      dc.lineTo(x, h);
    }
    for (let y = 62; y < h; y += 25) {
      dc.moveTo(0, y);
      dc.lineTo(w, y);
    }

    // 3. Render active geometric shape
    const top = 80;
    const bottom = h - 35;
    const left = 30;
    const right = w - 30;

    if (this.m_shape === "rectangle") {
      dc.selectStockBrush("#000080"); // Classic Windows Navy
      dc.selectStockPen("#000000", 2);
      dc.rectangle(left, top, right, bottom);

      dc.setTextColor("#ffffff");
      dc.textOut(left + 20, top + 20, "MFC CFrameWnd - CDC::Rectangle");
    } else if (this.m_shape === "ellipse") {
      dc.selectStockBrush("#2e8b57"); // Sea Green
      dc.selectStockPen("#004d26", 2);
      dc.ellipse(left, top, right, bottom);

      dc.setTextColor("#ffffff");
      dc.textOut(left + 35, (top + bottom) / 2 - 8, "MFC CFrameWnd - CDC::Ellipse");
    } else {
      dc.selectStockBrush("#d2691e"); // Chocolate Accent
      dc.selectStockPen("#5c2e0b", 2);
      dc.rectangle(left + 20, top + 10, right - 20, bottom - 10);

      dc.setTextColor("#ffffff");
      dc.textOut(left + 35, top + 25, "MFC Custom Shape View");
    }

    // 4. Render dynamic banner text & footer
    dc.setTextColor("#ffffff");
    dc.textOut(left + 20, bottom - 30, `Text: "${this.m_displayText}"`);

    dc.setTextColor("#404040");
    dc.textOut(10, h - 18, `Status: Ready | Shape: ${this.m_shape} | Progress: ${this.m_progressVal}%`);

    dc.dispose();
  }

  public OnFileNew(): void {
    this.m_displayText = "New MFC Document";
    this.m_editInput.setWindowText(this.m_displayText);
    this.m_progressVal = 0;
    this.m_progress.setPos(0);
    this.updateWindow();
    audio.playDing();
  }

  public OnFileReset(): void {
    this.m_displayText = "Hello from MFC Starter!";
    this.m_editInput.setWindowText(this.m_displayText);
    this.m_progressVal = 25;
    this.m_progress.setPos(this.m_progressVal);
    this.m_shape = "rectangle";
    this.updateWindow();
    audio.playDing();
  }

  public OnFileExit(): void {
    this.destroyWindow();
  }

  public OnDrawRectangle(): void {
    this.m_shape = "rectangle";
    this.updateWindow();
    audio.playClick();
  }

  public OnDrawEllipse(): void {
    this.m_shape = "ellipse";
    this.updateWindow();
    audio.playClick();
  }

  public OnDrawRoundRect(): void {
    this.m_shape = "roundrect";
    this.updateWindow();
    audio.playClick();
  }

  public async OnHelpAbout(): Promise<void> {
    const dlg = new CAboutDlg();
    audio.playChime();
    await dlg.doModal();
  }

  public OnBtnApply(): void {
    const text = this.m_editInput.getWindowText();
    if (text) {
      this.m_displayText = text;
      this.updateWindow();
      audio.playDing();
    }
  }

  public OnBtnStep(): void {
    this.m_progressVal = (this.m_progressVal + 15) % 105;
    if (this.m_progressVal > 100) this.m_progressVal = 0;
    this.m_progress.setPos(this.m_progressVal);
    this.updateWindow();
    audio.playClick();
  }
}
