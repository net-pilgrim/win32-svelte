import { Win32WasmRuntime } from "../win32/wasm_bridge";
import { getSampleAppWasmBytes } from "../wasm/sample_app_wasm";
import { kernel, vfs, MessageBox } from "../win32/kernel.svelte";
import { MB_ICONERROR } from "../win32/constants";

let wasmInstanceCount = 0;

export async function StartWasmApp(
  x?: number,
  y?: number,
  pathOrVfsPath?: string,
  rawBytes?: Uint8Array
): Promise<void> {
  const runtime = new Win32WasmRuntime();
  let wasmBytes: Uint8Array | null = null;

  if (rawBytes) {
    wasmBytes = rawBytes;
  } else if (pathOrVfsPath) {
    if (pathOrVfsPath.startsWith("/") || pathOrVfsPath.startsWith("http")) {
      try {
        const resp = await fetch(pathOrVfsPath);
        if (!resp.ok) throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
        const buf = await resp.arrayBuffer();
        wasmBytes = new Uint8Array(buf);
      } catch (err: any) {
        console.error(`Failed to fetch WASM file at "${pathOrVfsPath}":`, err);
        MessageBox(
          null,
          `Cannot load WebAssembly file:\n${pathOrVfsPath}\n\nTo test locally, run:\nnpm run sync:wasm\n(or 'make -C harness copy-wasm-files')`,
          "WASM File Not Found",
          MB_ICONERROR
        );
        return;
      }
    } else {
      try {
        wasmBytes = await vfs.readBinaryFile(pathOrVfsPath);
      } catch (err: any) {
        // Fallback: check if the file exists in /wasm-files/<basename>
        const fileName = pathOrVfsPath.split(/[\\/]/).pop();
        let fetched = false;
        if (fileName && typeof fetch !== "undefined") {
          try {
            const resp = await fetch(`/wasm-files/${fileName}`);
            if (resp.ok) {
              const buf = await resp.arrayBuffer();
              wasmBytes = new Uint8Array(buf);
              fetched = true;
            }
          } catch {
            // ignore fetch error and report original error
          }
        }
        if (!fetched) {
          console.error(`Failed to read WASM file at "${pathOrVfsPath}":`, err);
          MessageBox(
            null,
            `Cannot open WebAssembly file:\n${pathOrVfsPath}\n\nTo test locally, run:\nnpm run sync:wasm\n(or 'make -C harness copy-wasm-files')`,
            "Error Opening WASM File",
            MB_ICONERROR
          );
          return;
        }
      }
    }
  } else {
    wasmBytes = getSampleAppWasmBytes();
  }

  if (!wasmBytes) return;

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
