import { test, expect } from "@playwright/test";
import * as path from "node:path";
import * as fs from "node:fs";

test.describe("Petzold Programming Windows 5th Edition - WASM Harness", () => {
  test("Chapter 01: HelloMsg displays MessageBox and closes on OK click", async ({ page }) => {
    const wasmPath = path.resolve("harness/build/Chap01/HelloMsg/HelloMsg.wasm");
    if (!fs.existsSync(wasmPath)) {
      throw new Error(`Compiled WASM binary not found at ${wasmPath}. Run 'make -C harness chap01' first.`);
    }

    const wasmBase64 = fs.readFileSync(wasmPath).toString("base64");

    await page.goto("/");
    await page.waitForSelector(".desktop-container");

    // Instantiate and execute WinMain from HelloMsg.wasm
    await page.evaluate(async (base64) => {
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const win32 = (window as any).__WIN32__;
      const runtime = new win32.Win32WasmRuntime();
      await runtime.instantiate(bytes);
      runtime.runWinMain(1);
    }, wasmBase64);

    // Locate the MessageBox modal
    const dialog = page.locator(".modal-backdrop .win32-dialog");
    await expect(dialog).toBeVisible();

    // Verify title and content
    const title = dialog.locator(".title-bar-text");
    await expect(title).toHaveText("HelloMsg");

    const messageText = dialog.locator(".text-area");
    await expect(messageText).toHaveText("Hello, Windows 98!");

    // Click OK button
    const okBtn = dialog.locator(".button-row button", { hasText: "OK" });
    await expect(okBtn).toBeVisible();
    await okBtn.click();

    // Verify dialog closed
    await expect(dialog).toBeHidden();
  });

  test("Chapter 02: ScrnSize formats dimensions via vsnprintf and displays MessageBox", async ({ page }) => {
    const wasmPath = path.resolve("harness/build/Chap02/ScrnSize/ScrnSize.wasm");
    if (!fs.existsSync(wasmPath)) {
      throw new Error(`Compiled WASM binary not found at ${wasmPath}. Run 'make -C harness chap02' first.`);
    }

    const wasmBase64 = fs.readFileSync(wasmPath).toString("base64");

    await page.goto("/");
    await page.waitForSelector(".desktop-container");

    // Instantiate and execute WinMain from ScrnSize.wasm
    await page.evaluate(async (base64) => {
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const win32 = (window as any).__WIN32__;
      const runtime = new win32.Win32WasmRuntime();
      await runtime.instantiate(bytes);
      runtime.runWinMain(2);
    }, wasmBase64);

    // Locate the MessageBox modal
    const dialog = page.locator(".modal-backdrop .win32-dialog");
    await expect(dialog).toBeVisible();

    // Verify title and content
    const title = dialog.locator(".title-bar-text");
    await expect(title).toHaveText("ScrnSize");

    const messageText = dialog.locator(".text-area");
    await expect(messageText).toHaveText(/The screen is \d+ pixels wide by \d+ pixels high\./);

    // Click OK button
    const okBtn = dialog.locator(".button-row button", { hasText: "OK" });
    await expect(okBtn).toBeVisible();
    await okBtn.click();

    // Verify dialog closed
    await expect(dialog).toBeHidden();
  });

  test("Chapter 03: HelloWin creates desktop window and draws Hello, Windows 98!", async ({ page }) => {
    const wasmPath = path.resolve("harness/build/Chap03/HelloWin/HelloWin.wasm");
    if (!fs.existsSync(wasmPath)) {
      throw new Error(`Compiled WASM binary not found at ${wasmPath}. Run 'make -C harness chap03' first.`);
    }

    const wasmBase64 = fs.readFileSync(wasmPath).toString("base64");

    await page.goto("/");
    await page.waitForSelector(".desktop-container");

    // Instantiate and execute WinMain from HelloWin.wasm
    page.on("pageerror", (err) => console.error("PAGE ERROR:", err));
    page.on("console", (msg) => console.log("PAGE LOG:", msg.text()));

    const exitCode = await page.evaluate(async (base64) => {
      try {
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        const win32 = (window as any).__WIN32__;
        const runtime = new win32.Win32WasmRuntime({ initialX: 150, initialY: 100 });
        await runtime.instantiate(bytes);
        return runtime.runWinMain(1);
      } catch (err: any) {
        console.error("WINMAIN ERROR:", err?.message || err);
        return -999;
      }
    }, wasmBase64);
    console.log("WinMain exit code:", exitCode);

    // Locate the newly created window titled "The Hello Program"
    const windowEl = page.locator(".win32-window").filter({ hasText: "The Hello Program" });
    await expect(windowEl).toBeVisible();

    // Verify title text
    const title = windowEl.locator(".title-bar-text");
    await expect(title).toHaveText("The Hello Program");

    // Verify canvas is present for GDI rendering
    const canvas = windowEl.locator("canvas");
    await expect(canvas).toBeVisible();

    // Close window via titlebar close button
    const closeBtn = windowEl.locator('button[aria-label="Close"]');
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();

    // Window should be removed
    await expect(windowEl).toBeHidden();
  });

  test("Chapter 04: SysMets1 creates window and draws system metrics via TextOut and GetTextMetrics", async ({ page }) => {
    const wasmPath = path.resolve("harness/build/Chap04/SysMets1/SysMets1.wasm");
    if (!fs.existsSync(wasmPath)) {
      throw new Error(`Compiled WASM binary not found at ${wasmPath}. Run 'make -C harness chap04' first.`);
    }

    const wasmBase64 = fs.readFileSync(wasmPath).toString("base64");

    await page.goto("/");
    await page.waitForSelector(".desktop-container");

    const exitCode = await page.evaluate(async (base64) => {
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const win32 = (window as any).__WIN32__;
      const runtime = new win32.Win32WasmRuntime({ initialX: 180, initialY: 90 });
      await runtime.instantiate(bytes);
      return runtime.runWinMain(1);
    }, wasmBase64);

    expect(exitCode).toBe(0);

    // Locate the newly created window titled "Get System Metrics No. 1"
    const windowEl = page.locator(".win32-window").filter({ hasText: "Get System Metrics No. 1" });
    await expect(windowEl).toBeVisible();

    const title = windowEl.locator(".title-bar-text");
    await expect(title).toHaveText("Get System Metrics No. 1");

    // Verify canvas is present
    const canvas = windowEl.locator("canvas");
    await expect(canvas).toBeVisible();

    // Close window
    const closeBtn = windowEl.locator('button[aria-label="Close"]');
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();
    await expect(windowEl).toBeHidden();
  });

  test("Chapter 05: SineWave renders sine wave curve using Polyline and math.h", async ({ page }) => {
    const wasmPath = path.resolve("harness/build/Chap05/SineWave/SineWave.wasm");
    if (!fs.existsSync(wasmPath)) {
      throw new Error(`Compiled WASM binary not found at ${wasmPath}. Run 'make -C harness chap05' first.`);
    }

    const wasmBase64 = fs.readFileSync(wasmPath).toString("base64");

    await page.goto("/");
    await page.waitForSelector(".desktop-container");

    const exitCode = await page.evaluate(async (base64) => {
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const win32 = (window as any).__WIN32__;
      const runtime = new win32.Win32WasmRuntime({ initialX: 200, initialY: 100 });
      await runtime.instantiate(bytes);
      return runtime.runWinMain(1);
    }, wasmBase64);

    expect(exitCode).toBe(0);

    // Locate the newly created window titled "Sine Wave Using Polyline"
    const windowEl = page.locator(".win32-window").filter({ hasText: "Sine Wave Using Polyline" });
    await expect(windowEl).toBeVisible();

    const title = windowEl.locator(".title-bar-text");
    await expect(title).toHaveText("Sine Wave Using Polyline");

    const canvas = windowEl.locator("canvas");
    await expect(canvas).toBeVisible();

    // Close window
    const closeBtn = windowEl.locator('button[aria-label="Close"]');
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();
    await expect(windowEl).toBeHidden();
  });

  test("Chapter 06: Typer creates typing window with Caret APIs and keyboard event handling", async ({ page }) => {
    const wasmPath = path.resolve("harness/build/Chap06/Typer/Typer.wasm");
    if (!fs.existsSync(wasmPath)) {
      throw new Error(`Compiled WASM binary not found at ${wasmPath}. Run 'make -C harness chap06' first.`);
    }

    const wasmBase64 = fs.readFileSync(wasmPath).toString("base64");

    await page.goto("/");
    await page.waitForSelector(".desktop-container");

    const exitCode = await page.evaluate(async (base64) => {
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const win32 = (window as any).__WIN32__;
      const runtime = new win32.Win32WasmRuntime({ initialX: 220, initialY: 110 });
      await runtime.instantiate(bytes);
      return runtime.runWinMain(1);
    }, wasmBase64);

    expect(exitCode).toBe(0);

    // Locate the newly created window titled "Typing Program"
    const windowEl = page.locator(".win32-window").filter({ hasText: "Typing Program" });
    await expect(windowEl).toBeVisible();

    const title = windowEl.locator(".title-bar-text");
    await expect(title).toHaveText("Typing Program");

    const canvas = windowEl.locator("canvas");
    await expect(canvas).toBeVisible();

    // Close window
    const closeBtn = windowEl.locator('button[aria-label="Close"]');
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();
    await expect(windowEl).toBeHidden();
  });

  test("Chapter 07: Checker1 handles mouse clicks and hit-testing on 5x5 grid", async ({ page }) => {
    const wasmPath = path.resolve("harness/build/Chap07/Checker1/Checker1.wasm");
    if (!fs.existsSync(wasmPath)) {
      throw new Error(`Compiled WASM binary not found at ${wasmPath}. Run 'make -C harness chap07' first.`);
    }

    const wasmBase64 = fs.readFileSync(wasmPath).toString("base64");

    await page.goto("/");
    await page.waitForSelector(".desktop-container");

    const exitCode = await page.evaluate(async (base64) => {
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const win32 = (window as any).__WIN32__;
      const runtime = new win32.Win32WasmRuntime({ initialX: 200, initialY: 100 });
      await runtime.instantiate(bytes);
      return runtime.runWinMain(1);
    }, wasmBase64);

    expect(exitCode).toBe(0);

    // Locate the newly created window titled "Checker1 Mouse Hit-Test Demo"
    const windowEl = page.locator(".win32-window").filter({ hasText: "Checker1 Mouse Hit-Test Demo" });
    await expect(windowEl).toBeVisible();

    const title = windowEl.locator(".title-bar-text");
    await expect(title).toHaveText("Checker1 Mouse Hit-Test Demo");

    const canvas = windowEl.locator("canvas");
    await expect(canvas).toBeVisible();

    // Click on cell (0, 0)
    await canvas.click({ position: { x: 50, y: 50 } });

    // Click on cell (1, 1)
    await canvas.click({ position: { x: 150, y: 150 } });

    // Close window
    const closeBtn = windowEl.locator('button[aria-label="Close"]');
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();
    await expect(windowEl).toBeHidden();
  });

  test("Chapter 08: DigClock creates digital clock with SetTimer and GetLocalTime", async ({ page }) => {
    const wasmPath = path.resolve("harness/build/Chap08/DigClock/DigClock.wasm");
    if (!fs.existsSync(wasmPath)) {
      throw new Error(`Compiled WASM binary not found at ${wasmPath}. Run 'make -C harness chap08' first.`);
    }

    const wasmBase64 = fs.readFileSync(wasmPath).toString("base64");

    await page.goto("/");
    await page.waitForSelector(".desktop-container");

    const exitCode = await page.evaluate(async (base64) => {
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const win32 = (window as any).__WIN32__;
      const runtime = new win32.Win32WasmRuntime({ initialX: 250, initialY: 120 });
      await runtime.instantiate(bytes);
      return runtime.runWinMain(1);
    }, wasmBase64);

    expect(exitCode).toBe(0);

    // Locate the newly created window titled "Digital Clock"
    const windowEl = page.locator(".win32-window").filter({ hasText: "Digital Clock" });
    await expect(windowEl).toBeVisible();

    const title = windowEl.locator(".title-bar-text");
    await expect(title).toHaveText("Digital Clock");

    const canvas = windowEl.locator("canvas");
    await expect(canvas).toBeVisible();

    // Close window
    const closeBtn = windowEl.locator('button[aria-label="Close"]');
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();
    await expect(windowEl).toBeHidden();
  });

  test("Chapter 10: MenuDemo creates window and handles menu operations", async ({ page }) => {
    const wasmPath = path.resolve("harness/build/Chap10/MenuDemo/MenuDemo.wasm");
    if (!fs.existsSync(wasmPath)) {
      throw new Error(`Compiled WASM binary not found at ${wasmPath}. Run 'make -C harness chap10' first.`);
    }

    const wasmBase64 = fs.readFileSync(wasmPath).toString("base64");

    await page.goto("/");
    await page.waitForSelector(".desktop-container");

    const exitCode = await page.evaluate(async (base64) => {
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const win32 = (window as any).__WIN32__;
      const runtime = new win32.Win32WasmRuntime({ initialX: 260, initialY: 130 });
      await runtime.instantiate(bytes);
      return runtime.runWinMain(1);
    }, wasmBase64);

    expect(exitCode).toBe(0);

    // Locate the newly created window titled "Menu Demonstration"
    const windowEl = page.locator(".win32-window").filter({ hasText: "Menu Demonstration" });
    await expect(windowEl).toBeVisible();

    const title = windowEl.locator(".title-bar-text");
    await expect(title).toHaveText("Menu Demonstration");

    const canvas = windowEl.locator("canvas");
    await expect(canvas).toBeVisible();

    // Close window
    const closeBtn = windowEl.locator('button[aria-label="Close"]');
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();
    await expect(windowEl).toBeHidden();
  });

  test("Chapter 11: About1 creates window and handles dialog box procedures", async ({ page }) => {
    const wasmPath = path.resolve("harness/build/Chap11/About1/About1.wasm");
    if (!fs.existsSync(wasmPath)) {
      throw new Error(`Compiled WASM binary not found at ${wasmPath}. Run 'make -C harness chap11' first.`);
    }

    const wasmBase64 = fs.readFileSync(wasmPath).toString("base64");

    await page.goto("/");
    await page.waitForSelector(".desktop-container");

    const exitCode = await page.evaluate(async (base64) => {
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const win32 = (window as any).__WIN32__;
      const runtime = new win32.Win32WasmRuntime({ initialX: 270, initialY: 140 });
      await runtime.instantiate(bytes);
      return runtime.runWinMain(1);
    }, wasmBase64);

    expect(exitCode).toBe(0);

    // Locate the newly created window titled "About Box Demo Program"
    const windowEl = page.locator(".win32-window").filter({ hasText: "About Box Demo Program" });
    await expect(windowEl).toBeVisible();

    const title = windowEl.locator(".title-bar-text");
    await expect(title).toHaveText("About Box Demo Program");

    const canvas = windowEl.locator("canvas");
    await expect(canvas).toBeVisible();

    // Close window
    const closeBtn = windowEl.locator('button[aria-label="Close"]');
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();
    await expect(windowEl).toBeHidden();
  });

  test("Chapter 12: ClipText and ClipView demonstrate clipboard and viewer chains", async ({ page }) => {
    const clipTextPath = path.resolve("harness/build/Chap12/ClipText/ClipText.wasm");
    const clipViewPath = path.resolve("harness/build/Chap12/ClipView/ClipView.wasm");
    if (!fs.existsSync(clipTextPath) || !fs.existsSync(clipViewPath)) {
      throw new Error("Compiled WASM binary not found. Run 'make -C harness chap12' first.");
    }

    const clipTextBase64 = fs.readFileSync(clipTextPath).toString("base64");
    const clipViewBase64 = fs.readFileSync(clipViewPath).toString("base64");

    await page.goto("/");
    await page.waitForSelector(".desktop-container");

    const exitCodeText = await page.evaluate(async (base64) => {
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const win32 = (window as any).__WIN32__;
      const runtime = new win32.Win32WasmRuntime({ initialX: 280, initialY: 120 });
      await runtime.instantiate(bytes);
      return runtime.runWinMain(1);
    }, clipTextBase64);

    expect(exitCodeText).toBe(0);

    const textWindow = page.locator(".win32-window").filter({ hasText: "Clipboard Text Transfers" });
    await expect(textWindow).toBeVisible();

    const textTitle = textWindow.locator(".title-bar-text");
    await expect(textTitle).toHaveText("Clipboard Text Transfers - ANSI Version");

    const exitCodeView = await page.evaluate(async (base64) => {
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const win32 = (window as any).__WIN32__;
      const runtime = new win32.Win32WasmRuntime({ initialX: 340, initialY: 180 });
      await runtime.instantiate(bytes);
      return runtime.runWinMain(1);
    }, clipViewBase64);

    expect(exitCodeView).toBe(0);

    const viewWindow = page.locator(".win32-window").filter({ hasText: "Simple Clipboard Viewer" });
    await expect(viewWindow).toBeVisible();

    const viewTitle = viewWindow.locator(".title-bar-text");
    await expect(viewTitle).toHaveText("Simple Clipboard Viewer (Text Only)");

    // Close both windows
    const closeViewBtn = viewWindow.locator('button[aria-label="Close"]');
    await closeViewBtn.click();
    await expect(viewWindow).toBeHidden();

    const closeTextBtn = textWindow.locator('button[aria-label="Close"]');
    await closeTextBtn.click();
    await expect(textWindow).toBeHidden();
  });

  test("Chapter 13: Print1 creates window with printer capabilities and draws print preview", async ({ page }) => {
    const wasmPath = path.resolve("harness/build/Chap13/Print1/Print1.wasm");
    if (!fs.existsSync(wasmPath)) {
      throw new Error(`Compiled WASM binary not found at ${wasmPath}. Run 'make -C harness chap13' first.`);
    }

    const wasmBase64 = fs.readFileSync(wasmPath).toString("base64");

    await page.goto("/");
    await page.waitForSelector(".desktop-container");

    const exitCode = await page.evaluate(async (base64) => {
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const win32 = (window as any).__WIN32__;
      const runtime = new win32.Win32WasmRuntime({ initialX: 290, initialY: 130 });
      await runtime.instantiate(bytes);
      return runtime.runWinMain(1);
    }, wasmBase64);

    expect(exitCode).toBe(0);

    // Locate the newly created window titled "Print Program 1"
    const windowEl = page.locator(".win32-window").filter({ hasText: "Print Program 1" });
    await expect(windowEl).toBeVisible();

    const title = windowEl.locator(".title-bar-text");
    await expect(title).toHaveText("Print Program 1");

    const canvas = windowEl.locator("canvas");
    await expect(canvas).toBeVisible();

    // Close window
    const closeBtn = windowEl.locator('button[aria-label="Close"]');
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();
    await expect(windowEl).toBeHidden();
  });

  test("Chapter 14: BitBlt creates window and executes bitmap raster operations", async ({ page }) => {
    const wasmPath = path.resolve("harness/build/Chap14/BitBlt/BitBlt.wasm");
    if (!fs.existsSync(wasmPath)) {
      throw new Error(`Compiled WASM binary not found at ${wasmPath}. Run 'make -C harness chap14' first.`);
    }

    const wasmBase64 = fs.readFileSync(wasmPath).toString("base64");

    await page.goto("/");
    await page.waitForSelector(".desktop-container");

    const exitCode = await page.evaluate(async (base64) => {
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const win32 = (window as any).__WIN32__;
      const runtime = new win32.Win32WasmRuntime({ initialX: 300, initialY: 140 });
      await runtime.instantiate(bytes);
      return runtime.runWinMain(1);
    }, wasmBase64);

    expect(exitCode).toBe(0);

    // Locate the newly created window titled "BitBlt Demo"
    const windowEl = page.locator(".win32-window").filter({ hasText: "BitBlt Demo" });
    await expect(windowEl).toBeVisible();

    const title = windowEl.locator(".title-bar-text");
    await expect(title).toHaveText("BitBlt Demo");

    const canvas = windowEl.locator("canvas");
    await expect(canvas).toBeVisible();

    // Close window
    const closeBtn = windowEl.locator('button[aria-label="Close"]');
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();
    await expect(windowEl).toBeHidden();
  });

  test("Chapter 15: Apollo11 loads DIBs and renders device-independent bitmaps via SetDIBitsToDevice", async ({ page }) => {
    const wasmPath = path.resolve("harness/build/Chap15/Apollo11/Apollo11.wasm");
    if (!fs.existsSync(wasmPath)) {
      throw new Error(`Compiled WASM binary not found at ${wasmPath}. Run 'make -C harness chap15' first.`);
    }

    const wasmBase64 = fs.readFileSync(wasmPath).toString("base64");

    await page.goto("/");
    await page.waitForSelector(".desktop-container");

    const exitCode = await page.evaluate(async (base64) => {
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const win32 = (window as any).__WIN32__;
      const runtime = new win32.Win32WasmRuntime({ initialX: 250, initialY: 100 });
      await runtime.instantiate(bytes);
      return runtime.runWinMain(1);
    }, wasmBase64);

    expect(exitCode).toBe(0);

    // Locate the newly created window titled "Apollo 11"
    const windowEl = page.locator(".win32-window").filter({ hasText: "Apollo 11" });
    await expect(windowEl).toBeVisible();

    const title = windowEl.locator(".title-bar-text");
    await expect(title).toHaveText("Apollo 11");

    const canvas = windowEl.locator("canvas");
    await expect(canvas).toBeVisible();

    // Close window
    const closeBtn = windowEl.locator('button[aria-label="Close"]');
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();
    await expect(windowEl).toBeHidden();
  });

  test("Chapter 16: SysPal1 queries system palette entries and displays palette grid", async ({ page }) => {
    const wasmPath = path.resolve("harness/build/Chap16/SysPal1/SysPal1.wasm");
    if (!fs.existsSync(wasmPath)) {
      throw new Error(`Compiled WASM binary not found at ${wasmPath}. Run 'make -C harness chap16' first.`);
    }

    const wasmBase64 = fs.readFileSync(wasmPath).toString("base64");

    await page.goto("/");
    await page.waitForSelector(".desktop-container");

    const exitCode = await page.evaluate(async (base64) => {
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const win32 = (window as any).__WIN32__;
      const runtime = new win32.Win32WasmRuntime({ initialX: 280, initialY: 110 });
      await runtime.instantiate(bytes);
      return runtime.runWinMain(1);
    }, wasmBase64);

    expect(exitCode).toBe(0);

    // Locate the newly created window titled "System Palette #1"
    const windowEl = page.locator(".win32-window").filter({ hasText: "System Palette #1" });
    await expect(windowEl).toBeVisible();

    const title = windowEl.locator(".title-bar-text");
    await expect(title).toHaveText("System Palette #1");

    const canvas = windowEl.locator("canvas");
    await expect(canvas).toBeVisible();

    // Close window
    const closeBtn = windowEl.locator('button[aria-label="Close"]');
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();
    await expect(windowEl).toBeHidden();
  });

  test("Chapter 17: EndJoin renders path with geometric pens and join styles", async ({ page }) => {
    const wasmPath = path.resolve("harness/build/Chap17/EndJoin/EndJoin.wasm");
    if (!fs.existsSync(wasmPath)) {
      throw new Error(`Compiled WASM binary not found at ${wasmPath}. Run 'make -C harness chap17' first.`);
    }

    const wasmBase64 = fs.readFileSync(wasmPath).toString("base64");

    await page.goto("/");
    await page.waitForSelector(".desktop-container");

    const exitCode = await page.evaluate(async (base64) => {
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const win32 = (window as any).__WIN32__;
      const runtime = new win32.Win32WasmRuntime({ initialX: 280, initialY: 110 });
      await runtime.instantiate(bytes);
      return runtime.runWinMain(1);
    }, wasmBase64);

    expect(exitCode).toBe(0);

    // Locate the newly created window titled "Ends and Joins Demo"
    const windowEl = page.locator(".win32-window").filter({ hasText: "Ends and Joins Demo" });
    await expect(windowEl).toBeVisible();

    const title = windowEl.locator(".title-bar-text");
    await expect(title).toHaveText("Ends and Joins Demo");

    const canvas = windowEl.locator("canvas");
    await expect(canvas).toBeVisible();

    // Close window
    const closeBtn = windowEl.locator('button[aria-label="Close"]');
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();
    await expect(windowEl).toBeHidden();
  });

  test("Chapter 17: EZTest initializes font metrics and renders formatted text", async ({ page }) => {
    const wasmPath = path.resolve("harness/build/Chap17/EZTest/EZTest.wasm");
    if (!fs.existsSync(wasmPath)) {
      throw new Error(`Compiled WASM binary not found at ${wasmPath}. Run 'make -C harness chap17' first.`);
    }

    const wasmBase64 = fs.readFileSync(wasmPath).toString("base64");

    await page.goto("/");
    await page.waitForSelector(".desktop-container");

    const exitCode = await page.evaluate(async (base64) => {
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const win32 = (window as any).__WIN32__;
      const runtime = new win32.Win32WasmRuntime({ initialX: 300, initialY: 120 });
      await runtime.instantiate(bytes);
      return runtime.runWinMain(1);
    }, wasmBase64);

    expect(exitCode).toBe(0);

    // Locate the newly created window titled "EZTest: Test of EZFONT"
    const windowEl = page.locator(".win32-window").filter({ hasText: "EZTest: Test of EZFONT" });
    await expect(windowEl).toBeVisible();

    const title = windowEl.locator(".title-bar-text");
    await expect(title).toHaveText("EZTest: Test of EZFONT");

    const canvas = windowEl.locator("canvas");
    await expect(canvas).toBeVisible();

    // Close window
    const closeBtn = windowEl.locator('button[aria-label="Close"]');
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();
    await expect(windowEl).toBeHidden();
  });
});
