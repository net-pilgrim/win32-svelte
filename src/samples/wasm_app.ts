import { Win32WasmRuntime } from "../win32/wasm_bridge";
import { getSampleAppWasmBytes } from "../wasm/sample_app_wasm";
import { kernel, vfs, MessageBox } from "../win32/kernel.svelte";
import { MB_ICONERROR } from "../win32/constants";

let wasmInstanceCount = 0;

export async function StartWasmApp(
  x?: number,
  y?: number,
  vfsPath?: string,
  rawBytes?: Uint8Array
): Promise<void> {
  const runtime = new Win32WasmRuntime();
  let wasmBytes: Uint8Array;

  if (rawBytes) {
    wasmBytes = rawBytes;
  } else if (vfsPath) {
    try {
      wasmBytes = await vfs.readBinaryFile(vfsPath);
    } catch (err: any) {
      console.error(`Failed to read WASM file at "${vfsPath}":`, err);
      MessageBox(
        null,
        `Cannot open WebAssembly file:\n${vfsPath}\n\n${err?.message || err}`,
        "Error Opening WASM File",
        MB_ICONERROR
      );
      return;
    }
  } else {
    wasmBytes = getSampleAppWasmBytes();
  }

  const prevWindows = new Set(kernel.windows.map((w) => w.hwnd));

  try {
    await runtime.instantiate(wasmBytes);
    wasmInstanceCount++;
    runtime.runWinMain(wasmInstanceCount);
  } catch (err: any) {
    console.error("Failed to instantiate or run WASM application:", err);
    MessageBox(
      null,
      `WebAssembly runtime error:\n\n${err?.message || err}`,
      "WASM Execution Error",
      MB_ICONERROR
    );
    return;
  }

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
