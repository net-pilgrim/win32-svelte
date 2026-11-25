import * as fs from "node:fs";
import * as path from "node:path";
import { kernel, SendMessage } from "../src/win32/kernel.svelte";
import { Win32WasmRuntime } from "../src/win32/wasm_bridge";
import { WM_PAINT } from "../src/win32/constants";

interface AppAuditResult {
  name: string;
  wasmSize: number;
  instantiated: boolean;
  error?: string;
  exitCode?: number;
  windowCreated: boolean;
  windowTitle?: string;
  windowClass?: string;
  childCount: number;
  gdiOpsCount: number;
  wndProcCalled: boolean;
  paintCount: number;
  isBlankOrEmpty: boolean;
  reason?: string;
}

async function auditAllApps() {
  const wasmDemoDir = path.resolve("public/wasm-demo");
  const files = fs.readdirSync(wasmDemoDir).filter((f) => f.endsWith(".wasm")).sort();
  console.log(`Auditing ${files.length} WASM apps in ${wasmDemoDir}...\n`);

  const results: AppAuditResult[] = [];

  for (const file of files) {
    const wasmPath = path.join(wasmDemoDir, file);
    const wasmBytes = fs.readFileSync(wasmPath);
    const appName = path.basename(file, ".wasm");
    process.stdout.write(`[${results.length + 1}/${files.length}] Testing: ${appName}... `);

    // Clear kernel and timers for isolation
    (kernel as any).reset();

    const res: AppAuditResult = {
      name: appName,
      wasmSize: wasmBytes.length,
      instantiated: false,
      windowCreated: false,
      childCount: 0,
      gdiOpsCount: 0,
      wndProcCalled: false,
      paintCount: 0,
      isBlankOrEmpty: false,
    };

    try {
      const runtime = new Win32WasmRuntime();
      let gdiCalls = 0;

      // Track GDI calls via string logs or overriding runtime logs
      const instance = await runtime.instantiate(wasmBytes);
      if (!instance) {
        res.instantiated = false;
        res.reason = "Failed instantiation";
        res.isBlankOrEmpty = true;
        if (res.isBlankOrEmpty) {
      console.log(`ISSUE: ${res.reason}`);
    } else {
      console.log(`OK (GDI ops: ${res.gdiOpsCount}, children: ${res.childCount})`);
    }

    results.push(res);
        continue;
      }
      res.instantiated = true;

      // Run WinMain
      const code = runtime.runWinMain(0);
      res.exitCode = code;

      // Check windows created
      const win = kernel.windows.find((w) => w.parentHwnd === null);
      if (win) {
        res.windowCreated = true;
        res.windowTitle = win.title;
        res.windowClass = win.className;
        res.childCount = kernel.windows.filter((w) => w.parentHwnd === win.hwnd).length;

        // Try triggering WM_PAINT
        try {
          SendMessage(win.hwnd, WM_PAINT, 0, 0);
          res.paintCount++;
        } catch (e: any) {
          // ignore
        }
      }

      // Check runtime stats
      const stats = runtime.getStats();
      res.gdiOpsCount = stats.stringLogs.length;

      // Evaluate whether the app is blank or displays nothing
      if (!res.windowCreated) {
        // Did it show a MessageBox or dialog?
        const hasDialog = stats.stringLogs.some((l: any) =>
          typeof l === "string" ? (l.includes("MessageBox") || l.includes("DialogBox")) :
          (l?.api?.includes("MessageBox") || l?.api?.includes("DialogBox"))
        );
        if (!hasDialog) {
          res.isBlankOrEmpty = true;
          res.reason = "No top-level window created and no dialog/messagebox shown";
        }
      } else {
        // It created a window. Did it draw anything or add children?
        if (res.childCount === 0 && res.gdiOpsCount === 0) {
          res.isBlankOrEmpty = true;
          res.reason = "Window created but 0 child controls and 0 GDI draw operations";
        }
      }

      runtime.destroy();
    } catch (err: any) {
      res.error = err?.message || String(err);
      res.isBlankOrEmpty = true;
      res.reason = `Runtime exception: ${err?.message || err}`;
    }

    if (res.isBlankOrEmpty) {
      console.log(`ISSUE: ${res.reason}`);
    } else {
      console.log(`OK (GDI ops: ${res.gdiOpsCount}, children: ${res.childCount})`);
    }

    results.push(res);
  }

  const blankApps = results.filter((r) => r.isBlankOrEmpty);
  console.log(`\nAudit completed: ${results.length} total apps, ${blankApps.length} blank/problematic apps.\n`);

  if (blankApps.length > 0) {
    console.log("=== Problematic / Blank Apps ===");
    for (const b of blankApps) {
      console.log(`- ${b.name}: ${b.reason} (Window: ${b.windowTitle || "None"}, Children: ${b.childCount}, GDIOps: ${b.gdiOpsCount})`);
    }
  }

  // Summary of working apps
  const workingApps = results.filter((r) => !r.isBlankOrEmpty);
  console.log(`\nWorking apps: ${workingApps.length}`);
}

auditAllApps().catch(console.error);
