#!/usr/bin/env npx tsx
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.resolve(__dirname, "..");
const HARNESS_SRC = path.join(ROOT_DIR, "harness", "src");
const INCLUDE_DIR = path.join(ROOT_DIR, "include");
const ZIG = "/home/dsv/.local/bin/zig";

function getChapters(): string[] {
  if (!fs.existsSync(HARNESS_SRC)) return [];
  return fs
    .readdirSync(HARNESS_SRC, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name.startsWith("Chap"))
    .map((d) => path.join(HARNESS_SRC, d.name))
    .sort();
}

function scanProject(projDir: string) {
  const cFiles = fs
    .readdirSync(projDir)
    .filter((f) => f.endsWith(".c"))
    .map((f) => path.join(projDir, f));

  if (cFiles.length === 0) return null;

  const args = [
    "cc",
    "-target",
    "wasm32-freestanding",
    "-nostdlib",
    `-I${INCLUDE_DIR}`,
    `-I${projDir}`,
    "-fsyntax-only",
    "-Wall",
    ...cFiles,
  ];

  let returncode = 0;
  let stderr = "";

  try {
    execFileSync(ZIG, args, { stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" });
  } catch (err: any) {
    returncode = err.status ?? 1;
    stderr = err.stderr ?? String(err);
  }

  return {
    project: path.basename(projDir),
    files: cFiles.map((f) => path.basename(f)),
    returncode,
    stderr,
  };
}

function analyzeErrors(stderrText: string) {
  const matchAll = (regex: RegExp) => {
    const set = new Set<string>();
    let m: RegExpExecArray | null;
    while ((m = regex.exec(stderrText)) !== null) {
      set.add(m[1]);
    }
    return Array.from(set).sort();
  };

  return {
    headers: matchAll(/fatal error: '([^']+)' file not found/g),
    types: matchAll(/unknown type name '([^']+)'/g),
    functions: matchAll(/call to undeclared function '([^']+)'/g),
    identifiers: matchAll(/use of undeclared identifier '([^']+)'/g),
  };
}

function scanChapter(chapDir: string) {
  const projects = fs
    .readdirSync(chapDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => path.join(chapDir, d.name))
    .sort();

  const results: any[] = [];
  for (const p of projects) {
    const res = scanProject(p);
    if (res) {
      res.analysis = analyzeErrors(res.stderr);
      results.push(res);
    }
  }
  return results;
}

function main() {
  const chaps = getChapters();
  for (const chap of chaps) {
    console.log(`\n==================== ${path.basename(chap)} ====================`);
    const res = scanChapter(chap);
    for (const r of res) {
      console.log(`[${r.project}] -> exit ${r.returncode}`);
      const a = r.analysis;
      if (a.headers.length) console.log(`  Missing Headers: ${a.headers.join(", ")}`);
      if (a.types.length) console.log(`  Missing Types: ${a.types.join(", ")}`);
      if (a.functions.length) console.log(`  Missing Functions: ${a.functions.join(", ")}`);
      if (a.identifiers.length) console.log(`  Missing Identifiers: ${a.identifiers.join(", ")}`);
    }
  }
}

main();
