/**
 * Win32 Client-Side Windows Registry Subsystem (advapi32.dll / winreg.h)
 *
 * Implements synchronous Windows Registry storage backed by browser localStorage
 * with in-memory fallback for non-browser/Node.js/SSR environments.
 */

export {
  HKEY_CLASSES_ROOT,
  HKEY_CURRENT_USER,
  HKEY_LOCAL_MACHINE,
  HKEY_USERS,
  HKEY_PERFORMANCE_DATA,
  HKEY_CURRENT_CONFIG,
  HKEY_DYN_DATA,
  REG_NONE,
  REG_SZ,
  REG_EXPAND_SZ,
  REG_BINARY,
  REG_DWORD,
  REG_MULTI_SZ,
  REG_QWORD,
  ERROR_SUCCESS,
  ERROR_FILE_NOT_FOUND,
  ERROR_INVALID_HANDLE,
  ERROR_ACCESS_DENIED,
  ERROR_MORE_DATA,
  ERROR_NO_MORE_ITEMS,
} from "./constants";

import {
  HKEY_CLASSES_ROOT,
  HKEY_CURRENT_USER,
  HKEY_LOCAL_MACHINE,
  HKEY_USERS,
  HKEY_PERFORMANCE_DATA,
  HKEY_CURRENT_CONFIG,
  HKEY_DYN_DATA,
  REG_NONE,
  REG_SZ,
  REG_EXPAND_SZ,
  REG_BINARY,
  REG_DWORD,
  REG_MULTI_SZ,
  REG_QWORD,
  ERROR_SUCCESS,
  ERROR_FILE_NOT_FOUND,
  ERROR_INVALID_HANDLE,
  ERROR_INVALID_PARAMETER,
  ERROR_NO_MORE_ITEMS,
  REG_CREATED_NEW_KEY,
  REG_OPENED_EXISTING_KEY,
  KEY_ALL_ACCESS,
} from "./constants";

export interface RegistryValue {
  type: number;
  data: string | number | Uint8Array | string[];
}

export interface SerializedRegistryNode {
  values?: Record<string, { type: number; data: any }>;
  keys?: Record<string, SerializedRegistryNode>;
}

export class RegistryNode {
  public name: string;
  public subKeys: Map<string, RegistryNode> = new Map();
  public values: Map<string, RegistryValue> = new Map();
  public lastWriteTime: number = Date.now();

  constructor(name: string) {
    this.name = name;
  }

  public getSubKey(subKeyName: string): RegistryNode | undefined {
    const lower = subKeyName.toLowerCase();
    for (const [key, node] of this.subKeys) {
      if (key.toLowerCase() === lower) return node;
    }
    return undefined;
  }

  public getOrCreateSubKey(subKeyName: string): { node: RegistryNode; created: boolean } {
    let existing = this.getSubKey(subKeyName);
    if (existing) {
      return { node: existing, created: false };
    }
    const node = new RegistryNode(subKeyName);
    this.subKeys.set(subKeyName, node);
    this.lastWriteTime = Date.now();
    return { node, created: true };
  }

  public removeSubKey(subKeyName: string): boolean {
    const lower = subKeyName.toLowerCase();
    for (const [key] of this.subKeys) {
      if (key.toLowerCase() === lower) {
        this.subKeys.delete(key);
        this.lastWriteTime = Date.now();
        return true;
      }
    }
    return false;
  }

  public getValue(valueName: string): RegistryValue | undefined {
    const norm = valueName === "" || valueName === "@" ? "(Default)" : valueName;
    const lower = norm.toLowerCase();
    for (const [name, val] of this.values) {
      if (name.toLowerCase() === lower) return val;
    }
    return undefined;
  }

  public setValue(valueName: string, type: number, data: any): void {
    const norm = valueName === "" || valueName === "@" ? "(Default)" : valueName;
    // Remove case-insensitive duplicate if exists
    const lower = norm.toLowerCase();
    for (const [name] of this.values) {
      if (name.toLowerCase() === lower && name !== norm) {
        this.values.delete(name);
      }
    }
    this.values.set(norm, { type, data });
    this.lastWriteTime = Date.now();
  }

  public deleteValue(valueName: string): boolean {
    const norm = valueName === "" || valueName === "@" ? "(Default)" : valueName;
    const lower = norm.toLowerCase();
    for (const [name] of this.values) {
      if (name.toLowerCase() === lower) {
        this.values.delete(name);
        this.lastWriteTime = Date.now();
        return true;
      }
    }
    return false;
  }

  public toJSON(): SerializedRegistryNode {
    const res: SerializedRegistryNode = {};
    if (this.values.size > 0) {
      res.values = {};
      for (const [name, val] of this.values) {
        if (val.data instanceof Uint8Array) {
          res.values[name] = { type: val.type, data: Array.from(val.data) };
        } else {
          res.values[name] = { type: val.type, data: val.data };
        }
      }
    }
    if (this.subKeys.size > 0) {
      res.keys = {};
      for (const [name, node] of this.subKeys) {
        res.keys[name] = node.toJSON();
      }
    }
    return res;
  }

  public static fromJSON(name: string, data: SerializedRegistryNode): RegistryNode {
    const node = new RegistryNode(name);
    if (data.values) {
      for (const [valName, v] of Object.entries(data.values)) {
        let valData = v.data;
        if (v.type === REG_BINARY && Array.isArray(v.data)) {
          valData = new Uint8Array(v.data);
        }
        node.values.set(valName, { type: v.type, data: valData });
      }
    }
    if (data.keys) {
      for (const [keyName, k] of Object.entries(data.keys)) {
        node.subKeys.set(keyName, RegistryNode.fromJSON(keyName, k));
      }
    }
    return node;
  }
}

interface OpenKeyHandle {
  handle: number;
  hive: string;
  path: string;
  node: RegistryNode;
  access: number;
}

const STORAGE_KEY = "win32_registry_v1";

export class Win32Registry {
  private rootHives: Map<string, RegistryNode> = new Map();
  private openHandles: Map<number, OpenKeyHandle> = new Map();
  private nextHandle = 0x1000;
  private changeListeners = new Set<(hive: string, keyPath: string) => void>();
  private saveTimeout: any = null;

  constructor() {
    this.initHives();
    this.loadFromStorage();
  }

  private initHives(): void {
    const hives = [
      "HKEY_CLASSES_ROOT",
      "HKEY_CURRENT_USER",
      "HKEY_LOCAL_MACHINE",
      "HKEY_USERS",
      "HKEY_PERFORMANCE_DATA",
      "HKEY_CURRENT_CONFIG",
      "HKEY_DYN_DATA",
    ];
    for (const hive of hives) {
      this.rootHives.set(hive, new RegistryNode(hive));
    }
    this.seedDefaultRegistry();
  }

  public resolveHiveName(hKey: number | string): string | null {
    if (typeof hKey === "string") {
      const upper = hKey.toUpperCase().trim();
      if (this.rootHives.has(upper)) return upper;
      if (upper === "HKCR") return "HKEY_CLASSES_ROOT";
      if (upper === "HKCU") return "HKEY_CURRENT_USER";
      if (upper === "HKLM") return "HKEY_LOCAL_MACHINE";
      if (upper === "HKU") return "HKEY_USERS";
      if (upper === "HKCC") return "HKEY_CURRENT_CONFIG";
      return null;
    }

    switch (hKey) {
      case HKEY_CLASSES_ROOT:
        return "HKEY_CLASSES_ROOT";
      case HKEY_CURRENT_USER:
        return "HKEY_CURRENT_USER";
      case HKEY_LOCAL_MACHINE:
        return "HKEY_LOCAL_MACHINE";
      case HKEY_USERS:
        return "HKEY_USERS";
      case HKEY_PERFORMANCE_DATA:
        return "HKEY_PERFORMANCE_DATA";
      case HKEY_CURRENT_CONFIG:
        return "HKEY_CURRENT_CONFIG";
      case HKEY_DYN_DATA:
        return "HKEY_DYN_DATA";
      default:
        return null;
    }
  }

  private resolveKey(
    hKey: number | string,
    subPath?: string
  ): { hive: string; fullPath: string; node: RegistryNode } | null {
    let startNode: RegistryNode | null = null;
    let hiveName: string | null = null;
    let basePath = "";

    const rootHive = this.resolveHiveName(hKey);
    if (rootHive) {
      hiveName = rootHive;
      startNode = this.rootHives.get(rootHive) || null;
      basePath = "";
    } else if (typeof hKey === "number" && this.openHandles.has(hKey)) {
      const openHandle = this.openHandles.get(hKey)!;
      hiveName = openHandle.hive;
      startNode = openHandle.node;
      basePath = openHandle.path;
    }

    if (!startNode || !hiveName) return null;

    if (!subPath || subPath.trim() === "" || subPath === ".") {
      return { hive: hiveName, fullPath: basePath, node: startNode };
    }

    const segments = subPath
      .replace(/\//g, "\\")
      .split("\\")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && s !== ".");

    let current = startNode;
    const pathAccum: string[] = basePath ? basePath.split("\\") : [];

    for (const segment of segments) {
      const next = current.getSubKey(segment);
      if (!next) return null;
      current = next;
      pathAccum.push(segment);
    }

    return {
      hive: hiveName,
      fullPath: pathAccum.join("\\"),
      node: current,
    };
  }

  private getOrCreatePath(
    hKey: number | string,
    subPath: string
  ): { hive: string; fullPath: string; node: RegistryNode; created: boolean } | null {
    let startNode: RegistryNode | null = null;
    let hiveName: string | null = null;
    let basePath = "";

    const rootHive = this.resolveHiveName(hKey);
    if (rootHive) {
      hiveName = rootHive;
      startNode = this.rootHives.get(rootHive) || null;
      basePath = "";
    } else if (typeof hKey === "number" && this.openHandles.has(hKey)) {
      const openHandle = this.openHandles.get(hKey)!;
      hiveName = openHandle.hive;
      startNode = openHandle.node;
      basePath = openHandle.path;
    }

    if (!startNode || !hiveName) return null;

    if (!subPath || subPath.trim() === "" || subPath === ".") {
      return { hive: hiveName, fullPath: basePath, node: startNode, created: false };
    }

    const segments = subPath
      .replace(/\//g, "\\")
      .split("\\")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && s !== ".");

    let current = startNode;
    let anyCreated = false;
    const pathAccum: string[] = basePath ? basePath.split("\\") : [];

    for (const segment of segments) {
      const res = current.getOrCreateSubKey(segment);
      if (res.created) anyCreated = true;
      current = res.node;
      pathAccum.push(segment);
    }

    return {
      hive: hiveName,
      fullPath: pathAccum.join("\\"),
      node: current,
      created: anyCreated,
    };
  }

  // --- Seed Defaults ---
  public seedDefaultRegistry(): void {
    const setSeed = (hive: string, path: string, valName: string, type: number, data: any) => {
      const target = this.getOrCreatePath(hive, path);
      if (target) {
        target.node.setValue(valName, type, data);
      }
    };

    // 1. HKEY_CLASSES_ROOT
    setSeed("HKEY_CLASSES_ROOT", ".txt", "", REG_SZ, "txtfile");
    setSeed("HKEY_CLASSES_ROOT", "txtfile", "", REG_SZ, "Text Document");
    setSeed("HKEY_CLASSES_ROOT", "txtfile\\shell\\open\\command", "", REG_SZ, "NOTEPAD.EXE %1");

    setSeed("HKEY_CLASSES_ROOT", ".lua", "", REG_SZ, "luafile");
    setSeed("HKEY_CLASSES_ROOT", "luafile", "", REG_SZ, "Lua 5.3 Script");
    setSeed("HKEY_CLASSES_ROOT", "luafile\\shell\\open\\command", "", REG_SZ, "LUAHOST.EXE %1");

    // COM Classes
    setSeed("HKEY_CLASSES_ROOT", "CLSID\\{3B8A8820-2E24-11D1-A2A9-00A0C9062910}", "", REG_SZ, "Calc.Engine");
    setSeed("HKEY_CLASSES_ROOT", "CLSID\\{3B8A8820-2E24-11D1-A2A9-00A0C9062910}", "ProgID", REG_SZ, "Calc.Engine");

    setSeed("HKEY_CLASSES_ROOT", "CLSID\\{7C9B9930-2E24-11D1-A2A9-00A0C9062920}", "", REG_SZ, "Audio.Synthesizer");
    setSeed("HKEY_CLASSES_ROOT", "CLSID\\{7C9B9930-2E24-11D1-A2A9-00A0C9062920}", "ProgID", REG_SZ, "Audio.Synthesizer");

    setSeed("HKEY_CLASSES_ROOT", "CLSID\\{9D0C0040-2E24-11D1-A2A9-00A0C9062930}", "", REG_SZ, "Notepad.Document");
    setSeed("HKEY_CLASSES_ROOT", "CLSID\\{9D0C0040-2E24-11D1-A2A9-00A0C9062930}", "ProgID", REG_SZ, "Notepad.Document");

    setSeed("HKEY_CLASSES_ROOT", "CLSID\\{AE1D1150-2E24-11D1-A2A9-00A0C9062940}", "", REG_SZ, "Explorer.VFS");
    setSeed("HKEY_CLASSES_ROOT", "CLSID\\{AE1D1150-2E24-11D1-A2A9-00A0C9062940}", "ProgID", REG_SZ, "Explorer.VFS");

    setSeed("HKEY_CLASSES_ROOT", "Calc.Engine\\CLSID", "", REG_SZ, "{3B8A8820-2E24-11D1-A2A9-00A0C9062910}");
    setSeed("HKEY_CLASSES_ROOT", "Audio.Synthesizer\\CLSID", "", REG_SZ, "{7C9B9930-2E24-11D1-A2A9-00A0C9062920}");
    setSeed("HKEY_CLASSES_ROOT", "Notepad.Document\\CLSID", "", REG_SZ, "{9D0C0040-2E24-11D1-A2A9-00A0C9062930}");
    setSeed("HKEY_CLASSES_ROOT", "Explorer.VFS\\CLSID", "", REG_SZ, "{AE1D1150-2E24-11D1-A2A9-00A0C9062940}");

    // 2. HKEY_CURRENT_USER
    setSeed("HKEY_CURRENT_USER", "Control Panel\\Desktop", "Wallpaper", REG_SZ, "");
    setSeed("HKEY_CURRENT_USER", "Control Panel\\Desktop", "TileWallpaper", REG_SZ, "0");
    setSeed("HKEY_CURRENT_USER", "Control Panel\\Desktop", "WallpaperStyle", REG_SZ, "2");
    setSeed("HKEY_CURRENT_USER", "Control Panel\\Desktop", "Pattern", REG_SZ, "(None)");

    setSeed("HKEY_CURRENT_USER", "Control Panel\\Colors", "Background", REG_SZ, "0 128 128");
    setSeed("HKEY_CURRENT_USER", "Control Panel\\Colors", "ActiveTitle", REG_SZ, "0 0 128");
    setSeed("HKEY_CURRENT_USER", "Control Panel\\Colors", "TitleText", REG_SZ, "255 255 255");
    setSeed("HKEY_CURRENT_USER", "Control Panel\\Colors", "Window", REG_SZ, "255 255 255");
    setSeed("HKEY_CURRENT_USER", "Control Panel\\Colors", "WindowText", REG_SZ, "0 0 0");

    setSeed("HKEY_CURRENT_USER", "Control Panel\\Sound", "Beep", REG_SZ, "yes");
    setSeed("HKEY_CURRENT_USER", "Control Panel\\Sound", "ExtendedSounds", REG_SZ, "yes");

    setSeed("HKEY_CURRENT_USER", "Software\\Microsoft\\Windows\\CurrentVersion\\Explorer", "CleanShutdown", REG_DWORD, 1);

    // 3. HKEY_LOCAL_MACHINE
    setSeed("HKEY_LOCAL_MACHINE", "Software\\Microsoft\\Windows\\CurrentVersion", "ProductName", REG_SZ, "Microsoft Windows 98");
    setSeed("HKEY_LOCAL_MACHINE", "Software\\Microsoft\\Windows\\CurrentVersion", "Version", REG_SZ, "4.10.1998");
    setSeed("HKEY_LOCAL_MACHINE", "Software\\Microsoft\\Windows\\CurrentVersion", "VersionNumber", REG_SZ, "4.10.1998");
    setSeed("HKEY_LOCAL_MACHINE", "Software\\Microsoft\\Windows\\CurrentVersion", "RegisteredOwner", REG_SZ, "Retro Enthusiast");
    setSeed("HKEY_LOCAL_MACHINE", "Software\\Microsoft\\Windows\\CurrentVersion", "RegisteredOrganization", REG_SZ, "win32-svelte");
    setSeed("HKEY_LOCAL_MACHINE", "Software\\Microsoft\\Windows\\CurrentVersion", "SystemRoot", REG_SZ, "C:\\WINDOWS");
    setSeed("HKEY_LOCAL_MACHINE", "Software\\Microsoft\\Windows\\CurrentVersion\\Run", "WasmApp", REG_SZ, "wasm:sample_app.wasm");

    setSeed("HKEY_LOCAL_MACHINE", "System\\CurrentControlSet\\Control", "ComputerName", REG_SZ, "WIN98-SVELTE");

    // 4. HKEY_CURRENT_CONFIG
    setSeed("HKEY_CURRENT_CONFIG", "Display\\Settings", "Resolution", REG_SZ, "1024,768");
    setSeed("HKEY_CURRENT_CONFIG", "Display\\Settings", "BitsPerPixel", REG_SZ, "32");
  }

  // --- Persistence ---
  private loadFromStorage(): void {
    if (typeof window === "undefined" || !window.localStorage) return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed: Record<string, SerializedRegistryNode> = JSON.parse(raw);
      for (const [hiveName, data] of Object.entries(parsed)) {
        if (this.rootHives.has(hiveName)) {
          this.rootHives.set(hiveName, RegistryNode.fromJSON(hiveName, data));
        }
      }
    } catch (err) {
      console.warn("Failed to load registry from localStorage:", err);
    }
  }

  public saveToStorage(): void {
    if (typeof window === "undefined" || !window.localStorage) return;
    try {
      const serialized: Record<string, SerializedRegistryNode> = {};
      for (const [hiveName, node] of this.rootHives) {
        serialized[hiveName] = node.toJSON();
      }
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
    } catch (err) {
      console.warn("Failed to save registry to localStorage:", err);
    }
  }

  private scheduleSave(hive: string, keyPath: string): void {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      this.saveToStorage();
    }, 50);

    for (const listener of this.changeListeners) {
      try {
        listener(hive, keyPath);
      } catch (err) {
        console.error("Registry change listener error:", err);
      }
    }
  }

  public addChangeListener(listener: (hive: string, keyPath: string) => void): () => void {
    this.changeListeners.add(listener);
    return () => this.changeListeners.delete(listener);
  }

  // --- Core Win32 Registry APIs ---

  public RegOpenKeyEx(
    hKey: number | string,
    lpSubKey: string,
    _ulOptions = 0,
    samDesired = KEY_ALL_ACCESS,
    phkResult?: { val: number }
  ): number {
    const target = this.resolveKey(hKey, lpSubKey);
    if (!target) {
      if (phkResult) phkResult.val = 0;
      return ERROR_FILE_NOT_FOUND;
    }

    const newHandle = ++this.nextHandle;
    this.openHandles.set(newHandle, {
      handle: newHandle,
      hive: target.hive,
      path: target.fullPath,
      node: target.node,
      access: samDesired,
    });

    if (phkResult) phkResult.val = newHandle;
    return ERROR_SUCCESS;
  }

  public RegCreateKeyEx(
    hKey: number | string,
    lpSubKey: string,
    _Reserved = 0,
    _lpClass = "",
    _dwOptions = 0,
    samDesired = KEY_ALL_ACCESS,
    _lpSecurityAttributes?: any,
    phkResult?: { val: number },
    lpdwDisposition?: { val: number }
  ): number {
    const target = this.getOrCreatePath(hKey, lpSubKey);
    if (!target) {
      if (phkResult) phkResult.val = 0;
      return ERROR_INVALID_HANDLE;
    }

    const newHandle = ++this.nextHandle;
    this.openHandles.set(newHandle, {
      handle: newHandle,
      hive: target.hive,
      path: target.fullPath,
      node: target.node,
      access: samDesired,
    });

    if (phkResult) phkResult.val = newHandle;
    if (lpdwDisposition) {
      lpdwDisposition.val = target.created ? REG_CREATED_NEW_KEY : REG_OPENED_EXISTING_KEY;
    }

    if (target.created) {
      this.scheduleSave(target.hive, target.fullPath);
    }

    return ERROR_SUCCESS;
  }

  public RegCloseKey(hKey: number): number {
    if (typeof hKey !== "number") return ERROR_INVALID_HANDLE;
    // Check if it's a predefined root hive pseudo-handle
    if (this.resolveHiveName(hKey)) return ERROR_SUCCESS;

    if (this.openHandles.has(hKey)) {
      this.openHandles.delete(hKey);
      return ERROR_SUCCESS;
    }
    return ERROR_INVALID_HANDLE;
  }

  public RegQueryValueEx(
    hKey: number | string,
    lpValueName: string,
    _lpReserved?: any,
    lpType?: { val: number },
    lpData?: { val: any },
    lpcbData?: { val: number }
  ): number {
    const target = this.resolveKey(hKey);
    if (!target) return ERROR_INVALID_HANDLE;

    const val = target.node.getValue(lpValueName || "");
    if (!val) return ERROR_FILE_NOT_FOUND;

    if (lpType) lpType.val = val.type;
    if (lpData) lpData.val = val.data;
    if (lpcbData) {
      if (typeof val.data === "string") {
        lpcbData.val = val.data.length + 1;
      } else if (typeof val.data === "number") {
        lpcbData.val = 4;
      } else if (val.data instanceof Uint8Array) {
        lpcbData.val = val.data.byteLength;
      } else {
        lpcbData.val = 0;
      }
    }

    return ERROR_SUCCESS;
  }

  public RegSetValueEx(
    hKey: number | string,
    lpValueName: string,
    _Reserved = 0,
    dwType = REG_SZ,
    lpData: any = "",
    _cbData?: number
  ): number {
    const target = this.resolveKey(hKey);
    if (!target) return ERROR_INVALID_HANDLE;

    target.node.setValue(lpValueName || "", dwType, lpData);
    this.scheduleSave(target.hive, target.fullPath);
    return ERROR_SUCCESS;
  }

  public RegDeleteValue(hKey: number | string, lpValueName: string): number {
    const target = this.resolveKey(hKey);
    if (!target) return ERROR_INVALID_HANDLE;

    const ok = target.node.deleteValue(lpValueName || "");
    if (!ok) return ERROR_FILE_NOT_FOUND;

    this.scheduleSave(target.hive, target.fullPath);
    return ERROR_SUCCESS;
  }

  public RegDeleteKey(hKey: number | string, lpSubKey: string): number {
    if (!lpSubKey) return ERROR_INVALID_PARAMETER;

    const parts = lpSubKey.replace(/\//g, "\\").split("\\");
    const childName = parts.pop()!;
    const parentPath = parts.join("\\");

    const parent = this.resolveKey(hKey, parentPath);
    if (!parent) return ERROR_FILE_NOT_FOUND;

    const ok = parent.node.removeSubKey(childName);
    if (!ok) return ERROR_FILE_NOT_FOUND;

    this.scheduleSave(parent.hive, parent.fullPath);
    return ERROR_SUCCESS;
  }

  public RegEnumKeyEx(
    hKey: number | string,
    dwIndex: number,
    lpName?: { val: string }
  ): number {
    const target = this.resolveKey(hKey);
    if (!target) return ERROR_INVALID_HANDLE;

    const keys = Array.from(target.node.subKeys.keys());
    if (dwIndex < 0 || dwIndex >= keys.length) {
      return ERROR_NO_MORE_ITEMS;
    }

    if (lpName) lpName.val = keys[dwIndex];
    return ERROR_SUCCESS;
  }

  public RegEnumValue(
    hKey: number | string,
    dwIndex: number,
    lpValueName?: { val: string },
    lpType?: { val: number },
    lpData?: { val: any }
  ): number {
    const target = this.resolveKey(hKey);
    if (!target) return ERROR_INVALID_HANDLE;

    const entries = Array.from(target.node.values.entries());
    if (dwIndex < 0 || dwIndex >= entries.length) {
      return ERROR_NO_MORE_ITEMS;
    }

    const [valName, val] = entries[dwIndex];
    if (lpValueName) lpValueName.val = valName === "(Default)" ? "" : valName;
    if (lpType) lpType.val = val.type;
    if (lpData) lpData.val = val.data;

    return ERROR_SUCCESS;
  }

  // --- Convenience Getters & Setters ---

  public getString(hKey: number | string, subKey: string, valueName = "", defaultValue = ""): string {
    const phk = { val: 0 };
    if (this.RegOpenKeyEx(hKey, subKey, 0, KEY_ALL_ACCESS, phk) === ERROR_SUCCESS) {
      const data = { val: null as any };
      const res = this.RegQueryValueEx(phk.val, valueName, 0, undefined, data);
      this.RegCloseKey(phk.val);
      if (res === ERROR_SUCCESS && typeof data.val === "string") {
        return data.val;
      }
    }
    return defaultValue;
  }

  public setString(hKey: number | string, subKey: string, valueName: string, value: string): void {
    const phk = { val: 0 };
    if (this.RegCreateKeyEx(hKey, subKey, 0, "", 0, KEY_ALL_ACCESS, undefined, phk) === ERROR_SUCCESS) {
      this.RegSetValueEx(phk.val, valueName, 0, REG_SZ, value);
      this.RegCloseKey(phk.val);
    }
  }

  public getDword(hKey: number | string, subKey: string, valueName = "", defaultValue = 0): number {
    const phk = { val: 0 };
    if (this.RegOpenKeyEx(hKey, subKey, 0, KEY_ALL_ACCESS, phk) === ERROR_SUCCESS) {
      const data = { val: null as any };
      const res = this.RegQueryValueEx(phk.val, valueName, 0, undefined, data);
      this.RegCloseKey(phk.val);
      if (res === ERROR_SUCCESS && typeof data.val === "number") {
        return data.val;
      }
    }
    return defaultValue;
  }

  public setDword(hKey: number | string, subKey: string, valueName: string, value: number): void {
    const phk = { val: 0 };
    if (this.RegCreateKeyEx(hKey, subKey, 0, "", 0, KEY_ALL_ACCESS, undefined, phk) === ERROR_SUCCESS) {
      this.RegSetValueEx(phk.val, valueName, 0, REG_DWORD, value);
      this.RegCloseKey(phk.val);
    }
  }

  // --- Root Hive Direct Access ---
  public getRootHive(name: string): RegistryNode | undefined {
    const norm = this.resolveHiveName(name);
    return norm ? this.rootHives.get(norm) : undefined;
  }

  public getAllHives(): string[] {
    return Array.from(this.rootHives.keys());
  }

  public RegSaveKey(hKey: number | string, _lpFile?: string): string {
    return this.RegExport(hKey);
  }

  public RegRestoreKey(_hKey: number | string, regContent: string): boolean {
    const res = this.RegImport(regContent);
    return res.importedValues > 0 || res.importedKeys > 0;
  }

  // --- .REG Export & Import ---

  public RegExport(rootHiveOrKey?: string | number): string {
    const lines: string[] = ["Windows Registry Editor Version 5.00", ""];

    const hivesToExport: string[] = rootHiveOrKey
      ? [this.resolveHiveName(rootHiveOrKey) || String(rootHiveOrKey)]
      : ["HKEY_LOCAL_MACHINE", "HKEY_CURRENT_USER", "HKEY_CLASSES_ROOT", "HKEY_CURRENT_CONFIG"];

    const serializeKey = (fullPath: string, node: RegistryNode) => {
      lines.push(`[${fullPath}]`);

      for (const [vName, val] of node.values) {
        const keyPrefix = vName === "(Default)" || vName === "" ? "@" : `"${vName.replace(/"/g, '\\"')}"`;

        if (val.type === REG_SZ || val.type === REG_EXPAND_SZ) {
          const esc = String(val.data).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
          lines.push(`${keyPrefix}="${esc}"`);
        } else if (val.type === REG_DWORD) {
          const hex = (Number(val.data) >>> 0).toString(16).padStart(8, "0");
          lines.push(`${keyPrefix}=dword:${hex}`);
        } else if (val.type === REG_BINARY) {
          let bytes: number[] = [];
          if (val.data instanceof Uint8Array) {
            bytes = Array.from(val.data);
          } else if (Array.isArray(val.data)) {
            bytes = val.data.map(Number);
          }
          const hexBytes = bytes.map((b) => (b >>> 0).toString(16).padStart(2, "0")).join(",");
          lines.push(`${keyPrefix}=hex:${hexBytes}`);
        } else {
          lines.push(`${keyPrefix}="${String(val.data)}"`);
        }
      }

      lines.push("");

      for (const [subName, subNode] of node.subKeys) {
        serializeKey(`${fullPath}\\${subName}`, subNode);
      }
    };

    for (const hiveName of hivesToExport) {
      const rootNode = this.rootHives.get(hiveName);
      if (rootNode) {
        for (const [subName, subNode] of rootNode.subKeys) {
          serializeKey(`${hiveName}\\${subName}`, subNode);
        }
      }
    }

    return lines.join("\r\n");
  }

  public RegImport(regContent: string): { importedKeys: number; importedValues: number } {
    let importedKeys = 0;
    let importedValues = 0;

    let currentHive: string | null = null;
    let currentPath = "";
    let currentNode: RegistryNode | null = null;

    const lines = regContent.split(/\r?\n/);

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith(";") || line.startsWith("#") || line.startsWith("Windows Registry Editor") || line.startsWith("REGEDIT4")) {
        continue;
      }

      // Key header: [HKEY_LOCAL_MACHINE\Software\...]
      if (line.startsWith("[") && line.endsWith("]")) {
        const fullHeader = line.slice(1, -1).trim();
        // Check for key deletion: [-HKEY_...]
        if (fullHeader.startsWith("-")) {
          const delPath = fullHeader.slice(1).trim();
          const firstSlash = delPath.indexOf("\\");
          if (firstSlash !== -1) {
            const hive = delPath.slice(0, firstSlash);
            const sub = delPath.slice(firstSlash + 1);
            this.RegDeleteKey(hive, sub);
          }
          currentNode = null;
          continue;
        }

        const firstSlash = fullHeader.indexOf("\\");
        if (firstSlash === -1) {
          currentHive = this.resolveHiveName(fullHeader);
          currentPath = "";
          currentNode = currentHive ? this.rootHives.get(currentHive) || null : null;
        } else {
          currentHive = this.resolveHiveName(fullHeader.slice(0, firstSlash));
          currentPath = fullHeader.slice(firstSlash + 1);
          if (currentHive) {
            const res = this.getOrCreatePath(currentHive, currentPath);
            currentNode = res ? res.node : null;
            if (currentNode) importedKeys++;
          }
        }
        continue;
      }

      if (!currentNode || !currentHive) continue;

      // Value assignment: "@"="...", "Name"="...", "Name"=dword:00000001, "Name"=hex:...
      const eqIdx = line.indexOf("=");
      if (eqIdx === -1) continue;

      const left = line.slice(0, eqIdx).trim();
      const right = line.slice(eqIdx + 1).trim();

      let valName = "";
      if (left === "@") {
        valName = "";
      } else if (left.startsWith('"') && left.endsWith('"')) {
        valName = left.slice(1, -1).replace(/\\"/g, '"');
      } else {
        valName = left;
      }

      // Check for value deletion: "ValueName"=-
      if (right === "-") {
        currentNode.deleteValue(valName);
        continue;
      }

      if (right.startsWith('"') && right.endsWith('"')) {
        // String REG_SZ
        const strVal = right.slice(1, -1).replace(/\\\\/g, "\\").replace(/\\"/g, '"');
        currentNode.setValue(valName, REG_SZ, strVal);
        importedValues++;
      } else if (right.startsWith("dword:")) {
        // DWORD REG_DWORD
        const hexStr = right.slice(6).trim();
        const numVal = parseInt(hexStr, 16) || 0;
        currentNode.setValue(valName, REG_DWORD, numVal);
        importedValues++;
      } else if (right.startsWith("hex:")) {
        // Binary REG_BINARY
        const hexParts = right.slice(4).split(",").map((s) => parseInt(s.trim(), 16) || 0);
        const bytes = new Uint8Array(hexParts);
        currentNode.setValue(valName, REG_BINARY, bytes);
        importedValues++;
      }
    }

    this.saveToStorage();
    return { importedKeys, importedValues };
  }
}

export const registry = new Win32Registry();

// Export standard Win32 C API wrappers
export const RegOpenKeyEx = registry.RegOpenKeyEx.bind(registry);
export const RegCreateKeyEx = registry.RegCreateKeyEx.bind(registry);
export const RegCloseKey = registry.RegCloseKey.bind(registry);
export const RegQueryValueEx = registry.RegQueryValueEx.bind(registry);
export const RegSetValueEx = registry.RegSetValueEx.bind(registry);
export const RegDeleteValue = registry.RegDeleteValue.bind(registry);
export const RegDeleteKey = registry.RegDeleteKey.bind(registry);
export const RegEnumKeyEx = registry.RegEnumKeyEx.bind(registry);
export const RegEnumValue = registry.RegEnumValue.bind(registry);
export const RegSaveKey = registry.RegSaveKey.bind(registry);
export const RegRestoreKey = registry.RegRestoreKey.bind(registry);
export const RegExport = registry.RegExport.bind(registry);
export const RegImport = registry.RegImport.bind(registry);
