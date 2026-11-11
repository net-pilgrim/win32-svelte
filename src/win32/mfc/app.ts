import { CCmdTarget } from "./cmdtarget";
import type { CWnd } from "./wnd";
import { PostQuitMessage, RunMessageLoop } from "../kernel.svelte";

let globalApp: CWinApp | null = null;

export class CWinApp extends CCmdTarget {
  public m_pMainWnd: CWnd | null = null;
  public m_pszAppName: string = "MFC Application";
  private m_bRunning = false;

  public static getClassName(): string {
    return "CWinApp";
  }

  constructor(appName?: string) {
    super();
    if (appName) this.m_pszAppName = appName;
    globalApp = this;
  }

  public async initInstance(): Promise<boolean> {
    return true;
  }

  public exitInstance(): number {
    return 0;
  }

  public async run(): Promise<number> {
    const success = await this.initInstance();
    if (!success) {
      return this.exitInstance();
    }
    if (this.m_pMainWnd && !this.m_pMainWnd.m_hWnd) {
      return this.exitInstance();
    }
    this.m_bRunning = true;
    try {
      await RunMessageLoop();
    } finally {
      this.m_bRunning = false;
    }
    return this.exitInstance();
  }

  public onMainWindowDestroyed(): void {
    if (this.m_bRunning) PostQuitMessage();
  }
}

export function AfxGetApp(): CWinApp | null {
  return globalApp;
}

export function AfxGetMainWnd(): CWnd | null {
  return globalApp?.m_pMainWnd ?? null;
}
