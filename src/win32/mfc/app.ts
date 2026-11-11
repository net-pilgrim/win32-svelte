import { CCmdTarget } from "./cmdtarget";
import type { CWnd } from "./wnd";
import { RunMessageLoop } from "../kernel.svelte";

let globalApp: CWinApp | null = null;

export class CWinApp extends CCmdTarget {
  public m_pMainWnd: CWnd | null = null;
  public m_pszAppName: string = "MFC Application";

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
    await RunMessageLoop();
    return this.exitInstance();
  }
}

export function AfxGetApp(): CWinApp | null {
  return globalApp;
}

export function AfxGetMainWnd(): CWnd | null {
  return globalApp?.m_pMainWnd ?? null;
}
