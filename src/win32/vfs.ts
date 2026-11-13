import {
  GENERIC_READ,
  GENERIC_WRITE,
  CREATE_NEW,
  CREATE_ALWAYS,
  OPEN_EXISTING,
  OPEN_ALWAYS,
  TRUNCATE_EXISTING,
  FILE_ATTRIBUTE_READONLY,
  FILE_ATTRIBUTE_HIDDEN,
  FILE_ATTRIBUTE_SYSTEM,
  FILE_ATTRIBUTE_DIRECTORY,
  FILE_ATTRIBUTE_ARCHIVE,
  FILE_ATTRIBUTE_NORMAL,
  FILE_BEGIN,
  FILE_CURRENT,
  FILE_END,
  INVALID_HANDLE_VALUE,
} from "./constants";

import type { HANDLE, WIN32_FIND_DATA, VFSFileInfo } from "./types";
import {
  SAMPLE_APP_C_SOURCE,
  WINDOWS_H_SOURCE,
  WINDEF_H_SOURCE,
  WINUSER_H_SOURCE,
  WINGDI_H_SOURCE,
  WINBASE_H_SOURCE,
  getSampleAppWasmBytes,
} from "../wasm/sample_app_wasm";

// --- OPFS In-Memory Shim for Node.js / Fallback Environments ---
interface MockEntry {
  kind: "file" | "directory";
  name: string;
}

class InMemoryFileHandle {
  readonly kind = "file" as const;
  name: string;
  private data: Uint8Array;
  private lastModified: number;

  constructor(name: string, initialData: Uint8Array = new Uint8Array(), modified = Date.now()) {
    this.name = name;
    this.data = initialData;
    this.lastModified = modified;
  }

  async getFile(): Promise<any> {
    const data = this.data;
    const modified = this.lastModified;
    return {
      name: this.name,
      size: data.byteLength,
      lastModified: modified,
      async arrayBuffer() {
        return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
      },
      async text() {
        return new TextDecoder().decode(data);
      },
    };
  }

  async createWritable(): Promise<any> {
    const chunks: Uint8Array[] = [];
    const self = this;
    return {
      async write(chunk: any) {
        if (typeof chunk === "string") {
          chunks.push(new TextEncoder().encode(chunk));
        } else if (chunk instanceof Uint8Array) {
          chunks.push(chunk);
        } else if (chunk instanceof ArrayBuffer) {
          chunks.push(new Uint8Array(chunk));
        } else if (chunk?.data) {
          const d = chunk.data;
          if (typeof d === "string") chunks.push(new TextEncoder().encode(d));
          else if (d instanceof Uint8Array) chunks.push(d);
          else if (d instanceof ArrayBuffer) chunks.push(new Uint8Array(d));
        }
      },
      async close() {
        const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
        const merged = new Uint8Array(totalLen);
        let offset = 0;
        for (const c of chunks) {
          merged.set(c, offset);
          offset += c.length;
        }
        self.data = merged;
        self.lastModified = Date.now();
      },
    };
  }
}

class InMemoryDirectoryHandle {
  readonly kind = "directory" as const;
  name: string;
  private entriesMap = new Map<string, InMemoryDirectoryHandle | InMemoryFileHandle>();

  constructor(name: string) {
    this.name = name;
  }

  async getDirectoryHandle(name: string, options: { create?: boolean } = {}): Promise<InMemoryDirectoryHandle> {
    const entry = this.entriesMap.get(name);
    if (entry) {
      if (entry.kind !== "directory") {
        throw new Error(`Entry ${name} is a file, not a directory.`);
      }
      return entry as InMemoryDirectoryHandle;
    }
    if (options.create) {
      const dir = new InMemoryDirectoryHandle(name);
      this.entriesMap.set(name, dir);
      return dir;
    }
    throw new Error(`Directory ${name} not found.`);
  }

  async getFileHandle(name: string, options: { create?: boolean } = {}): Promise<InMemoryFileHandle> {
    const entry = this.entriesMap.get(name);
    if (entry) {
      if (entry.kind !== "file") {
        throw new Error(`Entry ${name} is a directory, not a file.`);
      }
      return entry as InMemoryFileHandle;
    }
    if (options.create) {
      const file = new InMemoryFileHandle(name);
      this.entriesMap.set(name, file);
      return file;
    }
    throw new Error(`File ${name} not found.`);
  }

  async removeEntry(name: string, _options?: { recursive?: boolean }): Promise<void> {
    if (!this.entriesMap.has(name)) {
      throw new Error(`Entry ${name} not found.`);
    }
    this.entriesMap.delete(name);
  }

  async *entries(): AsyncIterableIterator<[string, InMemoryDirectoryHandle | InMemoryFileHandle]> {
    for (const entry of this.entriesMap.entries()) {
      yield entry;
    }
  }

  async *values(): AsyncIterableIterator<InMemoryDirectoryHandle | InMemoryFileHandle> {
    for (const val of this.entriesMap.values()) {
      yield val;
    }
  }
}

// --- Active File Handle Record ---
interface FileHandleRecord {
  handle: HANDLE;
  path: string;
  fileHandle: any;
  access: number;
  position: number;
  buffer?: Uint8Array;
}

// --- Find First/Next Handle Record ---
interface FindSearchRecord {
  handle: HANDLE;
  items: WIN32_FIND_DATA[];
  index: number;
}

export type VFSChangeEvent = {
  action: "create" | "write" | "delete" | "rename" | "mkdir" | "rmdir";
  path: string;
};

export class Win32VFS {
  private rootDir: any = null;
  private isMemoryFallback = false;
  private initialized = false;
  private initPromise: Promise<void> | null = null;
  private nextHandle = 1000;
  private openFiles = new Map<HANDLE, FileHandleRecord>();
  private activeFinds = new Map<HANDLE, FindSearchRecord>();
  private changeListeners = new Set<(event: VFSChangeEvent) => void>();

  /**
   * Initializes the Origin Private File System (OPFS) or fallback mock.
   */
  async init(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      if (
        typeof navigator !== "undefined" &&
        navigator.storage &&
        typeof navigator.storage.getDirectory === "function"
      ) {
        try {
          this.rootDir = await navigator.storage.getDirectory();
          this.isMemoryFallback = false;
        } catch (err) {
          console.warn("OPFS navigator.storage.getDirectory failed, falling back to memory shim:", err);
          this.rootDir = new InMemoryDirectoryHandle("root");
          this.isMemoryFallback = true;
        }
      } else {
        this.rootDir = new InMemoryDirectoryHandle("root");
        this.isMemoryFallback = true;
      }

      await this.seedDefaultsIfNeeded();
      this.initialized = true;
    })();

    return this.initPromise;
  }


  getBackendType(): "opfs" | "memory" {
    return this.isMemoryFallback ? "memory" : "opfs";
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Registers a listener for filesystem changes (create, write, delete, etc.)
   */
  addChangeListener(listener: (event: VFSChangeEvent) => void): () => void {
    this.changeListeners.add(listener);
    return () => this.changeListeners.delete(listener);
  }

  notifyChange(action: VFSChangeEvent["action"], path: string): void {
    const event: VFSChangeEvent = { action, path };
    for (const listener of this.changeListeners) {
      try {
        listener(event);
      } catch (e) {
        console.error("VFS change listener error:", e);
      }
    }
  }

  /**
   * Normalizes Win32 paths such as "C:\My Documents\sample_app.c", "C:/INCLUDE", or "test.txt".
   */
  normalizePath(rawPath: string): { drive: string; parts: string[]; fullPath: string } {
    let p = rawPath.replace(/\\/g, "/").trim();
    let drive = "C";

    // Match leading drive letter (e.g., "C:", "A:", "D:")
    const driveMatch = p.match(/^([a-zA-Z]):(.*)$/);
    if (driveMatch) {
      drive = driveMatch[1].toUpperCase();
      p = driveMatch[2];
    }

    // Split segments and filter out '.' and empty parts, resolving '..'
    const rawSegments = p.split("/").filter((s) => s.length > 0 && s !== ".");
    const parts: string[] = [];
    for (const seg of rawSegments) {
      if (seg === "..") {
        if (parts.length > 0) parts.pop();
      } else {
        parts.push(seg);
      }
    }

    const fullPath = `${drive}:\\${parts.join("\\")}`;
    return { drive, parts, fullPath };
  }

  /**
   * Traverses down the OPFS directory tree starting from root down to the target parent directory handle.
   */
  private async getDirectoryHandleForParts(
    drive: string,
    dirParts: string[],
    create = false
  ): Promise<any> {
    await this.ensureInit();

    // The top-level folder inside root is the drive letter (e.g. "C", "A", "D")
    let currentDir = await this.rootDir.getDirectoryHandle(drive, { create });
    for (const part of dirParts) {
      currentDir = await currentDir.getDirectoryHandle(part, { create });
    }
    return currentDir;
  }

  private async ensureInit() {
    if (this.initialized) return;
    if (this.initPromise) {
      await this.initPromise;
    } else {
      await this.init();
    }
  }

  // --- Seed Initial Windows 98 File System ---
  private async seedDefaultsIfNeeded(): Promise<void> {
    const cHandle = await this.rootDir.getDirectoryHandle("C", { create: true });
    try {
      // Check if drive 'C' and 'wasm_application' already exist
      await cHandle.getDirectoryHandle("wasm_application", { create: false });
      return; // Already initialized!
    } catch {
      // Need to seed
    }

    // Default structure and files for Drive C
    const defaultFiles: Record<string, string> = {
      "My Documents/Welcome.txt": "Welcome to win32-svelte with Origin Private File System (OPFS)!\r\n\r\n" +
        "This virtual filesystem is backed by the modern W3C Origin Private File System standard.\r\n" +
        "Features supported:\r\n" +
        "• Native Win32 File APIs (CreateFile, ReadFile, WriteFile, FindFirstFile, etc.)\r\n" +
        "• True persistent browser sandboxed storage (persists across refreshes)\r\n" +
        "• Full drag-and-drop file import from your real host computer\r\n" +
        "• File export/download back to your desktop\r\n" +
        "• Live reactive updates in Windows Explorer\r\n",
      "wasm_application/sample_app.c": SAMPLE_APP_C_SOURCE,
      "wasm_application/windows.h": WINDOWS_H_SOURCE,
      "INCLUDE/windows.h": WINDOWS_H_SOURCE,
      "INCLUDE/windef.h": WINDEF_H_SOURCE,
      "INCLUDE/winuser.h": WINUSER_H_SOURCE,
      "INCLUDE/wingdi.h": WINGDI_H_SOURCE,
      "INCLUDE/winbase.h": WINBASE_H_SOURCE,
    };

    const defaultDirs = [
      "My Documents",
      "wasm_application",
      "INCLUDE",
      "Recycle Bin",
    ];

    // Helper to get or create nested directory inside C
    const getSubDir = async (dirPath: string) => {
      const parts = dirPath.split("/").filter(Boolean);
      let cur = cHandle;
      for (const p of parts) {
        cur = await cur.getDirectoryHandle(p, { create: true });
      }
      return cur;
    };

    // Helper to write file into C
    const writeToC = async (relPath: string, data: Uint8Array | string) => {
      const parts = relPath.split("/").filter(Boolean);
      const fileName = parts.pop()!;
      const dirHandle = await getSubDir(parts.join("/"));
      const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      if (typeof data === "string") {
        await writable.write(new TextEncoder().encode(data));
      } else {
        await writable.write(data);
      }
      await writable.close();
    };

    // Create directories
    for (const dir of defaultDirs) {
      await getSubDir(dir);
    }

    // Write text files
    for (const [relPath, content] of Object.entries(defaultFiles)) {
      await writeToC(relPath, content);
    }

    // Write WASM application binary
    await writeToC("wasm_application/sample_app.wasm", getSampleAppWasmBytes());
  }

  // --- Win32 File APIs (kernel32.dll) ---

  /**
   * Win32 CreateFile API
   */
  async CreateFile(
    lpFileName: string,
    dwDesiredAccess: number = GENERIC_READ | GENERIC_WRITE,
    _dwShareMode: number = 0,
    _lpSecurityAttributes: any = null,
    dwCreationDisposition: number = OPEN_ALWAYS,
    _dwFlagsAndAttributes: number = FILE_ATTRIBUTE_NORMAL,
    _hTemplateFile: any = null
  ): Promise<HANDLE> {
    await this.ensureInit();

    const { drive, parts } = this.normalizePath(lpFileName);
    if (parts.length === 0) {
      return INVALID_HANDLE_VALUE;
    }

    const fileName = parts[parts.length - 1];
    const dirParts = parts.slice(0, parts.length - 1);

    try {
      const dirHandle = await this.getDirectoryHandleForParts(
        drive,
        dirParts,
        dwCreationDisposition === CREATE_ALWAYS || dwCreationDisposition === OPEN_ALWAYS
      );

      let fileHandle: any = null;
      let fileExists = false;

      try {
        fileHandle = await dirHandle.getFileHandle(fileName, { create: false });
        fileExists = true;
      } catch {
        fileExists = false;
      }

      switch (dwCreationDisposition) {
        case CREATE_NEW:
          if (fileExists) return INVALID_HANDLE_VALUE; // File already exists
          fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
          break;
        case CREATE_ALWAYS:
          fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
          // Truncate to 0
          {
            const writable = await fileHandle.createWritable();
            await writable.truncate?.(0);
            await writable.close();
          }
          break;
        case OPEN_EXISTING:
          if (!fileExists) return INVALID_HANDLE_VALUE; // Does not exist
          break;
        case OPEN_ALWAYS:
          if (!fileExists) {
            fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
          }
          break;
        case TRUNCATE_EXISTING:
          if (!fileExists) return INVALID_HANDLE_VALUE;
          {
            const writable = await fileHandle.createWritable();
            await writable.truncate?.(0);
            await writable.close();
          }
          break;
      }

      const hFile = ++this.nextHandle;
      this.openFiles.set(hFile, {
        handle: hFile,
        path: `${drive}:\\${parts.join("\\")}`,
        fileHandle,
        access: dwDesiredAccess,
        position: 0,
      });

      this.notifyChange("create", `${drive}:\\${parts.join("\\")}`);
      return hFile;
    } catch (err) {
      console.warn(`CreateFile failed for "${lpFileName}":`, err);
      return INVALID_HANDLE_VALUE;
    }
  }

  /**
   * Win32 ReadFile API
   */
  async ReadFile(
    hFile: HANDLE,
    nNumberOfBytesToRead?: number
  ): Promise<{ bytesRead: number; buffer: Uint8Array }> {
    const record = this.openFiles.get(hFile);
    if (!record) {
      throw new Error(`Invalid file handle: ${hFile}`);
    }

    const file = await record.fileHandle.getFile();
    const arrayBuffer = await file.arrayBuffer();
    const fullBytes = new Uint8Array(arrayBuffer);

    const startPos = Math.min(record.position, fullBytes.length);
    const readLen = nNumberOfBytesToRead !== undefined
      ? Math.min(nNumberOfBytesToRead, fullBytes.length - startPos)
      : fullBytes.length - startPos;

    const slice = fullBytes.slice(startPos, startPos + readLen);
    record.position += slice.length;

    return {
      bytesRead: slice.length,
      buffer: slice,
    };
  }

  /**
   * Win32 WriteFile API
   */
  async WriteFile(
    hFile: HANDLE,
    data: Uint8Array | string
  ): Promise<{ bytesWritten: number }> {
    const record = this.openFiles.get(hFile);
    if (!record) {
      throw new Error(`Invalid file handle: ${hFile}`);
    }

    const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
    const file = await record.fileHandle.getFile();
    const oldBuffer = new Uint8Array(await file.arrayBuffer());

    // Merge old buffer with new bytes at current position
    const newLen = Math.max(oldBuffer.length, record.position + bytes.length);
    const merged = new Uint8Array(newLen);
    merged.set(oldBuffer, 0);
    merged.set(bytes, record.position);

    const writable = await record.fileHandle.createWritable();
    await writable.write(merged);
    await writable.close();

    record.position += bytes.length;
    this.notifyChange("write", record.path);

    return { bytesWritten: bytes.length };
  }

  /**
   * Win32 SetFilePointer API
   */
  async SetFilePointer(
    hFile: HANDLE,
    lDistanceToMove: number,
    dwMoveMethod: number = FILE_BEGIN
  ): Promise<number> {
    const record = this.openFiles.get(hFile);
    if (!record) return -1;

    const file = await record.fileHandle.getFile();
    const size = file.size;

    let newPos = record.position;
    switch (dwMoveMethod) {
      case FILE_BEGIN:
        newPos = lDistanceToMove;
        break;
      case FILE_CURRENT:
        newPos = record.position + lDistanceToMove;
        break;
      case FILE_END:
        newPos = size + lDistanceToMove;
        break;
    }

    newPos = Math.max(0, newPos);
    record.position = newPos;
    return newPos;
  }

  /**
   * Win32 GetFileSize API
   */
  async GetFileSize(hFile: HANDLE): Promise<number> {
    const record = this.openFiles.get(hFile);
    if (!record) return -1;

    const file = await record.fileHandle.getFile();
    return file.size;
  }

  /**
   * Win32 CloseHandle API
   */
  async CloseHandle(hObject: HANDLE): Promise<boolean> {
    if (this.openFiles.has(hObject)) {
      this.openFiles.delete(hObject);
      return true;
    }
    if (this.activeFinds.has(hObject)) {
      this.activeFinds.delete(hObject);
      return true;
    }
    return false;
  }

  /**
   * Win32 CreateDirectory API
   */
  async CreateDirectory(lpPathName: string): Promise<boolean> {
    await this.ensureInit();
    const { drive, parts } = this.normalizePath(lpPathName);
    try {
      await this.getDirectoryHandleForParts(drive, parts, true);
      this.notifyChange("mkdir", `${drive}:\\${parts.join("\\")}`);
      return true;
    } catch (err) {
      console.warn(`CreateDirectory failed for "${lpPathName}":`, err);
      return false;
    }
  }

  /**
   * Win32 RemoveDirectory API
   */
  async RemoveDirectory(lpPathName: string, recursive = false): Promise<boolean> {
    await this.ensureInit();
    const { drive, parts } = this.normalizePath(lpPathName);
    if (parts.length === 0) return false;

    const targetName = parts[parts.length - 1];
    const parentParts = parts.slice(0, parts.length - 1);

    try {
      const parentHandle = await this.getDirectoryHandleForParts(drive, parentParts, false);
      await parentHandle.removeEntry(targetName, { recursive });
      this.notifyChange("rmdir", `${drive}:\\${parts.join("\\")}`);
      return true;
    } catch (err) {
      console.warn(`RemoveDirectory failed for "${lpPathName}":`, err);
      return false;
    }
  }

  /**
   * Win32 DeleteFile API
   */
  async DeleteFile(lpFileName: string): Promise<boolean> {
    await this.ensureInit();
    const { drive, parts } = this.normalizePath(lpFileName);
    if (parts.length === 0) return false;

    const targetName = parts[parts.length - 1];
    const parentParts = parts.slice(0, parts.length - 1);

    try {
      const parentHandle = await this.getDirectoryHandleForParts(drive, parentParts, false);
      await parentHandle.removeEntry(targetName, { recursive: false });
      this.notifyChange("delete", `${drive}:\\${parts.join("\\")}`);
      return true;
    } catch (err) {
      console.warn(`DeleteFile failed for "${lpFileName}":`, err);
      return false;
    }
  }

  /**
   * Win32 MoveFile API (Rename / Relocate)
   */
  async MoveFile(lpExistingFileName: string, lpNewFileName: string): Promise<boolean> {
    await this.ensureInit();
    try {
      const content = await this.readBinaryFile(lpExistingFileName);
      const writeOk = await this.writeBinaryFile(lpNewFileName, content);
      if (writeOk) {
        await this.DeleteFile(lpExistingFileName);
        this.notifyChange("rename", lpNewFileName);
        return true;
      }
      return false;
    } catch (err) {
      console.warn(`MoveFile failed from "${lpExistingFileName}" to "${lpNewFileName}":`, err);
      return false;
    }
  }

  /**
   * Win32 CopyFile API
   */
  async CopyFile(
    lpExistingFileName: string,
    lpNewFileName: string,
    bFailIfExists = false
  ): Promise<boolean> {
    await this.ensureInit();
    if (bFailIfExists && (await this.FileExists(lpNewFileName))) {
      return false;
    }
    try {
      const content = await this.readBinaryFile(lpExistingFileName);
      return await this.writeBinaryFile(lpNewFileName, content);
    } catch {
      return false;
    }
  }

  /**
   * Win32 FindFirstFile API
   */
  async FindFirstFile(
    lpFileName: string
  ): Promise<{ handle: HANDLE; findData: WIN32_FIND_DATA | null }> {
    await this.ensureInit();
    const { drive, parts } = this.normalizePath(lpFileName);

    let searchPattern = "*";
    let dirParts = parts;

    if (parts.length > 0) {
      const last = parts[parts.length - 1];
      if (last.includes("*") || last.includes("?")) {
        searchPattern = last;
        dirParts = parts.slice(0, parts.length - 1);
      }
    }

    try {
      const entries = await this.getDirectoryEntriesInternal(drive, dirParts);
      const matches: WIN32_FIND_DATA[] = [];

      // Convert searchPattern (e.g. "*.txt", "*", "WIN*") to RegExp
      const regexPattern = new RegExp(
        "^" +
          searchPattern
            .replace(/\./g, "\\.")
            .replace(/\*/g, ".*")
            .replace(/\?/g, ".") +
          "$",
        "i"
      );

      for (const entry of entries) {
        if (regexPattern.test(entry.name)) {
          matches.push({
            dwFileAttributes: entry.attributes,
            cFileName: entry.name,
            nFileSizeHigh: 0,
            nFileSizeLow: entry.size,
            ftCreationTime: entry.modified,
            ftLastWriteTime: entry.modified,
          });
        }
      }

      if (matches.length === 0) {
        return { handle: INVALID_HANDLE_VALUE, findData: null };
      }

      const hFind = ++this.nextHandle;
      this.activeFinds.set(hFind, {
        handle: hFind,
        items: matches,
        index: 1, // first item returned immediately
      });

      return { handle: hFind, findData: matches[0] };
    } catch {
      return { handle: INVALID_HANDLE_VALUE, findData: null };
    }
  }

  /**
   * Win32 FindNextFile API
   */
  async FindNextFile(hFindFile: HANDLE): Promise<WIN32_FIND_DATA | null> {
    const record = this.activeFinds.get(hFindFile);
    if (!record) return null;

    if (record.index < record.items.length) {
      const item = record.items[record.index];
      record.index++;
      return item;
    }
    return null;
  }

  /**
   * Win32 FindClose API
   */
  async FindClose(hFindFile: HANDLE): Promise<boolean> {
    return this.CloseHandle(hFindFile);
  }

  /**
   * Win32 GetFileAttributes API
   */
  async GetFileAttributes(lpFileName: string): Promise<number> {
    await this.ensureInit();
    const { drive, parts } = this.normalizePath(lpFileName);
    if (parts.length === 0) {
      return FILE_ATTRIBUTE_DIRECTORY;
    }

    const name = parts[parts.length - 1];
    const parentParts = parts.slice(0, parts.length - 1);

    try {
      const parentDir = await this.getDirectoryHandleForParts(drive, parentParts, false);

      // Try as directory
      try {
        await parentDir.getDirectoryHandle(name, { create: false });
        return FILE_ATTRIBUTE_DIRECTORY;
      } catch {
        // Try as file
        await parentDir.getFileHandle(name, { create: false });
        return FILE_ATTRIBUTE_NORMAL;
      }
    } catch {
      return -1; // INVALID_FILE_ATTRIBUTES
    }
  }

  /**
   * Returns list of configured drive letters (e.g., ["A:", "C:", "D:"])
   */
  GetLogicalDrives(): string[] {
    return ["A:", "C:", "D:"];
  }

  // --- High-Level Convenience Methods ---

  async FileExists(filePath: string): Promise<boolean> {
    const attr = await this.GetFileAttributes(filePath);
    return attr !== -1 && (attr & FILE_ATTRIBUTE_DIRECTORY) === 0;
  }

  async DirectoryExists(dirPath: string): Promise<boolean> {
    const attr = await this.GetFileAttributes(dirPath);
    return attr !== -1 && (attr & FILE_ATTRIBUTE_DIRECTORY) !== 0;
  }

  async readTextFile(filePath: string): Promise<string> {
    const hFile = await this.CreateFile(filePath, GENERIC_READ, 0, null, OPEN_EXISTING);
    if (hFile === INVALID_HANDLE_VALUE) {
      throw new Error(`Cannot open file for reading: ${filePath}`);
    }
    try {
      const { buffer } = await this.ReadFile(hFile);
      return new TextDecoder().decode(buffer);
    } finally {
      await this.CloseHandle(hFile);
    }
  }

  async writeTextFile(filePath: string, content: string): Promise<boolean> {
    const hFile = await this.CreateFile(filePath, GENERIC_WRITE, 0, null, CREATE_ALWAYS);
    if (hFile === INVALID_HANDLE_VALUE) return false;
    try {
      await this.WriteFile(hFile, content);
      return true;
    } finally {
      await this.CloseHandle(hFile);
    }
  }

  async readBinaryFile(filePath: string): Promise<Uint8Array> {
    const hFile = await this.CreateFile(filePath, GENERIC_READ, 0, null, OPEN_EXISTING);
    if (hFile === INVALID_HANDLE_VALUE) {
      throw new Error(`Cannot open file for reading: ${filePath}`);
    }
    try {
      const { buffer } = await this.ReadFile(hFile);
      return buffer;
    } finally {
      await this.CloseHandle(hFile);
    }
  }

  async writeBinaryFile(filePath: string, content: Uint8Array): Promise<boolean> {
    const hFile = await this.CreateFile(filePath, GENERIC_WRITE, 0, null, CREATE_ALWAYS);
    if (hFile === INVALID_HANDLE_VALUE) return false;
    try {
      await this.WriteFile(hFile, content);
      return true;
    } finally {
      await this.CloseHandle(hFile);
    }
  }

  /**
   * Lists all directory entries for Explorer views.
   */
  async getDirectoryEntries(dirPath: string): Promise<VFSFileInfo[]> {
    await this.ensureInit();
    const { drive, parts } = this.normalizePath(dirPath);
    return this.getDirectoryEntriesInternal(drive, parts);
  }

  private async getDirectoryEntriesInternal(
    drive: string,
    dirParts: string[]
  ): Promise<VFSFileInfo[]> {
    const dirHandle = await this.getDirectoryHandleForParts(drive, dirParts, false);
    const results: VFSFileInfo[] = [];
    const basePath = `${drive}:\\${dirParts.join("\\")}${dirParts.length > 0 ? "\\" : ""}`;

    for await (const [name, handle] of dirHandle.entries()) {
      if (handle.kind === "directory") {
        results.push({
          name,
          path: `${basePath}${name}`,
          isDirectory: true,
          size: 0,
          modified: Date.now(),
          attributes: FILE_ATTRIBUTE_DIRECTORY,
          icon: "📁",
          typeDesc: "File Folder",
        });
      } else if (handle.kind === "file") {
        const file = await handle.getFile();
        const ext = name.includes(".") ? name.split(".").pop()?.toUpperCase() || "" : "";
        results.push({
          name,
          path: `${basePath}${name}`,
          isDirectory: false,
          size: file.size,
          modified: file.lastModified || Date.now(),
          attributes: FILE_ATTRIBUTE_ARCHIVE,
          icon: this.getIconForExt(ext),
          typeDesc: this.getTypeDescForExt(ext),
        });
      }
    }

    // Sort: directories first, then alphabetical
    results.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });

    return results;
  }

  private getIconForExt(ext: string): string {
    switch (ext) {
      case "EXE":
        return "🗂️";
      case "BAT":
      case "COM":
        return "📟";
      case "SYS":
      case "INI":
      case "INF":
        return "⚙️";
      case "TXT":
      case "DOC":
      case "LOG":
        return "📄";
      case "BMP":
      case "ICO":
      case "PNG":
      case "JPG":
        return "🎨";
      case "WAV":
      case "MID":
        return "🎵";
      default:
        return "📄";
    }
  }

  private getTypeDescForExt(ext: string): string {
    switch (ext) {
      case "EXE":
        return "Application";
      case "BAT":
        return "MS-DOS Batch File";
      case "COM":
        return "MS-DOS Application";
      case "SYS":
        return "System file";
      case "INI":
        return "Configuration Settings";
      case "INF":
        return "Setup Information";
      case "TXT":
        return "Text Document";
      case "DOC":
        return "WordPad Document";
      case "LOG":
        return "Text Document";
      case "BMP":
        return "Bitmap Image";
      default:
        return ext ? `${ext} File` : "File";
    }
  }

  /**
   * Triggers a browser download to export a virtual file directly to the user's host OS desktop.
   */
  async exportFileToHost(filePath: string): Promise<void> {
    const data = await this.readBinaryFile(filePath);
    const { parts } = this.normalizePath(filePath);
    const fileName = parts.length > 0 ? parts[parts.length - 1] : "export.bin";

    if (typeof document !== "undefined") {
      const blob = new Blob([data.buffer as ArrayBuffer], { type: "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }

  /**
   * Imports a file dropped from the host OS into a virtual directory.
   */
  async importFileFromHost(
    destDir: string,
    name: string,
    content: Uint8Array | string
  ): Promise<string> {
    const { fullPath } = this.normalizePath(`${destDir}\\${name}`);
    if (typeof content === "string") {
      await this.writeTextFile(fullPath, content);
    } else {
      await this.writeBinaryFile(fullPath, content);
    }
    return fullPath;
  }
}

// Global VFS Singleton
export const vfs = new Win32VFS();
