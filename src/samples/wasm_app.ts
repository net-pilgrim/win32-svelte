import { Win32WasmRuntime } from "../win32/wasm_bridge";
import { getSampleAppWasmBytes } from "../wasm/sample_app_wasm";
import { kernel, vfs } from "../win32/kernel.svelte";

let wasmInstanceCount = 0;

export async function StartWasmApp(
  x?: number,
  y?: number,
  vfsPath?: string
): Promise<void> {
  const runtime = new Win32WasmRuntime();
  let wasmBytes: Uint8Array;

  if (vfsPath) {
    try {
      wasmBytes = await vfs.readBinaryFile(vfsPath);
    } catch {
      wasmBytes = getSampleAppWasmBytes();
    }
  } else {
    wasmBytes = getSampleAppWasmBytes();
  }

  const prevWindows = new Set(kernel.windows.map((w) => w.hwnd));

  await runtime.instantiate(wasmBytes);
  wasmInstanceCount++;
  runtime.runWinMain(wasmInstanceCount);

  // Cascade offset for multiple instances so windows don't completely occlude each other
  const cascadeOffset = ((wasmInstanceCount - 1) % 8) * 24;
  const newWindows = kernel.windows.filter(
    (w) => !prevWindows.has(w.hwnd) && w.parentHwnd === null
  );
  for (const win of newWindows) {
    if (x !== undefined && y !== undefined) {
      win.x = x + (wasmInstanceCount > 1 ? cascadeOffset : 0);
      win.y = y + (wasmInstanceCount > 1 ? cascadeOffset : 0);
    } else if (cascadeOffset > 0) {
      win.x += cascadeOffset;
      win.y += cascadeOffset;
    }
  }
}
