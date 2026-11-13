import { Win32LuaRuntime } from "../lua_engine";
import { kernel, SendMessage } from "../kernel.svelte";
import { WM_COMMAND, WM_PAINT } from "../constants";

async function runLuaIntegrationTests() {
  console.log("Starting Win32 Lua 5.3 Integration Tests...\n");

  const runtime = new Win32LuaRuntime();
  const capturedLogs: string[] = [];
  runtime.onLog = (msg) => {
    capturedLogs.push(`[${msg.type}] ${msg.text}`);
  };

  // Test 1: Basic Lua Math & Loops
  console.log("Test 1: Executing standard Lua 5.3 script...");
  const script1 = `
    print("Testing Lua " .. _VERSION)
    local total = 0
    for i = 1, 100 do
      total = total + i
    end
    print("Sum 1..100 =", total)
  `;
  const res1 = runtime.execute(script1);
  if (!res1.success) throw new Error(`Script 1 failed: ${res1.error}`);
  if (!capturedLogs.some((l) => l.includes("Sum 1..100 =\t5050"))) {
    throw new Error("Expected output for sum 1..100 not found");
  }
  console.log("✓ Basic Lua loop executed successfully (5050)");

  // Test 2: Win32 API Window & Control Creation from Lua
  console.log("Test 2: Creating Win32 Window & Button from Lua...");
  let buttonClicked = false;
  const script2 = `
    local win = win32.CreateWindow(
      "LuaTestWindowClass",
      "Lua Created Window",
      150, 150, 320, 200,
      win32.WS_OVERLAPPEDWINDOW | win32.WS_VISIBLE
    )

    local btn = win32.CreateButton(
      "Lua Button 1",
      20, 20, 120, 30,
      win,
      function(hwnd)
        print("Lua button clicked! HWND:", hwnd)
        win32.SetWindowText(hwnd, "Clicked!")
        win32.PlaySound("Ding")
      end
    )

    print("Created Window HWND:", win, "Button HWND:", btn)
  `;

  const res2 = runtime.execute(script2);
  if (!res2.success) throw new Error(`Script 2 failed: ${res2.error}`);

  const createdWin = kernel.windows.find((w) => w.title === "Lua Created Window");
  if (!createdWin) throw new Error("Window created by Lua was not found in kernel!");
  console.log(`✓ Window verified in kernel: HWND ${createdWin.hwnd}`);

  const childBtn = kernel.windows.find(
    (w) => w.parentHwnd === createdWin.hwnd && w.className === "BUTTON"
  );
  if (!childBtn) throw new Error("Child button created by Lua was not found!");
  console.log(`✓ Child button verified in kernel: HWND ${childBtn.hwnd}`);

  // Test 3: Trigger button click via WM_COMMAND and verify Lua callback runs
  console.log("Test 3: Dispatching WM_COMMAND to trigger Lua callback...");
  SendMessage(createdWin.hwnd, WM_COMMAND, childBtn.hwnd, 0);

  const updatedText = kernel.GetWindowText(childBtn.hwnd);
  if (updatedText !== "Clicked!") {
    throw new Error(`Expected button text "Clicked!", got "${updatedText}"`);
  }
  console.log(`✓ Button text changed by Lua callback to: "${updatedText}"`);

  // Test 4: Custom Class Registration & WndProc in Lua
  console.log("Test 4: Registering custom Win32 Window Class with WndProc in Lua...");
  const script3 = `
    local paintCount = 0
    win32.RegisterClass("CustomLuaClass", function(hwnd, msg, wp, lp)
      if msg == win32.WM_PAINT then
        paintCount = paintCount + 1
        print("WM_PAINT handled in Lua! Count:", paintCount)
        return 0
      end
      return win32.DefWindowProc(hwnd, msg, wp, lp)
    end)

    local customWin = win32.CreateWindow(
      "CustomLuaClass",
      "Custom Lua WndProc Window",
      200, 200, 300, 200
    )
  `;

  const res3 = runtime.execute(script3);
  if (!res3.success) throw new Error(`Script 3 failed: ${res3.error}`);

  const customWin = kernel.windows.find((w) => w.className === "CustomLuaClass");
  if (!customWin) throw new Error("CustomLuaClass window not found!");

  // Dispatch WM_PAINT
  SendMessage(customWin.hwnd, WM_PAINT, 0, 0);
  if (!capturedLogs.some((l) => l.includes("WM_PAINT handled in Lua! Count:\t1"))) {
    throw new Error("WM_PAINT message was not routed to Lua WndProc callback");
  }
  console.log("✓ Lua WndProc successfully processed WM_PAINT message!");

  // Test 5: Error Handling
  console.log("Test 5: Testing Lua syntax and runtime error capture...");
  const badScript = `
    local x = nil
    x:nonexistent_method()
  `;
  const resBad = runtime.execute(badScript);
  if (resBad.success) throw new Error("Expected script with error to fail, but it succeeded!");
  console.log(`✓ Error captured cleanly: "${resBad.error}"`);

  runtime.dispose();
  console.log("\nALL WIN32 LUA 5.3 INTEGRATION TESTS PASSED! 🌙⚡🎉");
}

runLuaIntegrationTests().catch((err) => {
  console.error("Lua Integration Test Failed:", err);
  process.exit(1);
});
