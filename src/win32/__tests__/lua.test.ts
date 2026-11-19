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

  // Test 6: Procedural GDI Graphics (SAMPLE_GDI)
  console.log("Test 6: Testing Lua Procedural GDI Art & Graphics...");
  const scriptGdi = `
    local gdiPainted = false
    win32.RegisterClass("TestLuaGdiClass", function(hwnd, msg, wp, lp)
      if msg == win32.WM_PAINT then
        local hdc = win32.BeginPaint(hwnd)
        for i = 1, 4 do
          local pen = win32.CreatePen(0, 1, "#ff0000")
          local brush = win32.CreateSolidBrush("#00ff00")
          win32.SelectObject(hdc, brush)
          win32.SelectObject(hdc, pen)
          win32.Rectangle(hdc, 10 * i, 10 * i, 100 - i * 5, 80 - i * 5)
          win32.Ellipse(hdc, 15 * i, 15 * i, 90 - i * 5, 70 - i * 5)
          win32.DeleteObject(brush)
          win32.DeleteObject(pen)
        end
        win32.SetTextColor(hdc, "#0000ff")
        win32.TextOut(hdc, 20, 20, "Lua GDI Art Test")
        win32.EndPaint(hwnd)
        gdiPainted = true
        print("GDI Art WM_PAINT completed successfully")
        return 0
      end
      return win32.DefWindowProc(hwnd, msg, wp, lp)
    end)

    local gdiWin = win32.CreateWindow("TestLuaGdiClass", "GDI Win", 10, 10, 200, 150)
  `;
  const resGdi = runtime.execute(scriptGdi);
  if (!resGdi.success) throw new Error(`Script GDI failed: ${resGdi.error}`);

  const gdiWindow = kernel.windows.find((w) => w.title === "GDI Win");
  if (!gdiWindow) throw new Error("GDI window not found in kernel!");
  if (!gdiWindow.customProps?.hasCanvas) {
    throw new Error("GDI window is missing hasCanvas customProp!");
  }

  SendMessage(gdiWindow.hwnd, WM_PAINT, 0, 0);
  if (!capturedLogs.some((l) => l.includes("GDI Art WM_PAINT completed successfully"))) {
    throw new Error("GDI Art WM_PAINT log was not produced");
  }
  console.log("✓ Lua Procedural GDI Art painted with brushes, pens, rectangles, ellipses and text!");

  // Test 7: COM & DCOM Automation
  console.log("Test 7: Testing Lua Win32 COM & DCOM Automation...");
  const scriptCom = `
    local calc = win32.CreateObject("Calc.Engine")
    if not calc then error("Calc.Engine failed to create") end
    local addRes = calc:Add(15, 35)
    local evalRes = calc:Eval("(10 + 20) * 3")
    print("COM Add: " .. tostring(addRes))
    print("COM Eval: " .. tostring(evalRes))

    local audio = win32.CreateObject("Audio.Synthesizer")
    if not audio then error("Audio.Synthesizer failed to create") end
    audio:PlayDing()
    print("COM Audio: Ding played")

    local doc = win32.CreateObject("Notepad.Document")
    if not doc then error("Notepad.Document failed to create") end
    doc:AppendLine("First Line")
    doc:AppendLine("Second Line")
    print("COM Doc Lines: " .. tostring(doc:GetLineCount()))

    win32.CreateRemoteObject("Calc.Engine", "win32-dcom-bus", function(remoteCalc, err)
      if err then error("DCOM remote create failed: " .. tostring(err)) end
      remoteCalc:Add(100, 200, function(remoteSum)
        print("DCOM Remote Sum: " .. tostring(remoteSum))
      end)
    end)
  `;
  const resCom = runtime.execute(scriptCom);
  if (!resCom.success) throw new Error(`Script COM failed: ${resCom.error}`);

  await new Promise((r) => setTimeout(r, 100));

  if (!capturedLogs.some((l) => l.includes("COM Add: 50"))) {
    throw new Error("COM Add result not found in logs");
  }
  if (!capturedLogs.some((l) => l.includes("COM Eval: 90"))) {
    throw new Error("COM Eval result not found in logs");
  }
  if (!capturedLogs.some((l) => l.includes("COM Doc Lines: 2"))) {
    throw new Error("COM Doc line count not found in logs");
  }
  if (!capturedLogs.some((l) => l.includes("DCOM Remote Sum: 300"))) {
    throw new Error("DCOM Remote Sum not found in logs");
  }
  console.log("✓ Lua COM & DCOM late-bound IDispatch and ORPC verified!");

  runtime.dispose();
  console.log("\nALL WIN32 LUA 5.3 INTEGRATION TESTS PASSED! 🌙⚡🎉");
  process.exit(0);
}

runLuaIntegrationTests().catch((err) => {
  console.error("Lua Integration Test Failed:", err);
  process.exit(1);
});
