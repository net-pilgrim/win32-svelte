#!/usr/bin/env npx tsx
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.resolve(__dirname, "..");
const BUILD_DIR = path.join(ROOT_DIR, "harness", "build");
const PUBLIC_DIR = path.join(ROOT_DIR, "public", "wasm-demo");
const SRC_DIR = path.join(ROOT_DIR, "harness", "src");

fs.mkdirSync(PUBLIC_DIR, { recursive: true });

function walkDir(dir: string, callback: (filePath: string) => void) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath, callback);
    } else {
      callback(fullPath);
    }
  }
}

// Map binary name to source path
const binToSrc = new Map<string, string>();
walkDir(SRC_DIR, (filePath) => {
  if (filePath.endsWith(".c")) {
    const parent = path.basename(path.dirname(filePath));
    const binName = `${parent}.wasm`;
    binToSrc.set(binName, filePath);
  }
});

const EMF_DESCRIPTIONS: Record<string, string> = {
  "emf2.emf": "EMF Demo 2 - Vector Cross & Rectangle",
  "emf3.emf": "EMF Demo 3 - Colored Vector Cross & Pen",
  "emf4.emf": "EMF Demo 4 - Vector Stretch Image",
  "emf7.emf": "EMF Demo 7 - Transformed Vector Metafile",
  "emf8.emf": "EMF Demo 8 - Vector Inch Ruler with Text & Ticks",
  "emf11.emf": "EMF Demo 11 - Metric Ruler Vector Metafile",
  "emf12.emf": "EMF Demo 12 - Inch Ruler Vector Metafile",
};

export interface WasmManifestEntry {
  name: string;
  size: number;
  chapter: string;
  description: string;
}

const entries: WasmManifestEntry[] = [];
const publicFiles = fs.readdirSync(PUBLIC_DIR).sort();

for (const f of publicFiles) {
  if (!f.endsWith(".wasm") && !f.endsWith(".emf") && !f.endsWith(".wmf")) {
    continue;
  }
  const p = path.join(PUBLIC_DIR, f);
  const size = fs.statSync(p).size;

  let chap = "";
  let desc = "";

  if (f.endsWith(".emf") || f.endsWith(".wmf")) {
    chap = "Chap18";
    desc =
      EMF_DESCRIPTIONS[f] ||
      (f.endsWith(".emf") ? "Enhanced Metafile Vector Image" : "Windows Metafile Vector Image");
  } else {
    const srcFile = binToSrc.get(f);
    if (srcFile) {
      const m = srcFile.match(/Chap\d+/);
      if (m) {
        chap = m[0];
      } else if (srcFile.includes("/Wine/") || srcFile.includes("\\Wine\\")) {
        chap = "Wine";
      }
    }

    if (!chap && fs.existsSync(BUILD_DIR)) {
      walkDir(BUILD_DIR, (bf) => {
        if (path.basename(bf) === f) {
          const m = bf.match(/Chap\d+/);
          if (m) {
            chap = m[0];
          } else if (bf.includes("/Wine/") || bf.includes("\\Wine\\")) {
            chap = "Wine";
          }
        }
      });
    }

    if (srcFile && fs.existsSync(srcFile)) {
      const content = fs.readFileSync(srcFile, "latin1");
      const tm = content.match(/TEXT\s*\(\s*\"([^\"]+)\"\s*\)/);
      if (tm) {
        desc = tm[1];
      }
    }
  }

  entries.push({
    name: f,
    size,
    chapter: chap || "Win32",
    description: desc || (f.endsWith(".emf") || f.endsWith(".wmf") ? f.slice(0, -4) : f.slice(0, -5)),
  });
}

const manifestJsonPath = path.join(PUBLIC_DIR, "manifest.json");
fs.writeFileSync(manifestJsonPath, JSON.stringify(entries, null, 2) + "\n");

const tsContent = `// Auto-generated WASM files manifest - DO NOT EDIT MANUALLY
export interface WasmManifestEntry {
  name: string;
  size: number;
  chapter: string;
  description: string;
}

export const WASM_FILES_MANIFEST: WasmManifestEntry[] = ${JSON.stringify(entries, null, 2)};
`;

const tsPath = path.join(ROOT_DIR, "src", "wasm", "wasm_files_manifest.ts");
fs.writeFileSync(tsPath, tsContent);

console.log(
  `✓ Generated ${entries.length} WASM manifest entries in public/wasm-demo/manifest.json and src/wasm/wasm_files_manifest.ts`
);
