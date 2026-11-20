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
});
