import menuData from "../../startmenu.json";
import { createActionHandlers } from "./ui/start_menu_utils";
import {
  HKEY_LOCAL_MACHINE,
  HKEY_CURRENT_USER,
  RegOpenKeyEx,
  RegEnumValue,
  RegCloseKey,
} from "./registry";

/**
 * Launch startup applications controlled by startmenu.json (Programs -> StartUp)
 * and/or the Windows Registry (HKLM/HKCU Software\Microsoft\Windows\CurrentVersion\Run).
 */
export async function launchStartupApps(): Promise<void> {
  const handlers = createActionHandlers(() => {}, () => {});
  const launched = new Set<string>();

  // 1. Launch from startmenu.json (Programs -> StartUp group)
  try {
    const programs = (menuData as any[]).find((m) => m.id === "programs");
    const startupGroup = programs?.items?.find((item: any) => item.id === "startup");
    if (startupGroup && Array.isArray(startupGroup.items)) {
      for (const item of startupGroup.items) {
        if (item.action && handlers[item.action]) {
          const key = `${item.action}:${JSON.stringify(item.params || {})}`;
          if (!launched.has(key)) {
            launched.add(key);
            try {
              handlers[item.action](item.params || {});
            } catch (err) {
              console.error(`Failed to launch startup item '${item.id}':`, err);
            }
          }
        }
      }
    }
  } catch (err) {
    console.error("Error reading startup items from startmenu.json:", err);
  }

  // 2. Launch from Registry: HKEY_LOCAL_MACHINE & HKEY_CURRENT_USER Run keys
  for (const hive of [HKEY_LOCAL_MACHINE, HKEY_CURRENT_USER]) {
    const phk = { val: 0 };
    const status = RegOpenKeyEx(hive, "Software\\Microsoft\\Windows\\CurrentVersion\\Run", 0, 0, phk);
    if (status === 0 && phk.val) {
      let index = 0;
      while (true) {
        const valNameOut = { val: "" };
        const typeOut = { val: 0 };
        const dataOut = { val: "" as any };
        const enumStatus = RegEnumValue(phk.val, index, valNameOut, typeOut, dataOut);
        if (enumStatus !== 0) break;
        index++;

        const command = String(dataOut.val || "").trim();
        if (!command || launched.has(command)) continue;
        launched.add(command);

        try {
          if (command.startsWith("wasm:")) {
            const wasmPath = command.slice(5).trim();
            handlers.wasm({ path: wasmPath === "sample_app.wasm" ? undefined : wasmPath, x: 260, y: 90 });
          } else if (command.endsWith(".wasm")) {
            handlers.wasm({ path: command, x: 260, y: 90 });
          } else if (handlers[command]) {
            handlers[command]({});
          }
        } catch (err) {
          console.error(`Failed to launch registry startup command '${command}':`, err);
        }
      }
      RegCloseKey(phk.val);
    }
  }
}
