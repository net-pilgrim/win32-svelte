import { Win32WasmRuntime } from "../win32/wasm_bridge";
import { getSampleAppWasmBytes } from "../wasm/sample_app_wasm";
import { kernel } from "../win32/kernel.svelte";

let wasmInstanceCount = 0;

export async function StartWasmApp(x?: number, y?: number): Promise<void> {
  const runtime = new Win32WasmRuntime();
  const wasmBytes = getSampleAppWasmBytes();

  const prevWindows = new Set(kernel.windows.map((w) => w.hwnd));

  await runtime.instantiate(wasmBytes);
  wasmInstanceCount++;
  runtime.runWinMain(wasmInstanceCount);

  // If initial coordinates were provided, update the created top-level window
  if (x !== undefined && y !== undefined) {
    const newWindows = kernel.windows.filter(
      (w) => !prevWindows.has(w.hwnd) && w.parentHwnd === null
    );
    for (const win of newWindows) {
      win.x = x;
      win.y = y;
    }
  }
}
