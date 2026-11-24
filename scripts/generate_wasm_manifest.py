#!/usr/bin/env python3
import os
import json
import re

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUILD_DIR = os.path.join(ROOT_DIR, 'harness', 'build')
PUBLIC_DIR = os.path.join(ROOT_DIR, 'public', 'wasm-files')
SRC_DIR = os.path.join(ROOT_DIR, 'harness', 'src')

os.makedirs(PUBLIC_DIR, exist_ok=True)

# Map binary name to source path
bin_to_src = {}
for root, dirs, files in os.walk(SRC_DIR):
    for f in files:
        if f.endswith('.c'):
            parent = os.path.basename(root)
            bin_name = parent + '.wasm'
            bin_to_src[bin_name] = os.path.join(root, f)

EMF_DESCRIPTIONS = {
    'emf2.emf': 'EMF Demo 2 - Vector Cross & Rectangle',
    'emf3.emf': 'EMF Demo 3 - Colored Vector Cross & Pen',
    'emf4.emf': 'EMF Demo 4 - Vector Stretch Image',
    'emf7.emf': 'EMF Demo 7 - Transformed Vector Metafile',
    'emf8.emf': 'EMF Demo 8 - Vector Inch Ruler with Text & Ticks',
    'emf11.emf': 'EMF Demo 11 - Metric Ruler Vector Metafile',
    'emf12.emf': 'EMF Demo 12 - Inch Ruler Vector Metafile',
}

entries = []
for f in sorted(os.listdir(PUBLIC_DIR)):
    if not (f.endswith('.wasm') or f.endswith('.emf') or f.endswith('.wmf')):
        continue
    p = os.path.join(PUBLIC_DIR, f)
    size = os.path.getsize(p)

    if f.endswith('.emf') or f.endswith('.wmf'):
        chap = 'Chap18'
        desc = EMF_DESCRIPTIONS.get(f, 'Enhanced Metafile Vector Image' if f.endswith('.emf') else 'Windows Metafile Vector Image')
    else:
        chap = ''
        src_file = bin_to_src.get(f)
        if src_file:
            m = re.search(r'Chap\d+', src_file)
            if m:
                chap = m.group(0)
        if not chap:
            for r, ds, fs in os.walk(BUILD_DIR):
                if f in fs:
                    m = re.search(r'Chap\d+', r)
                    if m:
                        chap = m.group(0)
                    break

        desc = ''
        if src_file and os.path.exists(src_file):
            with open(src_file, 'r', encoding='latin-1') as sfp:
                content = sfp.read()
                tm = re.search(r'TEXT\s*\(\s*\"([^\"]+)\"\s*\)', content)
                if tm:
                    desc = tm.group(1)

    entries.append({
        'name': f,
        'size': size,
        'chapter': chap or 'Win32',
        'description': desc or (f[:-4] if f.endswith('.emf') or f.endswith('.wmf') else f[:-5])
    })

manifest_json_path = os.path.join(PUBLIC_DIR, 'manifest.json')
with open(manifest_json_path, 'w') as jf:
    json.dump(entries, jf, indent=2)

ts_content = f"""// Auto-generated WASM files manifest - DO NOT EDIT MANUALLY
export interface WasmManifestEntry {{
  name: string;
  size: number;
  chapter: string;
  description: string;
}}

export const WASM_FILES_MANIFEST: WasmManifestEntry[] = {json.dumps(entries, indent=2)};
"""

ts_path = os.path.join(ROOT_DIR, 'src', 'wasm', 'wasm_files_manifest.ts')
with open(ts_path, 'w') as tf:
    tf.write(ts_content)

print(f"✓ Generated {len(entries)} WASM manifest entries in public/wasm-files/manifest.json and src/wasm/wasm_files_manifest.ts")
