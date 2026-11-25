# 🧪 Programming Windows (5th Edition) WebAssembly Test Harness

This directory contains the complete source code from Charles Petzold's classic book **Programming Windows (5th Edition)** (Chapters 01 through 23), compiled to freestanding 32-bit WebAssembly (`wasm32-freestanding`) to serve as a comprehensive integration test harness for `win32-svelte`.

---

## 🎯 Purpose of the Harness

Instead of relying solely on synthetic or mock tests, this harness subjects `win32-svelte` to **150 real-world, authentic Win32 C applications** written between 1996 and 1998 by Charles Petzold.

Every chapter exercises specific subsystems of the Win32 API:
* **Chap 01–04**: Basic message boxes, formatted text output, window classes, `WndProc`, standard system metrics (`GetSystemMetrics`).
* **Chap 05**: GDI drawing primitives (lines, curves, rectangles, ellipses, sine waves).
* **Chap 06–07**: Keyboard and mouse message loops, caret management, hit testing (`Checker`, `Typer`).
* **Chap 08**: Win32 timers and digital clock rendering (`DigClock`, `Beeper`).
* **Chap 09**: Standard child controls (buttons, checkboxes, radio buttons, groupboxes).
* **Chap 10**: Menus, keyboard accelerators, popups, and string tables (`MenuDemo`, `PoePoem`).
* **Chap 11**: Modal and modeless dialog boxes (`About1`, `About2`, `About3`, `HexCalc`).
* **Chap 12**: System clipboard viewing, clipboard chains, and text transfer (`ClipText`, `ClipView`).
* **Chap 13**: Windows printing subsystem and print preview (`Print1`, `Print2`, `Print3`).
* **Chap 14**: Bitmaps, device contexts, raster operations, and BitBlt (`BitBlt`, `Blowup`, `Bounce`).
* **Chap 15–16**: Device-Independent Bitmaps (DIBs), palettes, and palette animation (`ShowDib`, `SysPal`).
* **Chap 17**: TrueType fonts, font metrics, text formatting, and font rotation (`EZTest`, `FontRot`).
* **Chap 18**: Metafiles and 32-bit Enhanced Metafiles (`Emf1`–`Emf13`, `EmfView`).
* **Chap 19**: Multiple Document Interface (MDI) frames and child windows (`MDIDemo`).
* **Chap 20**: Multithreading and worker thread synchronization (`BigJob1`, `BigJob2`, `Multi1`, `RndRctMT`).
* **Chap 21**: Dynamic Link Libraries (`LoadLibrary`, `GetProcAddress`, `EdrTest`, `ShowBit`).
* **Chap 22**: Sound and multimedia (waveform audio, MIDI synthesizer, MCI strings, `BachTocc`, `WakeUp`).
* **Chap 23**: Networking (Winsock 2.0 TCP/UDP sockets, WinINet FTP/HTTP client, `NetTime`, `UpdDemo`).

---

## 🛠️ How It Works

1. **Freestanding Compilation (`wasm32-freestanding`)**:
   Each C source file is compiled with `clang` into freestanding WebAssembly without linking against POSIX or glibc (`-nostdlib`, `-fno-builtin`, `-Wl,--no-entry`).
2. **Win32 C Headers (`include/`)**:
   Applications include standard Win32 headers (`<windows.h>`, `<commctrl.h>`, `<mmsystem.h>`, `<winsock2.h>`, `<wininet.h>`). The prototypes in `include/` annotate Win32 APIs with `__attribute__((import_module("win32"), import_name("...")))`.
3. **Execution in `win32-svelte`**:
   The compiled `.wasm` files reside in `public/wasm-demo/`. When an app is double-clicked in Windows Explorer or launched from the Start Menu, `Win32WasmRuntime` instantiates the module, provides the imports via `wasm_bridge.ts`, and invokes `WinMain()`.

---

## 🏗️ Building the Harness

### Prerequisites
* `clang` (version 14+) with WebAssembly target support (`wasm32-freestanding` or `wasm32-unknown-unknown`).
* `llvm-mc` and `wasm-ld`.
* GNU `make`.
* Python 3.

### Build Commands

```bash
# Build all 150 Petzold applications across Chapters 01 to 23
make all

# Build only a specific chapter (e.g. Chapter 05)
make chap05

# Copy all compiled WASM files and manifests into public/wasm-demo/
make copy-wasm-files

# Clean build artifacts
make clean
```

### Manifest Generation
After building, the manifest script indexes all compiled applications:
```bash
python3 scripts/generate_wasm_manifest.py
```
This generates:
* `public/wasm-demo/manifest.json`: JSON catalog loaded by the web app at runtime.
* `src/wasm/wasm_files_manifest.ts`: Static manifest imported for automated test suites.

---

## 🔍 Auditing Applications

To run the automated headless verification audit across all compiled WASM binaries:
```bash
npx tsx -r ./src/test_setup.cjs scripts/audit_wasm_apps.ts
```
This verifies module instantiation, `WinMain` execution, window registration, child controls, and GDI drawing calls without requiring a visible browser.
