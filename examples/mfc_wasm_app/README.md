# 📐 C++ MFC WebAssembly Application

This directory contains a complete, freestanding **C++ Microsoft Foundation Classes (MFC)** application targeting WebAssembly (`wasm32-freestanding`). It compiles classic C++ object-oriented Win32 code directly into a `.wasm` binary using a `Makefile` and `zig c++` or `clang++`.

---

## 📁 File Structure

```
examples/mfc_wasm_app/
├── Makefile       # Multi-compiler build automation (Zig C++ / Clang++)
├── main.cpp       # Pure C++ MFC application source code
└── README.md      # Build and architecture documentation
```

---

## 🏛️ Features Demonstrated

- **Freestanding C++ (Zero Libc)**: No POSIX emulation or heavyweight runtime dependencies.
- **Classic MFC Class Hierarchy**:
  - `CObject`: Root object with runtime class identification.
  - `CCmdTarget`: Command and message routing target.
  - `CWnd`: Window encapsulation (`m_hWnd`, `ShowWindow`, `UpdateWindow`, `SetWindowText`, `Invalidate`).
  - `CFrameWnd`: SDI frame window creation (`Create`).
  - `CPaintDC`: RAII-scoped `BeginPaint` / `EndPaint` wrapper with GDI drawing methods (`Rectangle`, `Ellipse`, `TextOut`, `FillRect`).
  - `CWinApp`: Global application object managing `InitInstance()`.
- **Interactive Controls & Events**:
  - `BUTTON` and `STATIC` child controls.
  - State management responding to `WM_COMMAND`.
  - System message boxes (`MessageBoxA`) and alert beeps (`MessageBeep`).

---

## 🛠️ Prerequisites

1. **GNU Make**
2. C++ Compiler with WebAssembly backend:
   - **[Zig](https://ziglang.org/)** (`zig c++`) – **Recommended**
   - *or* **Clang++** (`clang++` with `lld`)

---

## 🚀 Building with `make`

Run `make` inside this directory:

```bash
make
```

Output:
```
zig c++ -target wasm32-freestanding -nostdlib -fno-exceptions -fno-rtti -I../../include -O2 -Wall main.cpp -Wl,--no-entry -Wl,--export=WinMain -Wl,--export-table -o mfc_app.wasm
Built mfc_app.wasm successfully!
-rwxr-xr-x 1 user user 15K mfc_app.wasm
```

### Makefile Targets

| Target | Command | Purpose |
|---|---|---|
| `all` / `build` | `make` | Compiles `main.cpp` into `mfc_app.wasm` |
| `clean` | `make clean` | Removes generated `.wasm` binary |
| `copy-to-public` | `make copy-to-public` | Copies binary and source to `../../public/wasm/` |
| `help` | `make help` | Displays compiler information and targets |

---

## 🔍 Compiler Flags Explained

| Flag | Purpose |
|---|---|
| `-target wasm32-freestanding` | Emits 32-bit WebAssembly without host OS or libc assumptions. |
| `-nostdlib` | Omits standard C/C++ runtimes to keep output compact (~15 KB). |
| `-fno-exceptions -fno-rtti` | Disables C++ exception tables and heavyweight runtime type information. |
| `-I../../include` | Includes `afxwin.h` and Win32 header stubs. |
| `-Wl,--no-entry` | Tells the linker no `_start` or `main()` is required. |
| `-Wl,--export=WinMain` | Exports `WinMain` entry point for execution. |
| `-Wl,--export-table` | Exports `__indirect_function_table` so JavaScript can dispatch window messages to `MfcWndProc`. |

---

## 🏃 Running in the Browser Sandbox

1. **Windows Explorer**: Start `win32-svelte` (`npm run dev`) and drag `mfc_app.wasm` into Explorer to store in the virtual filesystem and double-click to run.
2. **TypeScript Runtime**:
   ```typescript
   import { StartWasmApp } from "./samples/wasm_app";
   await StartWasmApp(160, 100, "C:\\wasm_application\\mfc_app.wasm");
   ```
