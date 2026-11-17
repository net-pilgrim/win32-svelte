# 🧪 Simple Win32 C WebAssembly Application

This directory contains a complete, minimal, freestanding C project with a `Makefile` that compiles a native Win32 C application to **WebAssembly (`wasm32-freestanding`)** for execution inside the **`win32-svelte`** sandbox.

---

## 📁 Project Structure

```
examples/simple_c_app/
├── Makefile       # Cross-compiler build automation (Zig CC / Clang)
├── main.c         # Pure C99 Win32 application source code
└── README.md      # Documentation and instructions
```

---

## ⚡ Features Demonstrated

- **Freestanding C (Zero Libc)**: No POSIX emulation or heavyweight C runtime required. Binary size is only **~11 KB**.
- **Standard Win32 Boilerplate**:
  - `WNDCLASSEX` registration via `RegisterClassEx`.
  - Top-level window creation with `CreateWindowEx`.
  - Child control hierarchy (`STATIC`, `BUTTON`).
- **Interactive Message Handling (`WndProc`)**:
  - `WM_CREATE`: Instantiates child buttons and labels; starts a real-time animation timer.
  - `WM_COMMAND`: Handles button clicks (`LOWORD(wParam)`), formats dynamic strings without libc, and updates control labels with `SetWindowText`.
  - `WM_TIMER`: 30 FPS tick updates for real-time procedural animations.
  - `WM_PAINT`: GDI 2D graphics rendering with `BeginPaint`, `FillRect`, `CreateSolidBrush`, `CreatePen`, `SelectObject`, `Rectangle`, `Ellipse`, `TextOut`, and `EndPaint`.
  - `WM_DESTROY`: Clean timer teardown (`KillTimer`) and message loop exit (`PostQuitMessage`).
- **Win32 System Integration**:
  - Message dialogs via `MessageBox`.
  - Synthesized sound effects via `MessageBeep`.

---

## 🛠️ Prerequisites

To compile the application, you need:

1. **GNU Make** (available on Linux, macOS, and Windows via MSYS2/WSL)
2. A C compiler with WebAssembly target support:
   - **[Zig](https://ziglang.org/)** (`zig cc`) – **Recommended** (includes built-in Clang/LLVM cross-compiler out of the box)
   - *or* **LLVM / Clang** (`clang` with `lld`)

---

## 🚀 Building with `make`

Run `make` inside this directory:

```bash
make
```

Output:
```
zig cc -target wasm32-freestanding -nostdlib -I../../include -O2 -Wall main.c -Wl,--no-entry -Wl,--export=WinMain -Wl,--export-table -o simple_app.wasm
Built simple_app.wasm successfully!
-rwxr-xr-x 1 user user 11K simple_app.wasm
```

### Available Make Targets

| Target | Description |
|---|---|
| `make` or `make build` | Compiles `main.c` into `simple_app.wasm` |
| `make clean` | Removes generated `simple_app.wasm` binary |
| `make copy-to-public` | Copies `simple_app.wasm` and `main.c` to `../../public/wasm/` |
| `make help` | Displays available targets and detected compiler |

### Customizing the Compiler or Flags

You can override the compiler or target directly on the command line:

```bash
# Force using clang
make CC=clang TARGET=wasm32-unknown-unknown

# Enable debug symbols
make CFLAGS="-target wasm32-freestanding -nostdlib -I../../include -g -O0"
```

---

## 🔍 Linker and Compiler Flags Explained

| Flag | Purpose |
|---|---|
| `-target wasm32-freestanding` | Compiles for freestanding 32-bit WebAssembly without assuming an operating system or POSIX libc. |
| `-nostdlib` | Excludes standard C runtime libraries (`libc`, `libm`) to keep the resulting WASM binary lightweight (~11 KB). |
| `-I../../include` | Points to the `win32-svelte` Win32 header stubs (`windows.h`, `windef.h`, `winuser.h`, `wingdi.h`, etc.). |
| `-Wl,--no-entry` | Tells the WebAssembly linker that there is no standard `_start` or `main()` entry symbol. |
| `-Wl,--export=WinMain` | Exports `WinMain` as a WebAssembly function export so the browser runtime can invoke it. |
| `-Wl,--export-table` | Exports the WebAssembly indirect function table (`__indirect_function_table`), enabling the TypeScript kernel to dispatch window messages to the C `WndProc` function pointer. |

---

## 🏃 Running in the Browser Sandbox

Once built, you can run `simple_app.wasm` in `win32-svelte` using several methods:

### 1. Drag & Drop into Windows Explorer
Start the web app (`npm run dev`) and open **Windows Explorer**. Drag `simple_app.wasm` from your local file manager directly into the Explorer window. The file will be stored in the virtual filesystem (OPFS) and can be executed with a double-click!

### 2. Programmatic Launch via TypeScript
You can launch the compiled `.wasm` file using the runtime bridge in your TypeScript code:

```typescript
import { StartWasmApp } from "./samples/wasm_app";

// Launch directly from virtual filesystem path
await StartWasmApp(160, 120, "C:\\wasm_application\\simple_app.wasm");
```

### 3. Direct Instantiation via Bytecode
If loading from a `Uint8Array` or network fetch:

```typescript
import { Win32WasmRuntime } from "./win32/wasm_bridge";

const response = await fetch("/wasm/simple_app.wasm");
const wasmBytes = await response.arrayBuffer();

const runtime = new Win32WasmRuntime();
await runtime.instantiate(wasmBytes);
runtime.runWinMain();
```
