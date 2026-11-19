import { StartMinesweeper } from "../../samples/minesweeper";
import { StartCalculator } from "../../samples/calculator";
import { StartNotepad } from "../../samples/notepad";
import { StartControlGallery } from "../../samples/control_gallery";
import { StartPaintDemo } from "../../samples/paint_demo";
import { StartExplorer } from "../../samples/explorer";
import { StartMfcDemo } from "../../samples/mfc_demo";
import { StartWasmApp } from "../../samples/wasm_app";
import { StartOdbcAdmin } from "../../samples/odbc_admin";
import { StartISQL } from "../../samples/isql";
import { StartHwndInspector } from "../../samples/hwnd_inspector";
import { MessageBox } from "../kernel.svelte";
import { MB_OK } from "../constants";
import { audio } from "../audio";

export interface MenuItem {
  id?: string;
  label?: string;
  mnemonic?: string;
  icon?: string;
  type?: string;
  action?: string;
  params?: Record<string, any>;
  args?: any[];
  items?: MenuItem[];
  disabled?: boolean;
}

export interface StartMenuProps {
  isOpen: boolean;
  onClose: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  flat?: boolean;
}

export function formatMnemonic(label?: string, mnemonic?: string): string {
  if (!label) return "";
  if (!mnemonic) return label;
  const idx = label.toLowerCase().indexOf(mnemonic.toLowerCase());
  if (idx === -1) return label;
  return `${label.slice(0, idx)}<u>${label[idx]}</u>${label.slice(idx + 1)}`;
}

export function handleShutDown(onClose: () => void) {
  audio.playClick();
  onClose();
  audio.playTada();
  MessageBox(
    null,
    "It is now safe to turn off your computer.\n\nThank you for using win32-svelte!",
    "Shut Down Windows",
    MB_OK
  );
}

export function createActionHandlers(
  onToggleSound: () => void,
  onClose: () => void
): Record<string, (params: Record<string, any>) => any> {
  return {
    explorer: (p) => StartExplorer(p.x, p.y),
    wasm: (p) => StartWasmApp(p.x, p.y, p.path),
    lua: (p) => {
      import("../../samples/lua_host").then(({ StartLuaHost }) => StartLuaHost(p.x, p.y, p.path));
    },
    doom: (p) => {
      import("../../samples/doom").then(({ StartDoom }) => StartDoom(p.x, p.y));
    },
    minesweeper: (p) => StartMinesweeper(p.x, p.y),
    paint: (p) => StartPaintDemo(p.x, p.y),
    notepad: (p) => StartNotepad(p.x, p.y, p.path),
    calculator: (p) => StartCalculator(p.x, p.y),
    mfc: (p) => StartMfcDemo(p.x, p.y),
    rc: (p) => {
      import("../../samples/rc_demo").then(({ StartRcDemo }) => StartRcDemo(p.x, p.y));
    },
    odbc: (p) => StartOdbcAdmin(p.x, p.y),
    isql: (p) => StartISQL(p.x, p.y),
    regedit: (p) => {
      import("../../samples/regedit").then(({ StartRegEdit }) => StartRegEdit(p.x, p.y));
    },
    control_gallery: (p) => StartControlGallery(p.x, p.y),
    inspector: () => StartHwndInspector(),
    toggle_sound: () => onToggleSound(),
    shutdown: () => handleShutDown(onClose),
  };
}
