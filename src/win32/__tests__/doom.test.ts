import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Win32WasmRuntime } from "../wasm_bridge";
import { StartDoom } from "../../samples/doom";
import { kernel, SendMessage } from "../kernel.svelte";
import { WM_KEYDOWN, WM_KEYUP, WM_LBUTTONDOWN, WM_LBUTTONUP, WM_CLOSE } from "../constants";

async function runDoomTests() {
  console.log("Starting Win32 DOOM 95 Integration Tests (via Generic WASM Loader)...\n");

  const wasmPath = path.resolve(process.cwd(), "public/wasm/doom.wasm");
  assert.ok(fs.existsSync(wasmPath), "public/wasm/doom.wasm exists");
  const wasmBytes = fs.readFileSync(wasmPath);

  // Test 1: Instantiating Win32WasmRuntime with doom.wasm
  console.log("Test 1: Instantiating Win32WasmRuntime with doom.wasm...");
  const runtime = new Win32WasmRuntime();
  await runtime.instantiate(wasmBytes);
  console.log("✓ Win32WasmRuntime instantiated with js.* and env imports");

  // Test 2: Running runWinMain executes DOOM game loop
  console.log("Test 2: Executing runWinMain(1)...");
  runtime.runWinMain(1);

  const win = kernel.windows.find((w) => w.className === "DOOM95");
  assert.ok(win, "DOOM window found in kernel table");
  assert.equal(win.title, "DOOM 95");
  assert.equal(win.customProps?.hasCanvas, true, "Window has custom canvas flag");
  assert.equal(win.customProps?.canvasWidth, 640, "Canvas width set to 640");
  assert.equal(win.customProps?.canvasHeight, 400, "Canvas height set to 400");
  console.log("✓ DOOM window verified in kernel");

  // Test 3: Message handling (WM_KEYDOWN, WM_KEYUP, WM_LBUTTONDOWN, WM_LBUTTONUP)
  console.log("Test 3: Dispatching input messages to DOOM window...");
  SendMessage(win.hwnd, WM_KEYDOWN, 38, 0); // Up
  SendMessage(win.hwnd, WM_KEYUP, 38, 0);
  SendMessage(win.hwnd, WM_KEYDOWN, 89, 0); // Y key
  SendMessage(win.hwnd, WM_KEYUP, 89, 0);
  SendMessage(win.hwnd, WM_LBUTTONDOWN, 1, 0); // Fire
  SendMessage(win.hwnd, WM_LBUTTONUP, 0, 0);
  console.log("✓ Inputs dispatched cleanly to DOOM engine");

  // Test 4: Testing clean quit via handleGenericAppExit
  console.log("Test 4: Testing clean game quit handling...");
  runtime.handleGenericAppExit();
  const winAfterQuit = kernel.windows.find((w) => w.hwnd === win.hwnd);
  assert.equal(winAfterQuit, undefined, "Window successfully destroyed on game exit");
  console.log("✓ Game exit handled and window destroyed cleanly");

  // Test 5: Testing StartDoom via generic loader helper
  console.log("Test 5: Testing StartDoom(150, 80)...");
  const hwnd = await StartDoom(150, 80);
  assert.ok(hwnd > 0, "Valid HWND returned from StartDoom");
  const startedWin = kernel.windows.find((w) => w.hwnd === hwnd);
  assert.ok(startedWin, "StartDoom window found in kernel");

  // Close window
  SendMessage(hwnd, WM_CLOSE, 0, 0);
  const winAfterClose = kernel.windows.find((w) => w.hwnd === hwnd);
  assert.equal(winAfterClose, undefined, "Window destroyed on WM_CLOSE");
  console.log("✓ StartDoom window destroyed cleanly");

  console.log("\nALL DOOM 95 GENERIC LOADER TESTS PASSED! 💀🔥🎉\n");
  process.exit(0);
}

runDoomTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
