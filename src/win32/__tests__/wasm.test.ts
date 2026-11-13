import { kernel, SendMessage } from "../kernel.svelte";
import { Win32WasmRuntime } from "../wasm_bridge";
import { getSampleAppWasmBytes } from "../../wasm/sample_app_wasm";
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
  if (children.length < 4) {
    throw new Error(`Expected at least 4 child controls, got ${children.length}`);
  }

  const staticCtrl = children.find((c) => c.className === "STATIC");
  const btnMsgBox = children.find((c) => c.title === "Show C MessageBox");
  const btnCounter = children.find((c) => c.title?.startsWith("C Clicks:"));
  const btnRefresh = children.find((c) => c.title === "Invalidate GDI Canvas");

  if (!staticCtrl || !btnMsgBox || !btnCounter || !btnRefresh) {
    throw new Error("One or more expected child controls were not created");
  }
  console.log("✓ Found child controls: STATIC label and 3 BUTTON controls");

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

  console.log("\nALL WIN32 WASM BRIDGE TESTS PASSED! ⚡🎉");
}

runWasmTests().catch((err) => {
  console.error("WASM Test Failed:", err);
  process.exit(1);
});
