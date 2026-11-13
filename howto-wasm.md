# 🚀 Building WebAssembly Applications for win32-svelte

This guide explains how to write, compile, and run native C Win32 applications inside **win32-svelte** using WebAssembly (WASM).

---

## 📖 Overview & Architecture

`win32-svelte` provides a complete, freestanding WebAssembly runtime bridge ([`src/win32/wasm_bridge.ts`](src/win32/wasm_bridge.ts)) and a lightweight Win32 C header SDK ([`include/windows.h`](include/windows.h)).

Unlike traditional Emscripten setups that bundle hundreds of kilobytes of POSIX emulation shims, `win32-svelte` treats WebAssembly as a **freestanding 32-bit execution target (`wasm32-freestanding`)**:
- **Imports (`user32.dll` / `gdi32.dll`)**: System APIs like `CreateWindowEx`, `MessageBox`, `ShowWindow`, and `BeginPaint` are imported directly from the JavaScript environment (`env`).
- **Function Pointers & Callbacks (`WndProc`)**: Window procedures (`lpfnWndProc`) are C function pointers stored in the WebAssembly Indirect Function Table (`__indirect_function_table`). When a window receives a message (`WM_CREATE`, `WM_COMMAND`, `WM_PAINT`), the TypeScript kernel invokes the C function pointer directly through this table.
- **Linear Memory & Strings**: Pointers (`HWND`, `LPCSTR`, `LPVOID`, structs) are simply byte offsets into the WASM module's `WebAssembly.Memory`. The bridge translates UTF-8/ASCII strings and structs seamlessly across the boundary.

---

## 📁 The Header SDK (`include/`)

The header files in [`include/`](include/) are self-contained and require no external libc:

* **[`include/windows.h`](include/windows.h)**: Main entry header.
* **[`include/windef.h`](include/windef.h)**: Basic Win32 types (`HWND`, `UINT`, `WPARAM`, `LPARAM`, `BOOL`, `RECT`, `POINT`, `HINSTANCE`, etc.).
* **[`include/winuser.h`](include/winuser.h)**: Window classes (`WNDCLASSEX`), window styles (`WS_OVERLAPPEDWINDOW`, `WS_CHILD`, etc.), messages (`WM_CREATE`, `WM_COMMAND`, `WM_PAINT`, etc.), control styles (`BS_PUSHBUTTON`, `ES_MULTILINE`), and User32 function prototypes.
* **[`include/wingdi.h`](include/wingdi.h)**: GDI types (`HDC`, `PAINTSTRUCT`, `COLORREF`, `RGB`), stock objects, and drawing prototypes (`BeginPaint`, `EndPaint`, `Rectangle`, `Ellipse`, `TextOut`, `MoveToEx`, `LineTo`).
* **[`include/winbase.h`](include/winbase.h)**: Helper macros (`LOWORD`, `HIWORD`, `MAKEWPARAM`, `MAKELPARAM`).

All Win32 functions are declared with the `WIN32_IMPORT` attribute:
```c
#define WIN32_IMPORT(name) __attribute__((import_module("env"), import_name(name)))

WIN32_IMPORT("MessageBoxA")
int WINAPI MessageBoxA(HWND hWnd, LPCSTR lpText, LPCSTR lpCaption, UINT uType);
```

---

## ✍️ Step 1: Write a Simple Application

Create a file named `hello_win32.c`:

```c
#include <windows.h>

#define IDC_MY_BUTTON 101
#define IDC_LABEL     102

static HWND g_hButton = NULL;
static int g_clicks = 0;

// Window Procedure: handles events sent by the win32-svelte kernel
LRESULT CALLBACK WndProc(HWND hwnd, UINT uMsg, WPARAM wParam, LPARAM lParam) {
    switch (uMsg) {
        case WM_CREATE: {
            // Create a static text label
            CreateWindowEx(
                0, "STATIC",
                "Hello from Native C via WebAssembly!",
                WS_CHILD | WS_VISIBLE,
                20, 20, 260, 20,
                hwnd, (HMENU)IDC_LABEL, NULL, NULL
            );

            // Create an interactive button
            g_hButton = CreateWindowEx(
                0, "BUTTON",
                "Click Me!",
                WS_CHILD | WS_VISIBLE | BS_PUSHBUTTON,
                20, 50, 140, 26,
                hwnd, (HMENU)IDC_MY_BUTTON, NULL, NULL
            );
            return 0;
        }

        case WM_COMMAND: {
            WORD id = LOWORD(wParam);
            if (id == IDC_MY_BUTTON) {
                g_clicks++;
                MessageBox(
                    hwnd,
                    "Button was clicked inside native C code!",
                    "C WebAssembly",
                    MB_OK | MB_ICONINFORMATION
                );
            }
            return 0;
        }

        case WM_PAINT: {
            PAINTSTRUCT ps;
            HDC hdc = BeginPaint(hwnd, &ps);

            // Draw with standard Win32 GDI calls
            Rectangle(hdc, 20, 90, 280, 160);
            TextOut(hdc, 30, 105, "Native GDI text from C");

            EndPaint(hwnd, &ps);
            return 0;
        }

        case WM_DESTROY: {
            PostQuitMessage(0);
            return 0;
        }

        default:
            return DefWindowProc(hwnd, uMsg, wParam, lParam);
    }
}

// Application Entry Point
int WINAPI WinMain(HINSTANCE hInstance, HINSTANCE hPrevInstance, LPSTR lpCmdLine, int nCmdShow) {
    // 1. Register the Window Class
    WNDCLASSEX wc;
    wc.cbSize        = sizeof(WNDCLASSEX);
    wc.style         = CS_HREDRAW | CS_VREDRAW;
    wc.lpfnWndProc   = WndProc; // Function pointer exported via indirect table
    wc.cbClsExtra    = 0;
    wc.cbWndExtra    = 0;
    wc.hInstance     = hInstance;
    wc.hIcon         = NULL;
    wc.hCursor       = NULL;
    wc.hbrBackground = NULL;
    wc.lpszMenuName  = NULL;
    wc.lpszClassName = "HelloWin32Class";
    wc.hIconSm       = NULL;

    RegisterClassEx(&wc);

    // 2. Create the Window
    HWND hwnd = CreateWindowEx(
        0,
        "HelloWin32Class",
        "Hello from Native C (WASM)",
        WS_OVERLAPPEDWINDOW | WS_VISIBLE,
        180, 120, 320, 210,
        NULL, NULL, hInstance, NULL
    );

    // 3. Display the Window
    ShowWindow(hwnd, SW_SHOW);
    UpdateWindow(hwnd);

    return 0;
}
```

---

## 🛠️ Step 2: Compile to WebAssembly

You can compile using any C compiler with a WebAssembly backend (such as **Zig** or **LLVM / Clang**).

### Method A: Using Zig (Recommended)

[Zig](https://ziglang.org/) contains a built-in Clang compiler and LLVM toolchain that cross-compiles freestanding WASM out of the box without requiring emscripten.

```bash
zig cc -target wasm32-freestanding -nostdlib \
  -Iinclude \
  hello_win32.c \
  -Wl,--no-entry \
  -Wl,--export=WinMain \
  -Wl,--export-table \
  -o hello_win32.wasm
```

Or using `zig build-exe`:

```bash
zig build-exe -target wasm32-freestanding \
  -Iinclude \
  hello_win32.c \
  -fno-entry \
  --export=WinMain \
  --export-table \
  -femit-bin=hello_win32.wasm
```

### Method B: Using LLVM / Clang

If you have standard `clang` and `lld` installed:

```bash
clang --target=wasm32-unknown-unknown -nostdlib \
  -Iinclude \
  hello_win32.c \
  -Wl,--no-entry \
  -Wl,--export=WinMain \
  -Wl,--export-table \
  -o hello_win32.wasm
```

---

## 🔍 Critical Compiler Flags Explained

| Flag | Purpose |
|---|---|
| `-target wasm32-freestanding` | Generates a 32-bit WebAssembly module with no default operating system or libc dependencies. |
| `-nostdlib` | Prevents linking against standard C runtimes (keeps the output binary tiny, typically ~10–20 KB). |
| `-Wl,--no-entry` | Tells the linker that there is no standard C `_start` or `main` entry point. |
| `-Wl,--export=WinMain` | Exports `WinMain` as a WebAssembly function export so `win32-svelte` can invoke it. |
| `-Wl,--export-table` | **Crucial!** Exports `__indirect_function_table`. This allows the JavaScript runtime to invoke your `WndProc` function pointer when window messages arrive. |
| `-Iinclude` | Tells the compiler where to find `<windows.h>` and related headers. |

---

## 🏃 Step 3: Run in win32-svelte

There are four ways to run your `.wasm` application:

### 1. Drag & Drop into Windows Explorer
Because Windows Explorer supports `WM_DROPFILES`, you can simply drag your `hello_win32.wasm` file from your computer desktop directly into the **Windows Explorer** window inside the browser. It will be stored persistently in the browser's Origin Private File System (OPFS).

### 2. Double-Click in Windows Explorer
Navigate to `C:\wasm_application` (or the folder where you placed the file) inside Windows Explorer, and double-click `hello_win32.wasm`. The kernel will load the bytecode, instantiate the runtime, and execute `WinMain`!

### 3. Launch Programmatically via VFS Path
You can invoke the application from anywhere in TypeScript:

```typescript
import { StartWasmApp } from "./samples/wasm_app";

// Reads binary from virtual filesystem and starts the app
await StartWasmApp(260, 90, "C:\\wasm_application\\hello_win32.wasm");
```

### 4. Direct Instantiation with Bytecode
If you have raw WASM bytecode (`Uint8Array`):

```typescript
import { Win32WasmRuntime } from "./win32/wasm_bridge";

const runtime = new Win32WasmRuntime();
await runtime.instantiate(wasmBytes);
runtime.runWinMain();
```

---

## 📦 Existing Sample & Build Scripts

The repository includes a complete working example in [`src/wasm/sample_app.c`](src/wasm/sample_app.c), complete with:
- Multiple interactive buttons
- Stateful C counter updating UI labels
- GDI drawing triggers
- `ShellExecute` invocations opening source code in Notepad

To recompile the built-in sample:
```bash
npm run build:wasm
```

This runs the compilation script and regenerates [`src/wasm/sample_app.wasm`](src/wasm/sample_app.wasm).
