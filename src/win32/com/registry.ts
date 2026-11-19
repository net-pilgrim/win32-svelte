import {
  CLSID_CalcEngine,
  CLSID_AudioSynthesizer,
  CLSID_NotepadDocument,
  CLSID_ExplorerVFS,
  normalizeGuidString,
  guidEquals,
} from "./guid";

export interface ComClassRegistration {
  clsid: string;
  progId: string;
  description: string;
  inprocServer?: string;
  threadingModel?: "Apartment" | "Free" | "Both" | "Neutral";
}

class ComRegistry {
  private progIdToClsid = new Map<string, string>();
  private clsidToProgId = new Map<string, string>();
  private classes = new Map<string, ComClassRegistration>();

  constructor() {
    this.registerDefaults();
  }

  private registerDefaults(): void {
    this.registerClass({
      clsid: CLSID_CalcEngine,
      progId: "Calc.Engine",
      description: "Win32 Svelte Procedural Calculator Automation Engine",
      threadingModel: "Apartment",
    });

    this.registerClass({
      clsid: CLSID_AudioSynthesizer,
      progId: "Audio.Synthesizer",
      description: "Windows 98 Procedural Web Audio Sound Synthesizer",
      threadingModel: "Apartment",
    });

    this.registerClass({
      clsid: CLSID_NotepadDocument,
      progId: "Notepad.Document",
      description: "Win32 Notepad Text Automation Document",
      threadingModel: "Apartment",
    });

    this.registerClass({
      clsid: CLSID_ExplorerVFS,
      progId: "Explorer.VFS",
      description: "Win32 Origin Private File System COM Automation",
      threadingModel: "Apartment",
    });
  }

  public registerClass(reg: ComClassRegistration): void {
    const clsidNorm = normalizeGuidString(reg.clsid);
    const progIdNorm = reg.progId.trim();

    this.progIdToClsid.set(progIdNorm.toLowerCase(), clsidNorm);
    this.clsidToProgId.set(clsidNorm, progIdNorm);
    this.classes.set(clsidNorm, { ...reg, clsid: clsidNorm });
  }

  public unregisterClass(clsidOrProgId: string): boolean {
    const clsid = this.CLSIDFromProgID(clsidOrProgId) || normalizeGuidString(clsidOrProgId);
    const progId = this.clsidToProgId.get(clsid);
    if (progId) {
      this.progIdToClsid.delete(progId.toLowerCase());
    }
    this.clsidToProgId.delete(clsid);
    return this.classes.delete(clsid);
  }

  public CLSIDFromProgID(progId: string): string | null {
    if (!progId) return null;
    const lower = progId.trim().toLowerCase();
    if (this.progIdToClsid.has(lower)) {
      return this.progIdToClsid.get(lower)!;
    }
    // If it's already a GUID format string
    if (progId.startsWith("{") && progId.endsWith("}")) {
      return normalizeGuidString(progId);
    }
    return null;
  }

  public ProgIDFromCLSID(clsid: string): string | null {
    if (!clsid) return null;
    const norm = normalizeGuidString(clsid);
    return this.clsidToProgId.get(norm) || null;
  }

  public getClassInfo(clsidOrProgId: string): ComClassRegistration | null {
    const clsid = this.CLSIDFromProgID(clsidOrProgId) || normalizeGuidString(clsidOrProgId);
    return this.classes.get(clsid) || null;
  }

  public getAllClasses(): ComClassRegistration[] {
    return Array.from(this.classes.values());
  }
}

export const comRegistry = new ComRegistry();
