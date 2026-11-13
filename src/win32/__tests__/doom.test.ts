import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { DoomRuntime } from "../doom_runtime";
import { StartDoom } from "../../samples/doom";
import { kernel, SendMessage, DestroyWindow } from "../kernel.svelte";
import { WM_KEYDOWN, WM_KEYUP, WM_LBUTTONDOWN, WM_LBUTTONUP, WM_CLOSE } from "../constants";

async function runDoomTests() {
  console.log("Starting Win32 DOOM 95 Integration Tests...\n");

  // Test 1: Verify keycode mapping
  console.log("Test 1: Keycode mapping...");
  const runtime = new DoomRuntime();
  assert.equal(runtime.mapKeyCode(37), 172, "Left arrow maps to 172");
  assert.equal(runtime.mapKeyCode(38), 173, "Up arrow maps to 173");
  assert.equal(runtime.mapKeyCode(39), 174, "Right arrow maps to 174");
  assert.equal(runtime.mapKeyCode(40), 175, "Down arrow maps to 175");
  assert.equal(runtime.mapKeyCode(17), 157, "Ctrl maps to 157 (fire)");
  assert.equal(runtime.mapKeyCode(32), 32, "Space maps to 32 (open/use)");
  assert.equal(runtime.mapKeyCode(87), 173, "W maps to up arrow (forward)");
  assert.equal(runtime.mapKeyCode(83), 175, "S maps to down arrow (backward)");
  assert.equal(runtime.mapKeyCode(65), 172, "A maps to left arrow");
  assert.equal(runtime.mapKeyCode(68), 174, "D maps to right arrow");
  assert.equal(runtime.mapKeyCode(69), 32, "E maps to space (use/open)");
  console.log("✓ Keycode mappings verified");

  // Test 2: Instantiating DoomRuntime with local wasm file
  console.log("Test 2: Instantiating DoomRuntime with local doom.wasm...");
  const wasmPath = path.resolve(process.cwd(), "public/wasm/doom.wasm");
  assert.ok(fs.existsSync(wasmPath), "public/wasm/doom.wasm exists");
  const wasmBytes = fs.readFileSync(wasmPath);

  let frameDrawn = false;
  const testRuntime = new DoomRuntime({
    wasmBytes,
    onFrame: (screen) => {
      frameDrawn = true;
      assert.equal(screen.length, 640 * 400 * 4, "Screen buffer size is 640x400x4");
    },
  });

  await testRuntime.init();
  console.log("✓ DoomRuntime initialized and called main()");

  // Test 3: Executing doom_loop_step()
  console.log("Test 3: Executing doom_loop_step()...");
  for (let i = 0; i < 10; i++) {
    testRuntime.step();
  }
  console.log("✓ Executed 10 steps without errors");

  // Test 4: Testing key inputs
  console.log("Test 4: Sending keyboard events...");
  testRuntime.sendKey(0, 38); // Arrow Up down
  testRuntime.step();
  testRuntime.sendKey(1, 38); // Arrow Up up
  testRuntime.step();
  testRuntime.sendKey(0, 17); // Ctrl (fire)
  testRuntime.step();
  testRuntime.sendKey(1, 17); // Ctrl up
  testRuntime.step();
  console.log("✓ Key events processed cleanly");

  // Test 5: Launching StartDoom Win32 Window
  console.log("Test 5: Launching StartDoom window...");
  const hwnd = await StartDoom(150, 80);
  assert.ok(hwnd > 0, "Valid HWND returned");

  const win = kernel.windows.find((w) => w.hwnd === hwnd);
  assert.ok(win, "Window found in kernel table");
  assert.equal(win.className, "DOOM95");
  assert.equal(win.title, "DOOM 95 (WASM Win32 Subsystem)");
  assert.equal(win.customProps?.hasCanvas, true, "Window has custom canvas flag");
  assert.equal(win.customProps?.canvasWidth, 640, "Canvas width set to 640");
  assert.equal(win.customProps?.canvasHeight, 400, "Canvas height set to 400");
  console.log("✓ DOOM window verified in kernel");

  // Test 6: Message handling (WM_KEYDOWN, WM_LBUTTONDOWN, WM_CLOSE)
  console.log("Test 6: Window message dispatching...");
  SendMessage(hwnd, WM_KEYDOWN, 38, 0);
  SendMessage(hwnd, WM_KEYUP, 38, 0);
  SendMessage(hwnd, WM_LBUTTONDOWN, 1, 0);
  SendMessage(hwnd, WM_LBUTTONUP, 0, 0);
  console.log("✓ Messages dispatched to WndProc");

  // Close window
  SendMessage(hwnd, WM_CLOSE, 0, 0);
  const winAfterClose = kernel.windows.find((w) => w.hwnd === hwnd);
  assert.equal(winAfterClose, undefined, "Window successfully destroyed on WM_CLOSE");
  console.log("✓ Window destroyed cleanly");

  console.log("\nALL DOOM 95 INTEGRATION TESTS PASSED! 💀🔥🎉\n");
}

runDoomTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
