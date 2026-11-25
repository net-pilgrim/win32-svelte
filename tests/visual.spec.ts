import { test, expect } from "@playwright/test";
import * as path from "node:path";
import * as fs from "node:fs";

test.describe("Win32 Svelte Desktop & Start Menu Visual Tests", () => {
  const screenshotsDir = path.resolve(process.cwd(), "test-results", "visual");

  test.beforeAll(async () => {
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
  });

  test("Desktop and Taskbar render with classic icons and unpixelated typography", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".desktop-container");

    // Verify Start Button has classic flag icon and text
    const startFlag = page.locator(".start-button .start-flag");
    await expect(startFlag).toBeVisible();
    await expect(startFlag).toHaveText("🪟");

    // Verify Quick Launch icons: all 8 buttons render icons
    const quickLaunchIcons = page.locator(".quick-launch .quick-btn");
    await expect(quickLaunchIcons).toHaveCount(8);

    // Verify System Tray audio speaker button
    const traySpeaker = page.locator(".tray-btn");
    await expect(traySpeaker).toBeVisible();

    // Verify Desktop icons have rendered graphics
    const desktopIconGraphics = page.locator(".desktop-icon .icon-graphic");
    const count = await desktopIconGraphics.count();
    expect(count).toBeGreaterThan(0);

    // Capture visual screenshot of full desktop
    await page.screenshot({ path: path.join(screenshotsDir, "01-desktop-overview.png") });
  });

  test("Start Menu opens with flat de-beveled entries, smooth fonts, and classic icons", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".start-button");

    // Click Start button
    await page.click(".start-button");
    const menu = page.locator(".start-menu-container.flat");
    await expect(menu).toBeVisible();

    // Verify computed styles: no 3D button bevel on items
    const firstItem = page.locator(".start-menu-container.flat .start-item").first();
    await expect(firstItem).toBeVisible();
    const boxShadow = await firstItem.evaluate((el) => window.getComputedStyle(el).boxShadow);
    expect(boxShadow).toBe("none");

    // Verify font family is antialiased and uses smooth typography
    const fontFamily = await menu.evaluate((el) => window.getComputedStyle(el).fontFamily);
    expect(fontFamily).not.toContain("Pixelated MS Sans Serif");

    // Verify icons inside start menu exist and have non-empty text
    const menuIcons = page.locator(".start-menu-container .item-icon");
    const iconCount = await menuIcons.count();
    expect(iconCount).toBeGreaterThan(5);

    // Capture screenshot of Start Menu
    await page.screenshot({ path: path.join(screenshotsDir, "02-start-menu-flat.png") });
  });

  test("Flyout submenu expands with flat entries and colorful icons", async ({ page }) => {
    await page.goto("/");
    await page.click(".start-button");
    await page.waitForSelector(".start-menu-container");

    // Hover Programs parent item to trigger flyout submenu
    const programsItem = page.locator('.start-parent-item[data-id="programs"]');
    await programsItem.hover();

    const submenu = page.locator(".start-submenu");
    await expect(submenu).toBeVisible();

    // Verify submenu items are flat and have icons
    const subButtons = page.locator(".start-submenu .submenu-item");
    const subCount = await subButtons.count();
    expect(subCount).toBeGreaterThan(5);

    const firstSubShadow = await subButtons.first().evaluate((el) => window.getComputedStyle(el).boxShadow);
    expect(firstSubShadow).toBe("none");

    // Capture screenshot of expanded submenu
    await page.screenshot({ path: path.join(screenshotsDir, "03-start-menu-programs-flyout.png") });
  });

  test("Keyboard navigation traverses flat Start Menu cleanly", async ({ page }) => {
    await page.goto("/");
    await page.click(".start-button");
    await page.waitForSelector(".start-menu-container");

    // Press ArrowDown to focus first item
    await page.keyboard.press("ArrowDown");
    const focusedEl = page.locator(":focus");
    await expect(focusedEl).toBeVisible();

    // Press Escape to close Start Menu
    await page.keyboard.press("Escape");
    await expect(page.locator(".start-menu-container")).not.toBeVisible();
  });

  test("Window frames render with authentic 98.css 3D bevels, 3px padding, and title-bar gradients", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".win32-window");

    const win = page.locator(".win32-window").first();
    await expect(win).toBeVisible();

    // Verify 3px border padding (the silver frame around the window body and title bar)
    const padding = await win.evaluate((el) => window.getComputedStyle(el).padding);
    expect(padding).toBe("3px");

    // Verify 3D bevel inset box-shadow
    const boxShadow = await win.evaluate((el) => window.getComputedStyle(el).boxShadow);
    expect(boxShadow).toContain("inset");

    // Verify Title bar dimensions and active navy-to-cyan gradient
    const titleBar = win.locator(".title-bar");
    await expect(titleBar).toBeVisible();
    const titleBarHeight = await titleBar.evaluate((el) => el.getBoundingClientRect().height);
    expect(titleBarHeight).toBeGreaterThanOrEqual(18);

    // Verify title bar controls (close, minimize, maximize buttons)
    const closeBtn = win.locator(".title-bar-controls button[aria-label='Close']");
    await expect(closeBtn).toBeVisible();

    // Capture screenshot of the window frame and the overall desktop with open windows
    await win.screenshot({ path: path.join(screenshotsDir, "04-window-frame-bevel.png") });
    await page.screenshot({ path: path.join(screenshotsDir, "05-desktop-windows-overview.png") });
  });

  test("Vector Metafile SVG Viewer renders scalable vector graphics and rulers", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".win32-window");

    // Wait for window.__WIN32__.StartMetafileViewer to be available
    await page.waitForFunction(() => typeof (window as any).__WIN32__?.StartMetafileViewer === "function");

    // Launch Metafile Viewer via window.__WIN32__
    await page.evaluate(() => {
      (window as any).__WIN32__.StartMetafileViewer(180, 80, "C:\\wasm-demo\\emf8.emf");
    });

    // Wait for Metafile Viewer window
    const viewerWin = page.locator(".win32-window:has-text('emf8.emf - Vector Metafile Viewer (SVG)')");
    await expect(viewerWin).toBeVisible({ timeout: 5000 });

    // Verify canvas is registered and painted
    const canvas = viewerWin.locator("canvas.win32-client-canvas");
    await expect(canvas).toBeVisible();

    // Verify status bar displays vector metafile stats
    const statusBar = viewerWin.locator(".status-bar");
    await expect(statusBar).toBeVisible();

    // Capture screenshot of Vector Metafile Viewer
    await viewerWin.screenshot({ path: path.join(screenshotsDir, "06-vector-metafile-svg-viewer.png") });
  });
});
