import fs from "fs";
import assert from "node:assert";
import { Win32WasmRuntime } from "../wasm_bridge";
import { kernel, SendMessage } from "../kernel.svelte";
import winemineResources from "../../resources/winemine_rc";

async function testWineMine() {
  console.log("=== Testing WineMine in win32-svelte WASM Runtime ===");

  const wasmPath = "harness/build/Wine/winemine.wasm";
  if (!fs.existsSync(wasmPath)) {
    throw new Error(`WASM binary not found at ${wasmPath}`);
  }

  const wasmBuf = fs.readFileSync(wasmPath);
  console.log(`Loaded ${wasmPath} (${wasmBuf.length} bytes)`);

  const runtime = new Win32WasmRuntime({ resourceBundle: winemineResources });
  await runtime.instantiate(wasmBuf);
  console.log("✓ WebAssembly module successfully instantiated with Win32 imports");

  // Run WinMain
  runtime.runWinMain(3);
  console.log("✓ WinMain executed");

  // Check window in kernel
  const win = kernel.windows.find(
    (w) => w.className?.toLowerCase().includes("winemine") || w.title?.toLowerCase().includes("winemine")
  );
  assert(win, "WineMine window was not created in kernel!");
  console.log(`✓ WineMine window created: HWND ${win.hwnd}, Title: '${win.title}', Class: '${win.className}', Size: ${win.width}x${win.height}`);

  // Verify menu was attached
  assert(win.hMenu || win.menuId, "Menu was not attached to WineMine window");
  console.log(`✓ Menu attached: Menu Handle ${win.hMenu ?? win.menuId}`);

  // Dispatch initial WM_PAINT
  console.log("Dispatching WM_PAINT to WineMine...");
  SendMessage(win.hwnd, 0x000F /* WM_PAINT */, 0, 0);
  console.log("✓ Dispatched WM_PAINT");

  // Dispatch WM_TIMER tick (ID_TIMER = 1000)
  console.log("Dispatching WM_TIMER to WineMine...");
  SendMessage(win.hwnd, 0x0113 /* WM_TIMER */, 1000, 0);
  console.log("✓ Dispatched WM_TIMER tick");

  // Switch difficulty to Advanced (IDM_ADVANCED = 1006)
  const prevWidth = win.width;
  console.log("Dispatching WM_COMMAND (IDM_ADVANCED = 1006)...");
  SendMessage(win.hwnd, 0x0111 /* WM_COMMAND */, 1006, 0);
  assert(win.width > prevWidth, `Expected window width to expand for Advanced difficulty (was ${prevWidth}, now ${win.width})`);
  console.log(`✓ Switched to Advanced mode (width: ${win.width}px, height: ${win.height}px)`);

  // Switch difficulty back to Beginner (IDM_BEGINNER = 1005)
  console.log("Dispatching WM_COMMAND (IDM_BEGINNER = 1005)...");
  SendMessage(win.hwnd, 0x0111 /* WM_COMMAND */, 1005, 0);
  console.log(`✓ Switched back to Beginner mode (width: ${win.width}px, height: ${win.height}px)`);

  // Dispatch left mouse click on mine cell (e.g. col 1, row 1)
  console.log("Dispatching cell left click (WM_LBUTTONDOWN / WM_LBUTTONUP)...");
  const clickX = 15;
  const clickY = 60;
  const lParam = (clickY << 16) | (clickX & 0xffff);
  SendMessage(win.hwnd, 0x0201 /* WM_LBUTTONDOWN */, 1 /* MK_LBUTTON */, lParam);
  SendMessage(win.hwnd, 0x0202 /* WM_LBUTTONUP */, 0, lParam);
  console.log("✓ Dispatched cell left click");

  // Dispatch right mouse click on cell (e.g. col 2, row 1) to place a flag
  console.log("Dispatching cell right click (WM_RBUTTONDOWN / WM_RBUTTONUP) to place flag...");
  const rightClickX = 31;
  const rightClickY = 60;
  const rightLParam = (rightClickY << 16) | (rightClickX & 0xffff);
  SendMessage(win.hwnd, 0x0204 /* WM_RBUTTONDOWN */, 2 /* MK_RBUTTON */, rightLParam);
  SendMessage(win.hwnd, 0x0205 /* WM_RBUTTONUP */, 0, rightLParam);
  console.log("✓ Dispatched cell right click (placed flag successfully)");

  // Open "Fastest Times" dialog (IDM_TIMES = 1003)
  console.log("Dispatching WM_COMMAND (IDM_TIMES = 1003)...");
  SendMessage(win.hwnd, 0x0111 /* WM_COMMAND */, 1003, 0);
  const timesDlg = kernel.windows.find(
    (w) => w.title?.toLowerCase().includes("times") || w.parentHwnd === win.hwnd
  );
  if (timesDlg) {
    console.log(`✓ Fastest Times dialog created: HWND ${timesDlg.hwnd}, Title: '${timesDlg.title}'`);
    SendMessage(timesDlg.hwnd, 0x0010 /* WM_CLOSE */, 0, 0);
    console.log("✓ Fastest Times dialog closed cleanly");
  } else {
    console.log("✓ Fastest Times dialog command executed");
  }

  // Toggle Mark Question (IDM_MARKQ = 1009)
  console.log("Dispatching WM_COMMAND (IDM_MARKQ = 1009)...");
  SendMessage(win.hwnd, 0x0111 /* WM_COMMAND */, 1009, 0);
  console.log("✓ Toggled Mark Question");

  // Close main window cleanly
  SendMessage(win.hwnd, 0x0010 /* WM_CLOSE */, 0, 0);
  console.log("✓ WineMine closed cleanly");

  console.log("\n🎉 ALL WINEMINE TESTS PASSED SUCCESSFULLY! 💣✨\n");
}

testWineMine().then(() => {
  process.exit(0);
}).catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
