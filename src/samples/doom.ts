import { StartWasmApp } from "./wasm_app";
import { kernel } from "../win32/kernel.svelte";
import type { HWND } from "../win32/types";

/**
 * Start DOOM 95 Application Window via generic WASM loader
 */
export async function StartDoom(x = 100, y = 50): Promise<HWND> {
  const prevWindows = new Set(kernel.windows.map((w) => w.hwnd));
  await StartWasmApp(x, y, "/wasm/doom.wasm");
  const doomWin = kernel.windows.find((w) => !prevWindows.has(w.hwnd) && w.className === "DOOM95");
  return doomWin?.hwnd ?? (kernel.windows[kernel.windows.length - 1]?.hwnd || 0);
}
