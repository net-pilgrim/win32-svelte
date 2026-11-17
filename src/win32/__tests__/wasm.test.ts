import * as fs from "node:fs";
import { kernel, SendMessage } from "../kernel.svelte";
import { Win32WasmRuntime } from "../wasm_bridge";
import { getSampleAppWasmBytes } from "../../wasm/sample_app_wasm";
import { StartWasmApp } from "../../samples/wasm_app";
import { StartHwndInspector } from "../../samples/hwnd_inspector";
import {
  WM_COMMAND,
  WM_TIMER,
  WM_NOTIFY,
  TCN_SELCHANGE,
  DT_CENTER,
  DT_VCENTER,
  DT_SINGLELINE,
  DT_CALCRECT,
  MB_ICONINFORMATION,
} from "../constants";

async function runWasmTests() {
  console.log("Starting Win32 C WebAssembly Bridge Tests...\n");

  const runtime = new Win32WasmRuntime();
  const wasmBytes = getSampleAppWasmBytes();

  // Test 1: Instantiation
  console.log("Test 1: Instantiating WASM module...");
  const instance = await runtime.instantiate(wasmBytes);
  if (!instance) throw new Error("Failed to instantiate WASM module");
  console.log("✓ WASM module successfully instantiated with Win32 imports");

  // Test 2: Execute WinMain
  console.log("Test 2: Executing WinMain()...");
  const result = runtime.runWinMain(42);
  if (result !== 0) throw new Error(`WinMain returned non-zero code: ${result}`);
  console.log("✓ WinMain executed successfully (exit code 0)");

  // Test 3: Verify created window
  console.log("Test 3: Verifying created window in kernel...");
  const wasmWin = kernel.windows.find(
    (w) => w.className === "WasmCWindowClass" && w.parentHwnd === null
  );
  if (!wasmWin) throw new Error("WasmCWindowClass window not found in kernel");
  if (wasmWin.title !== "WASM Win32 Native App (C99)") {
    throw new Error(`Unexpected window title: ${wasmWin.title}`);
  }
  console.log(`✓ Window found: HWND ${wasmWin.hwnd}, title: "${wasmWin.title}"`);

  // Test 4: Verify child controls
  console.log("Test 4: Verifying child controls created by C WM_CREATE...");
  const children = kernel.windows.filter((w) => w.parentHwnd === wasmWin.hwnd);
  if (children.length < 6) {
    throw new Error(`Expected at least 6 child controls, got ${children.length}`);
  }

  const staticCtrl = children.find((c) => c.className === "STATIC");
  const btnMsgBox = children.find((c) => c.title === "Show C MessageBox");
  const btnCounter = children.find((c) => c.title?.startsWith("C Clicks:"));
  const btnRefresh = children.find((c) => c.title === "Invalidate GDI Canvas");
  const btnViewC = children.find((c) => c.title?.includes("sample_app.c"));
  const btnViewH = children.find((c) => c.title?.includes("windows.h"));

  if (!staticCtrl || !btnMsgBox || !btnCounter || !btnRefresh || !btnViewC || !btnViewH) {
    throw new Error("One or more expected child controls were not created");
  }
  console.log("✓ Found child controls: STATIC label, interactive buttons, and source viewer buttons");

  // Test 5: Verify C state machine via WM_COMMAND
  console.log("Test 5: Testing C state updates via WM_COMMAND...");
  const IDC_BTN_COUNTER = 1002;
  SendMessage(wasmWin.hwnd, WM_COMMAND, IDC_BTN_COUNTER, 0);

  const updatedText1 = kernel.GetWindowText(btnCounter.hwnd);
  if (updatedText1 !== "C Clicks: 1") {
    throw new Error(`Expected "C Clicks: 1", got "${updatedText1}"`);
  }
  console.log(`✓ WM_COMMAND click 1 -> "${updatedText1}"`);

  SendMessage(wasmWin.hwnd, WM_COMMAND, IDC_BTN_COUNTER, 0);
  const updatedText2 = kernel.GetWindowText(btnCounter.hwnd);
  if (updatedText2 !== "C Clicks: 2") {
    throw new Error(`Expected "C Clicks: 2", got "${updatedText2}"`);
  }
  console.log(`✓ WM_COMMAND click 2 -> "${updatedText2}"`);

  // Test 6: Verify ShellExecute source viewer trigger
  console.log("Test 6: Testing ShellExecute source view via C WM_COMMAND...");
  const IDC_BTN_VIEW_C = 1005;
  SendMessage(wasmWin.hwnd, WM_COMMAND, IDC_BTN_VIEW_C, 0);
  const notepadWin = kernel.windows.find(
    (w) => w.className === "Win32Notepad" && w.title?.includes("sample_app.c")
  );
  if (!notepadWin) {
    throw new Error("Notepad window with sample_app.c was not opened by ShellExecute");
  }
  console.log(`✓ Notepad opened via C ShellExecute: HWND ${notepadWin.hwnd}, title: "${notepadWin.title}"`);

  // Test 7: Verify launching .wasm file directly via VFS path
  console.log("Test 7: Testing StartWasmApp with direct VFS path...");
  await StartWasmApp(320, 150, "C:\\wasm_application\\sample_app.wasm");
  const newWasmWins = kernel.windows.filter(
    (w) => w.className === "WasmCWindowClass" && w.parentHwnd === null
  );
  if (newWasmWins.length < 2) {
    throw new Error("Failed to launch second WASM application from VFS path");
  }
  const launchedWin = newWasmWins[newWasmWins.length - 1];
  if (launchedWin.x !== 320 || launchedWin.y !== 150) {
    throw new Error(`Expected window coordinates (320, 150), got (${launchedWin.x}, ${launchedWin.y})`);
  }
  console.log(`✓ Launched WASM application from VFS path: HWND ${launchedWin.hwnd} at (${launchedWin.x}, ${launchedWin.y})`);

  // Test 8: Verify Step 1 APIs (GetClientRect, FillRect, DrawTextA, MessageBeep)
  console.log("Test 8: Testing Step 1 Petzold GDI & Layout APIs...");
  const imports: any = runtime.getImportObject().win32;

  // Test MessageBeep
  const beepRes = imports.MessageBeep(MB_ICONINFORMATION);
  if (beepRes !== 1) throw new Error("MessageBeep failed");
  console.log("✓ MessageBeep bridged cleanly");

  // Allocate 32 bytes in WASM memory for RECT testing
  const mem = (instance.exports.memory as WebAssembly.Memory).buffer;
  const testPtr = 1024;
  const testRectPtr = testPtr + 100;

  // Test GetClientRect
  const clientRes = imports.GetClientRect(wasmWin.hwnd, testRectPtr);
  if (clientRes !== 1) throw new Error("GetClientRect failed");
  const rectView = new DataView(mem);
  const left = rectView.getInt32(testRectPtr, true);
  const top = rectView.getInt32(testRectPtr + 4, true);
  const right = rectView.getInt32(testRectPtr + 8, true);
  const bottom = rectView.getInt32(testRectPtr + 12, true);
  if (left !== 0 || top !== 0 || right !== wasmWin.width || bottom !== wasmWin.height) {
    throw new Error(`GetClientRect invalid: ${left},${top},${right},${bottom}`);
  }
  console.log(`✓ GetClientRect returned rect {0, 0, ${right}, ${bottom}} matching window dimensions`);

  // Test DrawTextA with DT_CALCRECT
  const strPtr = testPtr + 200;
  runtime.writeCString(strPtr, "Antigravity Win32 WASM Engine", 64);
  const dtCalcRes = imports.DrawTextA(
    0, // hdc not needed for CALCRECT
    strPtr,
    -1,
    testRectPtr,
    DT_CALCRECT
  );
  if (dtCalcRes <= 0) throw new Error("DrawTextA CALCRECT failed");
  const calcBottom = rectView.getInt32(testRectPtr + 12, true);
  if (calcBottom <= top) throw new Error("DrawTextA did not calculate valid bottom coordinate");
  console.log(`✓ DrawTextA calculated text bounds height: ${dtCalcRes}px`);

  // Test 9: Verify Step 2 real-time animation timer ticks
  console.log("Test 9: Testing Step 2 procedural animation timer ticks...");
  SendMessage(wasmWin.hwnd, WM_TIMER, 1, 0);
  SendMessage(wasmWin.hwnd, WM_TIMER, 1, 0);
  SendMessage(wasmWin.hwnd, WM_TIMER, 1, 0);
  console.log("✓ Dispatched procedural animation WM_TIMER ticks cleanly");

  // Test 10: Verify Step 3 WASM Runtime Introspection & Stats
  console.log("Test 10: Verifying Step 3 WASM runtime diagnostics & stats...");
  const stats = runtime.getStats();
  if (stats.memorySizeBytes < 65536) {
    throw new Error(`Expected at least 1 memory page (65536 bytes), got ${stats.memorySizeBytes}`);
  }
  if (stats.memoryPages < 1) {
    throw new Error(`Expected at least 1 memory page, got ${stats.memoryPages}`);
  }
  if (stats.tableLength < 1) {
    throw new Error(`Expected indirect table length >= 1, got ${stats.tableLength}`);
  }
  const callableTableEntry = stats.tableEntries.find((e) => e.isCallable);
  if (!callableTableEntry) {
    throw new Error("No callable exports found in indirect function table");
  }
  if (stats.stringLogs.length === 0) {
    throw new Error("String marshaling log is empty");
  }
  if (stats.registeredWndProcIndices.length === 0) {
    throw new Error("No registered WndProc indices recorded");
  }
  console.log(`✓ Linear memory: ${stats.memorySizeBytes} bytes (${stats.memoryPages} pages)`);
  console.log(`✓ Indirect table: ${stats.tableLength} slots (${callableTableEntry.index} is callable)`);
  console.log(`✓ String logs: ${stats.stringLogs.length} operations recorded`);
  console.log(`✓ Registered C WndProc slots: [${stats.registeredWndProcIndices.join(", ")}]`);

  // Test 11: Verify HWND & WASM Inspector tabs
  console.log("Test 11: Verifying HWND & WASM Inspector diagnostics tab...");
  const inspectorHwnd = StartHwndInspector(500, 110);
  if (!inspectorHwnd) throw new Error("Failed to start HWND & WASM Inspector");

  const inspectorChildren = kernel.windows.filter((w) => w.parentHwnd === inspectorHwnd);
  const tabCtrl = inspectorChildren.find((c) => c.className === "SysTabControl32");
  const wasmSummary = inspectorChildren.find((c) => c.className === "STATIC");
  const wasmLogs = inspectorChildren.find((c) => c.className === "EDIT");

  if (!tabCtrl || !wasmSummary || !wasmLogs) {
    throw new Error("Inspector controls (Tab, Static summary, Edit logs) not found");
  }

  // Switch to Tab 1 (WASM Diagnostics) via TCN_SELCHANGE notification
  SendMessage(inspectorHwnd, WM_NOTIFY, tabCtrl.hwnd, {
    hwndFrom: tabCtrl.hwnd,
    idFrom: 9000,
    code: TCN_SELCHANGE,
    tabIndex: 1,
  });

  const summaryText = kernel.GetWindowText(wasmSummary.hwnd);
  if (!summaryText.includes("Active WASM Runtimes") || !summaryText.includes("Linear Memory")) {
    throw new Error(`Unexpected inspector summary text: "${summaryText}"`);
  }
  console.log(`✓ Inspector switched to WASM tab and displayed live memory/table diagnostics`);

  // Test 12: Verifying standalone C example app build (examples/simple_c_app/simple_app.wasm)
  const exampleWasmPath = "examples/simple_c_app/simple_app.wasm";
  if (fs.existsSync(exampleWasmPath)) {
    console.log("Test 12: Verifying standalone C example app (simple_app.wasm)...");
    const exampleBytes = fs.readFileSync(exampleWasmPath);
    const exampleRuntime = new Win32WasmRuntime();
    await exampleRuntime.instantiate(exampleBytes);
    const code = exampleRuntime.runWinMain();
    if (code !== 0) throw new Error(`simple_app WinMain returned ${code}`);
    const exampleWin = kernel.windows.find(
      (w) => w.className === "SimpleCWasmWindowClass" && w.parentHwnd === null
    );
    if (!exampleWin) throw new Error("SimpleCWasmWindowClass window not found");
    const exampleChildren = kernel.windows.filter((w) => w.parentHwnd === exampleWin.hwnd);
    const btnClicks = exampleChildren.find((c) => c.title?.startsWith("Clicks:"));
    if (!btnClicks) throw new Error("Click button in simple_app not found");
    SendMessage(exampleWin.hwnd, WM_COMMAND, 102, 0);
    const updatedClicks = kernel.GetWindowText(btnClicks.hwnd);
    if (updatedClicks !== "Clicks: 1") {
      throw new Error(`Expected "Clicks: 1", got "${updatedClicks}"`);
    }
    console.log(`✓ Standalone simple_c_app verified: HWND ${exampleWin.hwnd}, state updated to "${updatedClicks}"`);
  }

  // Test 13: Verifying standalone C++ MFC WebAssembly app (examples/mfc_wasm_app/mfc_app.wasm)
  const mfcWasmPath = "examples/mfc_wasm_app/mfc_app.wasm";
  if (fs.existsSync(mfcWasmPath)) {
    console.log("Test 13: Verifying standalone C++ MFC app (mfc_app.wasm)...");
    const mfcBytes = fs.readFileSync(mfcWasmPath);
    const mfcRuntime = new Win32WasmRuntime();
    await mfcRuntime.instantiate(mfcBytes);
    const code = mfcRuntime.runWinMain();
    if (code !== 0) throw new Error(`mfc_app WinMain returned ${code}`);
    const mfcWin = kernel.windows.find(
      (w) => w.className === "MfcWasmWindowClass" && w.parentHwnd === null
    );
    if (!mfcWin) throw new Error("MfcWasmWindowClass window not found");
    const mfcChildren = kernel.windows.filter((w) => w.parentHwnd === mfcWin.hwnd);
    const btnClicks = mfcChildren.find((c) => c.title?.startsWith("C++ Clicks:"));
    if (!btnClicks) throw new Error("Click button in mfc_app not found");
    SendMessage(mfcWin.hwnd, WM_COMMAND, 1001, 0);
    const updatedClicks = kernel.GetWindowText(btnClicks.hwnd);
    if (updatedClicks !== "C++ Clicks: 1") {
      throw new Error(`Expected "C++ Clicks: 1", got "${updatedClicks}"`);
    }
    console.log(`✓ Standalone C++ MFC app verified: HWND ${mfcWin.hwnd}, state updated to "${updatedClicks}"`);
  }

  console.log("\nALL WIN32 WASM BRIDGE TESTS (STEPS 1-3) PASSED! ⚡🎉");
  process.exit(0);
}

runWasmTests().catch((err) => {
  console.error("WASM Test Failed:", err);
  process.exit(1);
});
