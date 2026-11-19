import type { GUID, IID, CLSID } from "./types";

/**
 * Well-Known COM Interface IDs (IIDs)
 */
export const IID_IUnknown = "{00000000-0000-0000-C000-000000000046}";
export const IID_IClassFactory = "{00000001-0000-0000-C000-000000000046}";
export const IID_IDispatch = "{00020400-0000-0000-C000-000000000046}";
export const IID_IMarshal = "{00000003-0000-0000-C000-000000000046}";

/**
 * Well-Known Sample Server CLSIDs
 */
export const CLSID_CalcEngine = "{3B8A8820-2E24-11D1-A2A9-00A0C9062910}";
export const CLSID_AudioSynthesizer = "{7C9B9930-2E24-11D1-A2A9-00A0C9062920}";
export const CLSID_NotepadDocument = "{9D0C0040-2E24-11D1-A2A9-00A0C9062930}";
export const CLSID_ExplorerVFS = "{AE1D1150-2E24-11D1-A2A9-00A0C9062940}";

/**
 * Normalizes a GUID/IID/CLSID string into {XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX} uppercase.
 */
export function normalizeGuidString(input: string): string {
  const clean = input.replace(/[{}-]/g, "").toUpperCase();
  if (clean.length !== 32) {
    return input.toUpperCase();
  }
  return `{${clean.substring(0, 8)}-${clean.substring(8, 12)}-${clean.substring(12, 16)}-${clean.substring(16, 20)}-${clean.substring(20, 32)}}`;
}

/**
 * Parse a standard GUID string into a binary GUID struct.
 */
export function stringToGuid(guidStr: string): GUID {
  const norm = normalizeGuidString(guidStr).replace(/[{}]/g, "");
  const parts = norm.split("-");
  if (parts.length !== 5) {
    throw new Error(`Invalid GUID string format: ${guidStr}`);
  }

  const d1 = parseInt(parts[0], 16) >>> 0;
  const d2 = parseInt(parts[1], 16) & 0xffff;
  const d3 = parseInt(parts[2], 16) & 0xffff;
  const d4Bytes: number[] = [];

  const part3 = parts[3]; // 4 hex digits (2 bytes)
  d4Bytes.push(parseInt(part3.substring(0, 2), 16));
  d4Bytes.push(parseInt(part3.substring(2, 4), 16));

  const part4 = parts[4]; // 12 hex digits (6 bytes)
  for (let i = 0; i < 6; i++) {
    d4Bytes.push(parseInt(part4.substring(i * 2, i * 2 + 2), 16));
  }

  return {
    Data1: d1,
    Data2: d2,
    Data3: d3,
    Data4: d4Bytes as any,
  };
}

/**
 * Converts a binary GUID struct to standard registry string format.
 */
export function guidToString(guid: GUID): string {
  const hex = (num: number, len: number) => num.toString(16).toUpperCase().padStart(len, "0");
  const d1 = hex(guid.Data1 >>> 0, 8);
  const d2 = hex(guid.Data2, 4);
  const d3 = hex(guid.Data3, 4);
  const d4a = hex(guid.Data4[0], 2) + hex(guid.Data4[1], 2);
  const d4b = guid.Data4.slice(2).map((b) => hex(b, 2)).join("");
  return `{${d1}-${d2}-${d3}-${d4a}-${d4b}}`;
}

/**
 * Check if two GUIDs or GUID strings are equal.
 */
export function guidEquals(a: string | GUID | null | undefined, b: string | GUID | null | undefined): boolean {
  if (!a || !b) return false;
  const sa = typeof a === "string" ? normalizeGuidString(a) : guidToString(a);
  const sb = typeof b === "string" ? normalizeGuidString(b) : guidToString(b);
  return sa === sb;
}

/**
 * Generate a new random pseudo-GUID.
 */
export function createGuid(): string {
  const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1).toUpperCase();
  return `{${s4()}${s4()}-${s4()}-4${s4().substring(1)}-${s4()}-${s4()}${s4()}${s4()}}`;
}
