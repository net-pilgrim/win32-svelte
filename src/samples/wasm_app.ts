import { Win32WasmRuntime } from "../win32/wasm_bridge";
import { getSampleAppWasmBytes } from "../wasm/sample_app_wasm";
import { kernel, vfs, MessageBox } from "../win32/kernel.svelte";
import { MB_ICONERROR } from "../win32/constants";
import clockResources from "../resources/clock_rc";
import winemineResources from "../resources/winemine_rc";
import notepadResources from "../resources/notepad_rc";
import winecalcResources from "../resources/winecalc_rc";

let wasmInstanceCount = 0;

export async function StartWasmApp(
  x?: number,
  y?: number,
  pathOrVfsPath?: string,
  rawBytes?: Uint8Array
): Promise<void> {
  let bundle: any = undefined;
  if (pathOrVfsPath) {
    const lower = pathOrVfsPath.toLowerCase();
    if (lower.includes("calc")) bundle = winecalcResources;
    else if (lower.includes("notepad")) bundle = notepadResources;
    else if (lower.includes("mine")) bundle = winemineResources;
    else if (lower.includes("clock")) bundle = clockResources;
  }

  const runtime = new Win32WasmRuntime({
    initialX: x,
    initialY: y,
    initialWidth: 600,
    initialHeight: 450,
    resourceBundle: bundle,
  });
  let wasmBytes: Uint8Array | null = null;

  if (rawBytes) {
    wasmBytes = rawBytes;
  } else if (pathOrVfsPath) {
    if (pathOrVfsPath.startsWith("/") || pathOrVfsPath.startsWith("http")) {
      try {
        const resp = await fetch(pathOrVfsPath);
        if (!resp.ok) throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
        const contentType = resp.headers.get("content-type") || "";
        if (contentType.includes("text/html")) {
          throw new Error("Server returned HTML page instead of WebAssembly binary.");
        }
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
        // Fallback: check if the file exists in /wasm-demo/<basename>
        const fileName = pathOrVfsPath.split(/[\\/]/).pop();
        let fetched = false;
        if (fileName && typeof fetch !== "undefined") {
          try {
            const resp = await fetch(`/wasm-demo/${fileName}`);
            if (resp.ok) {
              const contentType = resp.headers.get("content-type") || "";
              if (!contentType.includes("text/html")) {
                const buf = await resp.arrayBuffer();
                wasmBytes = new Uint8Array(buf);
                fetched = true;
              }
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

  if (!wasmBytes || wasmBytes.length < 8) {
    MessageBox(
      null,
      `Cannot launch WebAssembly file:\n${pathOrVfsPath || "sample_app.wasm"}\n\nBinary is empty or truncated (${wasmBytes?.length || 0} bytes).`,
      "Invalid WASM Binary",
      MB_ICONERROR
    );
    return;
  }

  // Validate WASM magic word: 0x00, 0x61, 0x73, 0x6D ('\0asm')
  if (
    wasmBytes[0] !== 0x00 ||
    wasmBytes[1] !== 0x61 ||
    wasmBytes[2] !== 0x73 ||
    wasmBytes[3] !== 0x6d
  ) {
    MessageBox(
      null,
      `Cannot launch WebAssembly file:\n${pathOrVfsPath || "sample_app.wasm"}\n\nInvalid WASM magic header.\nExpected \\0asm (00 61 73 6d), but received:\n${Array.from(wasmBytes.slice(0, 4))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(" ")}`,
      "Invalid WASM Binary",
      MB_ICONERROR
    );
    return;
  }

  const prevWindows = new Set(kernel.windows.map((w) => w.hwnd));

  try {
    await Win32WasmRuntime.preloadEmfFiles();
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
