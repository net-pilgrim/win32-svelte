import type { HWND, UINT, WPARAM, LPARAM, LRESULT } from "../types";
import { WM_COMMAND, WM_NOTIFY, LOWORD, HIWORD, BN_CLICKED, EN_CHANGE } from "../constants";

export type MessageHandler = (wParam: WPARAM, lParam: LPARAM) => LRESULT | void;

export interface MessageMapEntry {
  nMessage?: UINT;
  nCode?: number;
  nId?: number;
  handler: string | MessageHandler;
}

export interface MessageMap {
  baseMap?: () => MessageMap;
  entries: MessageMapEntry[];
}

/**
 * Message Map macro equivalents:
 * BEGIN_MESSAGE_MAP / END_MESSAGE_MAP
 */
export function createMessageMap(
  baseMapSupplier?: () => MessageMap,
  ...entries: MessageMapEntry[]
): MessageMap {
  return {
    baseMap: baseMapSupplier,
    entries,
  };
}

export function ON_WM_MESSAGE(uMsg: UINT, handler: string | MessageHandler): MessageMapEntry {
  return { nMessage: uMsg, handler };
}

export function ON_COMMAND(id: number, handler: string | MessageHandler): MessageMapEntry {
  return { nMessage: WM_COMMAND, nId: id, handler };
}

export function ON_BN_CLICKED(id: number, handler: string | MessageHandler): MessageMapEntry {
  return { nMessage: WM_COMMAND, nCode: BN_CLICKED, nId: id, handler };
}

export function ON_EN_CHANGE(id: number, handler: string | MessageHandler): MessageMapEntry {
  return { nMessage: WM_COMMAND, nCode: EN_CHANGE, nId: id, handler };
}

export function ON_NOTIFY(code: number, id: number, handler: string | MessageHandler): MessageMapEntry {
  return { nMessage: WM_NOTIFY, nCode: code, nId: id, handler };
}
