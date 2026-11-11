import { CObject } from "./object";
import type { MessageMap, MessageMapEntry } from "./messages";
import type { UINT, WPARAM, LPARAM, LRESULT } from "../types";
import { WM_COMMAND, WM_NOTIFY, LOWORD, HIWORD } from "../constants";

export class CCmdTarget extends CObject {
  public static getClassName(): string {
    return "CCmdTarget";
  }

  protected getMessageMap(): MessageMap {
    return {
      entries: [],
    };
  }

  /**
   * Routes a message through the message map hierarchy
   */
  public onCmdMsg(
    uMsg: UINT,
    wParam: WPARAM,
    lParam: LPARAM
  ): { handled: boolean; result: LRESULT } {
    let currentMap: MessageMap | undefined = this.getMessageMap();

    while (currentMap) {
      for (const entry of currentMap.entries) {
        if (this.matchEntry(entry, uMsg, wParam, lParam)) {
          let res: any;
          if (typeof entry.handler === "function") {
            res = entry.handler.call(this, wParam, lParam);
          } else if (typeof entry.handler === "string" && typeof (this as any)[entry.handler] === "function") {
            res = (this as any)[entry.handler](wParam, lParam);
          }
          return { handled: true, result: typeof res === "number" ? res : 0 };
        }
      }
      currentMap = currentMap.baseMap ? currentMap.baseMap() : undefined;
    }

    return { handled: false, result: 0 };
  }

  private matchEntry(entry: MessageMapEntry, uMsg: UINT, wParam: WPARAM, lParam: LPARAM): boolean {
    if (entry.nMessage !== undefined && entry.nMessage !== uMsg) {
      return false;
    }

    if (uMsg === WM_COMMAND) {
      const id = LOWORD(wParam);
      const code = HIWORD(wParam);

      if (entry.nId !== undefined && entry.nId !== id) {
        return false;
      }
      if (entry.nCode !== undefined && entry.nCode !== code) {
        return false;
      }
      return true;
    }

    if (uMsg === WM_NOTIFY) {
      const id = wParam;
      const nmhdr = lParam;
      const code = nmhdr?.code;

      if (entry.nId !== undefined && entry.nId !== id) {
        return false;
      }
      if (entry.nCode !== undefined && entry.nCode !== code) {
        return false;
      }
      return true;
    }

    return true;
  }
}
