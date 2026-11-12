#!/usr/bin/env node
import fs from "fs/promises";
import path from "path";
import { compileRc } from "./compiler.ts";

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    console.log(`
Win32 Resource Compiler (rc) for win32-svelte

Usage:
  npx tsx src/rc/cli.ts <input.rc> [options]
  npm run rc -- <input.rc> [options]

Options:
  -o, --output <file>     Output file (.ts or .json). Defaults to stdout or <input>.ts
  --json                  Output compiled resource bundle as JSON
  -I, --include <dir>     Add directory to include search path (can be used multiple times)
  -v, --verbose           Print verbose diagnostic messages
  -h, --help              Show this help message

Examples:
  npx tsx src/rc/cli.ts src/samples/calculator.rc -o src/samples/calculator_rc.ts
  npx tsx src/rc/cli.ts app.rc --json -o app_resources.json
`);
    process.exit(0);
  }

  let inputFile = "";
  let outputFile = "";
  let outputJson = false;
  let verbose = false;
  const includeDirs: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "-o" || arg === "--output") {
      outputFile = args[++i];
    } else if (arg === "--json") {
      outputJson = true;
    } else if (arg === "-v" || arg === "--verbose") {
      verbose = true;
    } else if (arg === "-I" || arg === "--include") {
      includeDirs.push(args[++i]);
    } else if (!arg.startsWith("-")) {
      inputFile = arg;
    }
  }

  if (!inputFile) {
    console.error("Error: No input .rc file specified.");
    process.exit(1);
  }

  const resolvedInput = path.resolve(process.cwd(), inputFile);
  if (verbose) {
    console.log(`Compiling resource script: ${resolvedInput}`);
  }

  let source = "";
  try {
    source = await fs.readFile(resolvedInput, "utf-8");
  } catch (err: any) {
    console.error(`Error reading ${resolvedInput}: ${err.message}`);
    process.exit(1);
  }

  try {
    const result = await compileRc(source, {
      sourcePath: resolvedInput,
      includeDirs,
    });

    const outputContent = outputJson ? result.json : result.code;

    if (outputFile) {
      const resolvedOutput = path.resolve(process.cwd(), outputFile);
      await fs.mkdir(path.dirname(resolvedOutput), { recursive: true });
      await fs.writeFile(resolvedOutput, outputContent, "utf-8");
      if (verbose) {
        console.log(`Successfully compiled to: ${resolvedOutput}`);
        console.log(`Dialogs: ${Object.keys(result.bundle.dialogs).length}`);
        console.log(`Menus: ${Object.keys(result.bundle.menus).length}`);
        console.log(`Strings: ${Object.keys(result.bundle.stringTable).length}`);
      } else {
        console.log(`Compiled ${inputFile} -> ${outputFile}`);
      }
    } else {
      process.stdout.write(outputContent);
    }
  } catch (err: any) {
    console.error(`Compilation failed: ${err.message}`);
    process.exit(1);
  }
}

main();
