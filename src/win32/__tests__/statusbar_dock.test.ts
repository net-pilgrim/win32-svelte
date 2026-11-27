import fs from "fs";
import assert from "node:assert";
import { Win32WasmRuntime } from "../wasm_bridge";
import { kernel, SendMessage } from "../kernel.svelte";
import notepadResources from "../../resources/notepad_rc";
import { STATUSCLASSNAME } from "../constants";

const WM_SIZE = 0x0005;
const STATUSBAR_HEIGHT = 20;

async function runStatusbarDockTests() {
  console.log("Starting Status Bar Docking Tests...\n");

  console.log("Test 1: STATUSCLASSNAME wndproc docks to parent bottom on WM_SIZE...");
  const parentHwnd = kernel.CreateWindowEx(
    0,
    "STATIC",
    "",
    0,
    10,
    10,
    400,
    300,
    null,
    null,
    null,
    null
  );
  assert(parentHwnd, "parent window was not created");
  const statusHwnd = kernel.CreateWindowEx(
    0,
    STATUSCLASSNAME,
    "",
    0x40000000 | 0x10000000 /* WS_CHILD | WS_VISIBLE */,
    0,
    0,
    0,
    0,
    parentHwnd,
    null,
    null,
    null
  );
  assert(statusHwnd, "status bar child was not created");
  SendMessage(parentHwnd, WM_SIZE, 0, (280 << 16) | (380 & 0xffff));
  const parent = kernel.getWindow(parentHwnd);
  const status = kernel.getWindow(statusHwnd);
  assert(parent, "parent window record missing");
  assert(status, "status bar window record missing");
  assert.strictEqual(status.y, parent.height - STATUSBAR_HEIGHT, "status bar must dock to parent bottom");
  assert.strictEqual(status.height, STATUSBAR_HEIGHT);
  assert.strictEqual(status.width, parent.width);
  assert.strictEqual(status.x, 0);
  console.log(
    `\u2713 status bar docked: y=${status.y}, height=${status.height}, width=${status.width} (parent ${parent.width}x${parent.height})`
  );

  console.log("\nTest 2: Wine notepad.wasm lays out edit above docked status bar...");
  const wasmPath = "public/wasm-demo/notepad.wasm";
  if (!fs.existsSync(wasmPath)) {
    throw new Error(`WASM binary not found at ${wasmPath}`);
  }
  const wasmBuf = fs.readFileSync(wasmPath);
  const runtime = new Win32WasmRuntime({ resourceBundle: notepadResources });
  const instance = await runtime.instantiate(wasmBuf);
  assert(instance, "notepad.wasm failed to instantiate");
  runtime.runWinMain(4);

  const mainWin = kernel.windows.find(
    (w) =>
      w.parentHwnd === null &&
      (w.className?.toLowerCase().includes("notepad") || w.title?.toLowerCase().includes("notepad"))
  );
  assert(mainWin, "Wine Notepad main window was not created");

  SendMessage(mainWin.hwnd, WM_SIZE, 0, (400 << 16) | (600 & 0xffff));

  const statusbar = kernel.windows.find(
    (w) => w.parentHwnd === mainWin.hwnd && w.className?.toUpperCase().includes("STATUS")
  );
  assert(statusbar, "notepad did not create a status bar child");
  assert.strictEqual(
    statusbar.y,
    mainWin.height - STATUSBAR_HEIGHT,
    `status bar y (${statusbar.y}) must equal parent height - ${STATUSBAR_HEIGHT} (${mainWin.height - STATUSBAR_HEIGHT})`
  );
  assert.strictEqual(statusbar.height, STATUSBAR_HEIGHT);
  console.log(
    `\u2713 status bar docked at y=${statusbar.y} in ${mainWin.width}x${mainWin.height} window, text '${kernel.GetWindowText(statusbar.hwnd)}'`
  );

  const editChild = kernel.windows.find(
    (w) => w.parentHwnd === mainWin.hwnd && w.className?.toLowerCase() === "edit"
  );
  if (editChild) {
    assert(
      editChild.y + editChild.height <= statusbar.y,
      `edit control (y=${editChild.y}, h=${editChild.height}) must sit above the status bar (y=${statusbar.y})`
    );
    console.log(`\u2713 edit control ends at y=${editChild.y + editChild.height}, status bar starts at y=${statusbar.y}`);
  }

  console.log("\nALL STATUS BAR DOCKING TESTS PASSED! \ud83d\udcca\ud83c\udf89");
  process.exit(0);
}

runStatusbarDockTests().catch((e) => {
  console.error(e);
  process.exit(1);
});
