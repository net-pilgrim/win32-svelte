import fs from "fs";
import assert from "node:assert";
import { Win32WasmRuntime } from "../wasm_bridge";
import { kernel, SendMessage } from "../kernel.svelte";
import winecalcResources from "../../resources/winecalc_rc";

async function testWineCalc() {
  console.log("=== Testing Wine Calculator in win32-svelte WASM Runtime ===");

  const wasmPath = "harness/build/Wine/calc.wasm";
  if (!fs.existsSync(wasmPath)) {
    throw new Error(`WASM binary not found at ${wasmPath}`);
  }

  const wasmBuf = fs.readFileSync(wasmPath);
  console.log(`Loaded ${wasmPath} (${wasmBuf.length} bytes)`);

  const runtime = new Win32WasmRuntime({ resourceBundle: winecalcResources });
  await runtime.instantiate(wasmBuf);
  console.log("✓ WebAssembly module successfully instantiated with Win32 imports");

  // Run WinMain
  runtime.runWinMain(5);
  console.log("✓ WinMain executed");

  // Check window in kernel
  const win = kernel.windows.find(
    (w) => w.className?.toLowerCase().includes("calc") || w.title?.toLowerCase().includes("calc")
  );
  assert(win, "Wine Calculator window was not created in kernel!");
  console.log(`✓ Calculator window created: HWND ${win.hwnd}, Title: '${win.title}', Class: '${win.className}', Size: ${win.width}x${win.height}`);

  // Verify menu was loaded and attached
  assert(win.hMenu || win.menuId, "Menu was not attached to Calculator window");
  console.log(`✓ Menu attached: Menu Handle ${win.hMenu ?? win.menuId}`);

  // Check child controls (buttons, display)
  const children = kernel.windows.filter((w) => w.parentHwnd === win.hwnd);
  console.log(`✓ Found ${children.length} child controls for calculator buttons/display`);

  // Verify resource bundle strings for buttons (not corrupted by winemine)
  const buttonTitles = children.map((c) => c.title);
  assert(buttonTitles.includes("Backspace"), "Expected 'Backspace' button in calculator");
  assert(buttonTitles.includes("CE"), "Expected 'CE' button in calculator");
  assert(buttonTitles.includes("C"), "Expected 'C' button in calculator");
  assert(!buttonTitles.includes("WineMine"), "Calculator buttons must not contain 'WineMine' resource string!");
  assert(!buttonTitles.includes("Nobody"), "Calculator buttons must not contain 'Nobody' resource string!");
  console.log("✓ Verified buttons correctly loaded 'Backspace', 'CE', 'C' from winecalc resource bundle");

  // Dispatch initial WM_PAINT
  console.log("Dispatching WM_PAINT to Calculator...");
  SendMessage(win.hwnd, 0x000f /* WM_PAINT */, 0, 0);
  console.log("✓ Dispatched WM_PAINT");

  // Switch to Scientific mode (IDM_MODE_SCIENTIFIC = 1004)
  console.log("Dispatching WM_COMMAND (IDM_MODE_SCIENTIFIC = 1004)...");
  SendMessage(win.hwnd, 0x0111 /* WM_COMMAND */, 1004, 0);
  console.log("✓ Switched to Scientific mode");

  // Switch back to Standard mode (IDM_MODE_STANDARD = 1003)
  console.log("Dispatching WM_COMMAND (IDM_MODE_STANDARD = 1003)...");
  SendMessage(win.hwnd, 0x0111 /* WM_COMMAND */, 1003, 0);
  console.log("✓ Switched back to Standard mode");

  // Verify menu after switching back to Standard mode is still Calculator's menu, NOT Clock
  const menuRecord = kernel.GetMenuRecord(win.hMenu!);
  assert(menuRecord, "Menu record not found for Calculator in Standard mode");
  const topMenuItems = menuRecord.items.map((i) => i.text);
  console.log(`✓ Standard mode menu items: ${JSON.stringify(topMenuItems)}`);
  assert(topMenuItems.includes("&Edit"), "Expected '&Edit' in Calculator Standard menu");
  assert(topMenuItems.includes("&View"), "Expected '&View' in Calculator Standard menu");
  assert(topMenuItems.includes("&Help"), "Expected '&Help' in Calculator Standard menu");
  assert(!topMenuItems.includes("&Properties"), "Calculator menu must NOT become Wine Clock '&Properties' menu!");
  assert(!topMenuItems.includes("&Info"), "Calculator menu must NOT become Wine Clock '&Info' menu!");

  // Dispatch About dialog (IDM_ABOUT = 1007)
  console.log("Dispatching WM_COMMAND (IDM_ABOUT = 1007)...");
  SendMessage(win.hwnd, 0x0111 /* WM_COMMAND */, 1007, 0);
  console.log("✓ Executed About command");

  // Close main window cleanly
  SendMessage(win.hwnd, 0x0010 /* WM_CLOSE */, 0, 0);
  console.log("✓ Calculator closed cleanly");

  console.log("\n🎉 ALL WINE CALCULATOR TESTS PASSED SUCCESSFULLY! 🧮✨\n");
}

testWineCalc().then(() => {
  process.exit(0);
}).catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
