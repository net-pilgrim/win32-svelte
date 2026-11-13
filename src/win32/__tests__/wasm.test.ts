import { kernel, SendMessage } from "../kernel.svelte";
import { Win32WasmRuntime } from "../wasm_bridge";
import { getSampleAppWasmBytes } from "../../wasm/sample_app_wasm";
import { StartWasmApp } from "../../samples/wasm_app";
import { WM_COMMAND } from "../constants";

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
  const initialWinCount = kernel.windows.length;
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

  console.log("\nALL WIN32 WASM BRIDGE TESTS PASSED! ⚡🎉");
}

runWasmTests().catch((err) => {
  console.error("WASM Test Failed:", err);
  process.exit(1);
});
