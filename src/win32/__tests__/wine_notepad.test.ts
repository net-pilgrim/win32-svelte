import fs from "fs";
import assert from "node:assert";
import { Win32WasmRuntime } from "../wasm_bridge";
import { kernel, SendMessage } from "../kernel.svelte";
import notepadResources from "../../resources/notepad_rc";

async function testWineNotepad() {
  console.log("=== Testing Wine Notepad in win32-svelte WASM Runtime ===");

  const wasmPath = "harness/build/Wine/notepad.wasm";
  if (!fs.existsSync(wasmPath)) {
    throw new Error(`WASM binary not found at ${wasmPath}`);
  }

  const wasmBuf = fs.readFileSync(wasmPath);
  console.log(`Loaded ${wasmPath} (${wasmBuf.length} bytes)`);

  const runtime = new Win32WasmRuntime({ resourceBundle: notepadResources });
  await runtime.instantiate(wasmBuf);
  console.log("✓ WebAssembly module successfully instantiated with Win32 imports");

  // Run WinMain
  runtime.runWinMain(4);
  console.log("✓ WinMain executed");

  // Check window in kernel
  const win = kernel.windows.find(
    (w) => w.className?.toLowerCase().includes("notepad") || w.title?.toLowerCase().includes("notepad")
  );
  assert(win, "Wine Notepad window was not created in kernel!");
  console.log(`✓ Notepad window created: HWND ${win.hwnd}, Title: '${win.title}', Class: '${win.className}', Size: ${win.width}x${win.height}`);

  // Verify menu was loaded and attached
  assert(win.hMenu || win.menuId, "Menu was not attached to Notepad window");
  console.log(`✓ Menu attached: Menu Handle ${win.hMenu ?? win.menuId}`);

  // Check that edit control child window was created
  const editChild = kernel.windows.find(
    (w) => w.parentHwnd === win.hwnd || w.className?.toLowerCase() === "edit"
  );
  if (editChild) {
    console.log(`✓ Edit control child created: HWND ${editChild.hwnd}, Class: '${editChild.className}'`);
  }

  // Dispatch WM_SIZE to Notepad window
  console.log("Dispatching WM_SIZE to Notepad...");
  const lParamSize = (400 << 16) | (600 & 0xffff);
  SendMessage(win.hwnd, 0x0005 /* WM_SIZE */, 0 /* SIZE_RESTORED */, lParamSize);
  console.log("✓ Dispatched WM_SIZE");

  // Dispatch WM_PAINT
  console.log("Dispatching WM_PAINT to Notepad...");
  SendMessage(win.hwnd, 0x000f /* WM_PAINT */, 0, 0);
  console.log("✓ Dispatched WM_PAINT");

  // Dispatch CMD_ABOUT (ID 0x110 / 272)
  console.log("Dispatching CMD_ABOUT command...");
  SendMessage(win.hwnd, 0x0111 /* WM_COMMAND */, 0x110, 0);
  console.log("✓ Dispatched CMD_ABOUT");

  // Close window cleanly
  SendMessage(win.hwnd, 0x0010 /* WM_CLOSE */, 0, 0);
  console.log("✓ Notepad closed cleanly");

  console.log("\n🎉 ALL WINE NOTEPAD TESTS PASSED SUCCESSFULLY! 📝✨\n");
}

testWineNotepad().then(() => {
  process.exit(0);
}).catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
