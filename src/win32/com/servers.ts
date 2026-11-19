import { DispatchObject } from "./dispatch";
import { MessageBeep } from "../audio";
import { audio } from "../kernel.svelte";
import { vfs } from "../kernel.svelte";

/**
 * Automatable Server: Calc.Engine
 * CLSID: {3B8A8820-2E24-11D1-A2A9-00A0C9062910}
 */
export class CalcEngineServer extends DispatchObject {
  private lastResult = 0;

  public Add(a: number, b: number): number {
    this.lastResult = Number(a) + Number(b);
    return this.lastResult;
  }

  public Subtract(a: number, b: number): number {
    this.lastResult = Number(a) - Number(b);
    return this.lastResult;
  }

  public Multiply(a: number, b: number): number {
    this.lastResult = Number(a) * Number(b);
    return this.lastResult;
  }

  public Divide(a: number, b: number): number {
    if (Number(b) === 0) {
      throw new Error("Division by zero");
    }
    this.lastResult = Number(a) / Number(b);
    return this.lastResult;
  }

  public Eval(expression: string): number {
    // Sanitize arithmetic expression (only numbers, operators, parens, dots, spaces)
    const sanitized = String(expression).replace(/[^0-9+\-*/().\s]/g, "");
    if (!sanitized.trim()) return 0;
    try {
      // Safe math eval via Function
      const fn = new Function(`"use strict"; return (${sanitized});`);
      const val = fn();
      this.lastResult = typeof val === "number" ? val : 0;
      return this.lastResult;
    } catch {
      throw new Error(`Invalid mathematical expression: ${expression}`);
    }
  }

  public GetLastResult(): number {
    return this.lastResult;
  }

  public Clear(): number {
    this.lastResult = 0;
    return 0;
  }
}

/**
 * Automatable Server: Audio.Synthesizer
 * CLSID: {7C9B9930-2E24-11D1-A2A9-00A0C9062920}
 */
export class AudioSynthesizerServer extends DispatchObject {
  public PlayChord(): boolean {
    audio.playChord();
    return true;
  }

  public PlayDing(): boolean {
    audio.playDing();
    return true;
  }

  public PlayChime(): boolean {
    audio.playChime();
    return true;
  }

  public PlayTada(): boolean {
    audio.playTada();
    return true;
  }

  public PlayClick(): boolean {
    audio.playClick();
    return true;
  }

  public Beep(uType = 0): boolean {
    MessageBeep(Number(uType));
    return true;
  }
}

/**
 * Automatable Server: Notepad.Document
 * CLSID: {9D0C0040-2E24-11D1-A2A9-00A0C9062930}
 */
export class NotepadDocumentServer extends DispatchObject {
  private content = "";

  constructor(initialText = "") {
    super();
    this.content = initialText;
  }

  public GetText(): string {
    return this.content;
  }

  public SetText(text: string): boolean {
    this.content = String(text ?? "");
    return true;
  }

  public AppendText(text: string): boolean {
    this.content += String(text ?? "");
    return true;
  }

  public AppendLine(line: string): boolean {
    if (this.content.length > 0 && !this.content.endsWith("\n")) {
      this.content += "\r\n";
    }
    this.content += String(line ?? "") + "\r\n";
    return true;
  }

  public GetLineCount(): number {
    if (!this.content) return 0;
    const trimmed = this.content.endsWith("\n") ? this.content.slice(0, -1).replace(/\r$/, "") : this.content;
    if (!trimmed) return 0;
    return trimmed.split(/\r?\n/).length;
  }

  public Clear(): boolean {
    this.content = "";
    return true;
  }
}

/**
 * Automatable Server: Explorer.VFS
 * CLSID: {AE1D1150-2E24-11D1-A2A9-00A0C9062940}
 */
export class ExplorerVFSServer extends DispatchObject {
  public async GetFiles(dirPath = "C:\\"): Promise<string[]> {
    const entries = await vfs.getDirectoryEntries(dirPath);
    return entries.map((e) => e.name);
  }

  public async ReadFile(filePath: string): Promise<string> {
    const hFile = await vfs.CreateFile(filePath, 0x80000000, 0, 3, 0x80);
    if (hFile === 0) {
      throw new Error(`Failed to open file: ${filePath}`);
    }
    const res = await vfs.ReadFile(hFile, 1024 * 1024);
    await vfs.CloseHandle(hFile);
    return new TextDecoder().decode(res.buffer);
  }

  public async WriteFile(filePath: string, content: string): Promise<number> {
    const hFile = await vfs.CreateFile(filePath, 0x40000000, 0, 2, 0x80);
    if (hFile === 0) {
      throw new Error(`Failed to create file: ${filePath}`);
    }
    const res = await vfs.WriteFile(hFile, content);
    await vfs.CloseHandle(hFile);
    return res.bytesWritten;
  }

  public async DeleteFile(filePath: string): Promise<boolean> {
    return await vfs.DeleteFile(filePath);
  }
}
