#!/usr/bin/env python3
import os
import re
import subprocess
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
HARNESS_SRC = ROOT_DIR / "harness" / "src"
INCLUDE_DIR = ROOT_DIR / "include"
ZIG = "/home/dsv/.local/bin/zig"

def get_chapters():
    chaps = sorted([d for d in HARNESS_SRC.iterdir() if d.is_dir() and d.name.startswith("Chap")])
    return chaps

def scan_project(proj_dir):
    c_files = list(proj_dir.glob("*.c"))
    if not c_files:
        return None

    # Collect includes
    cmd = [
        ZIG, "cc",
        "-target", "wasm32-freestanding",
        "-nostdlib",
        f"-I{INCLUDE_DIR}",
        f"-I{proj_dir}",
        "-fsyntax-only",  # check syntax and headers without linking
        "-Wall"
    ] + [str(f) for f in c_files]

    proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    return {
        "project": proj_dir.name,
        "files": [f.name for f in c_files],
        "returncode": proc.returncode,
        "stderr": proc.stderr
    }

def analyze_errors(stderr_text):
    missing_headers = set(re.findall(r"fatal error: '([^']+)' file not found", stderr_text))
    missing_types = set(re.findall(r"unknown type name '([^']+)'", stderr_text))
    undeclared_funcs = set(re.findall(r"call to undeclared function '([^']+)'", stderr_text))
    undeclared_idents = set(re.findall(r"use of undeclared identifier '([^']+)'", stderr_text))
    
    return {
        "headers": sorted(missing_headers),
        "types": sorted(missing_types),
        "functions": sorted(undeclared_funcs),
        "identifiers": sorted(undeclared_idents)
    }

def scan_chapter(chap_dir):
    projects = sorted([d for d in chap_dir.iterdir() if d.is_dir()])
    results = []
    for p in projects:
        res = scan_project(p)
        if res:
            res["analysis"] = analyze_errors(res["stderr"])
            results.append(res)
    return results

if __name__ == "__main__":
    chaps = get_chapters()
    for chap in chaps:
        print(f"\n==================== {chap.name} ====================")
        res = scan_chapter(chap)
        for r in res:
            print(f"[{r['project']}] -> exit {r['returncode']}")
            a = r["analysis"]
            if a["headers"]:
                print(f"  Missing Headers: {', '.join(a['headers'])}")
            if a["types"]:
                print(f"  Missing Types: {', '.join(a['types'])}")
            if a["functions"]:
                print(f"  Missing Functions: {', '.join(a['functions'])}")
            if a["identifiers"]:
                print(f"  Missing Identifiers: {', '.join(a['identifiers'])}")
