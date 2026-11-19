import assert from "node:assert/strict";
import { kernel, SendMessage, SetTimer, KillTimer, DestroyWindow } from "../kernel.svelte";
import { StartMinesweeper } from "../../samples/minesweeper";
import { StartHwndInspector } from "../../samples/hwnd_inspector";
import { WM_CLOSE } from "../constants";

async function runTests() {
  console.log("Starting Window Lifecycle & Resource Leak Tests...\n");

  // Test 1: Timer isolation by window handle
  console.log("Test 1: Multiple windows using identical timer ID...");
  const timer1 = SetTimer(201, 1, 100);
  const timer2 = SetTimer(202, 1, 100);
  assert.equal(timer1, 1);
  assert.equal(timer2, 1);
  assert.equal(KillTimer(201, 1), true, "Window 201 timer 1 killed successfully");
  assert.equal(KillTimer(202, 1), true, "Window 202 timer 1 killed successfully");
  console.log("✓ Timer handles isolated per-HWND without collisions");

  // Test 2: DestroyWindow cleans up active timers and pending messages
  console.log("Test 2: DestroyWindow automatic timer & queue cleanup...");
  SetTimer(301, 5, 50);
  const winCountBefore = kernel.windows.length;
  // Create dummy window record
  kernel.windows.push({
    hwnd: 301,
    parentHwnd: null,
    className: "TestDummy",
    wndProc: () => 0,
    title: "Dummy",
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    style: 0,
    exStyle: 0,
    menuId: null,
    visible: true,
    minimized: false,
    maximized: false,
    enabled: true,
    zIndex: 1,
    customProps: {},
  });
  kernel.PostMessage(301, 0x0113 /* WM_TIMER */, 5, 0);
  DestroyWindow(301);
  assert.equal(KillTimer(301, 5), false, "Timer was already cleaned up by DestroyWindow");
  assert.equal((kernel as any).messageQueue.some((m: any) => m.hwnd === 301), false, "Queued messages for hwnd 301 removed");
  console.log("✓ DestroyWindow prunes window timers and queued messages");

  // Test 3: Closing Minesweeper updates HWND Inspector without freezing
  console.log("Test 3: HWND Inspector updates when Minesweeper closes...");
  const inspector = StartHwndInspector();
  const minesweeper = StartMinesweeper();

  await new Promise((r) => setTimeout(r, 350));
  const treeWin = kernel.getWindow(kernel.windows.find((w) => w.className === "SysTreeView32")!.hwnd)!;
  const countWhileOpen = treeWin.controlState?.treeNodes?.length ?? 0;
  assert.ok(countWhileOpen > 0, "Inspector sees Minesweeper in tree");

  // Close Minesweeper
  SendMessage(minesweeper, WM_CLOSE, 0, 0);

  // Wait for inspector timer tick
  await new Promise((r) => setTimeout(r, 600));

  const countAfterClose = treeWin.controlState?.treeNodes?.length ?? 0;
  assert.equal(countAfterClose, 0, "Inspector tree cleared Minesweeper and its child controls");
  assert.equal((kernel as any).messageQueue.length, 0, "Message queue not leaking unconsumed timer messages");
  console.log("✓ Inspector reflects closed window and message pump keeps functioning");

  // Cleanup
  DestroyWindow(inspector);

  console.log("\nALL WINDOW LIFECYCLE & RESOURCE LEAK TESTS PASSED! 🛡️⚡🎉");
  process.exit(0);
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
