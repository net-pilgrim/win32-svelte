import fs from "fs";
import assert from "node:assert";
import { Win32WasmRuntime } from "../wasm_bridge";
import { kernel, SendMessage } from "../kernel.svelte";
import clockResources from "../../resources/clock_rc";

async function testWineClock() {
  console.log("=== Testing Wine Clock in win32-svelte WASM Runtime ===");

  const wasmPath = "harness/build/Wine/clock.wasm";
  if (!fs.existsSync(wasmPath)) {
    throw new Error(`WASM binary not found at ${wasmPath}`);
  }

  const wasmBuf = fs.readFileSync(wasmPath);
  console.log(`Loaded ${wasmPath} (${wasmBuf.length} bytes)`);

  const runtime = new Win32WasmRuntime({ resourceBundle: clockResources });
  await runtime.instantiate(wasmBuf);
  console.log("✓ WebAssembly module successfully instantiated with Win32 imports");

  // Run WinMain
  runtime.runWinMain(2);
  console.log("✓ WinMain executed");

  // Check window in kernel
  const win = kernel.windows.find(
    (w) => w.className === "CLClass" || w.title?.toLowerCase().includes("clock")
  );
  assert(win, "Wine Clock window was not created in kernel!");
  console.log(`✓ Clock window created: HWND ${win.hwnd}, Title: '${win.title}', Class: '${win.className}'`);

  // Verify menu was loaded and attached
  assert(win.hMenu || win.menuId, "Menu was not attached to Clock window");
  console.log(`✓ Menu attached: Menu Handle ${win.hMenu ?? win.menuId}`);

  // Dispatch WM_TIMER tick (TIMER_ID = 1)
  console.log("Dispatching WM_TIMER to Clock...");
  SendMessage(win.hwnd, 0x0113 /* WM_TIMER */, 1, 0);
  console.log("✓ Dispatched WM_TIMER tick");

  // Dispatch switch to Digital clock (IDM_DIGITAL = 258)
  console.log("Dispatching WM_COMMAND (IDM_DIGITAL = 258)...");
  SendMessage(win.hwnd, 0x0111 /* WM_COMMAND */, 258, 0);
  console.log("✓ Switched to Digital mode");

  // Dispatch switch back to Analog clock (IDM_ANALOG = 257)
  console.log("Dispatching WM_COMMAND (IDM_ANALOG = 257)...");
  SendMessage(win.hwnd, 0x0111 /* WM_COMMAND */, 257, 0);
  console.log("✓ Switched to Analog mode");

  // Dispatch toggle date in title (IDM_DATE = 262)
  console.log("Dispatching WM_COMMAND (IDM_DATE = 262)...");
  SendMessage(win.hwnd, 0x0111 /* WM_COMMAND */, 262, 0);
  if (!win.title || !win.title.includes(" - Clock")) {
    throw new Error(`Expected date in window title, got: ${win.title}`);
  }
  console.log("✓ Date displayed in title:", win.title);

  // Close window cleanly
  SendMessage(win.hwnd, 0x0010 /* WM_CLOSE */, 0, 0);
  console.log("✓ Clock closed cleanly");

  console.log("\n🎉 ALL WINE CLOCK TESTS PASSED SUCCESSFULLY! ⏰✨\n");
}

testWineClock().then(() => {
  process.exit(0);
}).catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
