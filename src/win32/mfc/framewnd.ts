import { CWnd } from "./wnd";
import type { HMENU } from "../types";
import { SetMenu, GetMenu } from "../kernel.svelte";
import { WS_OVERLAPPEDWINDOW, WS_VISIBLE } from "../constants";

export class CFrameWnd extends CWnd {
  public m_hMenu: HMENU | null = null;

  public static getClassName(): string {
    return "CFrameWnd";
  }

  public create(
    className: string | null = null,
    windowName = "MFC Application",
    dwStyle: number = WS_OVERLAPPEDWINDOW | WS_VISIBLE,
    x = 120,
    y = 80,
    nWidth = 460,
    nHeight = 340,
    pParentWnd: CWnd | null = null,
    nID: number | null = null,
    pParam: any = null
  ): boolean {
    return super.create(
      className,
      windowName,
      dwStyle,
      x,
      y,
      nWidth,
      nHeight,
      pParentWnd,
      nID,
      pParam
    );
  }

  public setMenu(hMenu: HMENU | null): boolean {
    this.m_hMenu = hMenu;
    if (this.m_hWnd) {
      return SetMenu(this.m_hWnd, hMenu);
    }
    return true;
  }

  public getMenu(): HMENU | null {
    if (this.m_hWnd) {
      return GetMenu(this.m_hWnd);
    }
    return this.m_hMenu;
  }
}
