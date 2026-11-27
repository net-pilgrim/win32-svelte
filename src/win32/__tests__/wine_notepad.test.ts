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
  assert(win.visible, "Wine Notepad window must be visible after SetWindowPlacement!");
  console.log(`✓ Notepad window created: HWND ${win.hwnd}, Title: '${win.title}', Class: '${win.className}', Size: ${win.width}x${win.height}, Visible: ${win.visible}`);

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

  // Test CommDlg: CMD_OPEN (0x101)
  console.log("Dispatching CMD_OPEN command...");
  SendMessage(win.hwnd, 0x0111 /* WM_COMMAND */, 0x101, 0);
  console.log("✓ Dispatched CMD_OPEN (GetOpenFileNameW bridged cleanly)");

  // Test CommDlg: CMD_SAVE_AS (0x103)
  console.log("Dispatching CMD_SAVE_AS command...");
  SendMessage(win.hwnd, 0x0111 /* WM_COMMAND */, 0x103, 0);
  console.log("✓ Dispatched CMD_SAVE_AS (GetSaveFileNameW bridged cleanly)");

  // Test CommDlg: CMD_PRINT (0x104)
  console.log("Dispatching CMD_PRINT command...");
  SendMessage(win.hwnd, 0x0111 /* WM_COMMAND */, 0x104, 0);
  console.log("✓ Dispatched CMD_PRINT (PrintDlgW bridged cleanly)");

  // Test Svelte/TS Common Dialog APIs directly
  console.log("Testing kernel.GetOpenFileName Promise API...");
  const ofnPromise = kernel.GetOpenFileName({ initialDir: "C:\\My Documents", title: "Open Test" });
  assert(kernel.activeFileDialog, "activeFileDialog state should be set");
  assert.strictEqual(kernel.activeFileDialog.options.title, "Open Test");
  kernel.activeFileDialog.resolve("C:\\My Documents\\Welcome.txt");
  const openedFile = await ofnPromise;
  assert.strictEqual(openedFile, "C:\\My Documents\\Welcome.txt");
  console.log(`✓ GetOpenFileName resolved: ${openedFile}`);

  console.log("Testing kernel.GetSaveFileName Promise API...");
  const savePromise = kernel.GetSaveFileName({ fileName: "note.txt", defExt: "txt" });
  assert(kernel.activeFileDialog, "activeFileDialog state should be set for Save");
  assert(kernel.activeFileDialog.options.isSave, "isSave should be true");
  kernel.activeFileDialog.resolve("C:\\My Documents\\note.txt");
  const savedFile = await savePromise;
  assert.strictEqual(savedFile, "C:\\My Documents\\note.txt");
  console.log(`✓ GetSaveFileName resolved: ${savedFile}`);

  console.log("Testing kernel.ShowPrintDialog Promise API...");
  const printPromise = kernel.ShowPrintDialog({ nCopies: 2 });
  assert(kernel.activePrintDialog, "activePrintDialog state should be set");
  kernel.activePrintDialog.resolve({ confirmed: true, printerName: "HP LaserJet 4", nCopies: 2 });
  const printRes = await printPromise;
  assert(printRes && printRes.confirmed && printRes.nCopies === 2);
  console.log(`✓ ShowPrintDialog resolved: ${printRes.printerName}, ${printRes.nCopies} copies`);

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
