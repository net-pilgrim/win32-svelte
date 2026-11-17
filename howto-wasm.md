# 🧪 Building WebAssembly Applications for win32-svelte

> ⚠️ **Disclaimer:** This guide describes an experimental prototype demonstrating how C code can interact with a toy in-browser Win32 dispatcher. It is **not** a complete Win32 SDK or production toolchain.

This document explains how to write, compile, and run C applications inside the **win32-svelte** experiment using WebAssembly (WASM), featuring a dedicated example project with a `Makefile` and comprehensive coding patterns.

---

## 📖 Overview & Architecture

`win32-svelte` provides an experimental WebAssembly runtime bridge ([`src/win32/wasm_bridge.ts`](src/win32/wasm_bridge.ts)) and modular Win32 C header stubs ([`include/`](include/)).

Unlike setups that bundle heavy POSIX emulation shims (like Emscripten with full musl/glibc), this prototype treats WebAssembly as a **freestanding 32-bit execution target (`wasm32-freestanding`)**:
- **Imports (`user32` / `gdi32` / `shell32`)**: APIs like `CreateWindowEx`, `MessageBox`, `ShowWindow`, `BeginPaint`, and `ShellExecute` are imported from the JavaScript host module (`win32`, with an `env` alias also supported).
- **Function Pointers & Callbacks (`WndProc`)**: Window procedures (`lpfnWndProc`) are standard C function pointers stored in the WebAssembly Indirect Function Table (`__indirect_function_table`). When a window receives a message (`WM_CREATE`, `WM_COMMAND`, `WM_PAINT`, `WM_TIMER`), the TypeScript kernel invokes the C function pointer through this table.
- **Linear Memory & Strings**: Pointers (`HWND`, `LPCSTR`, `LPVOID`, structs) are 32-bit byte offsets into the WASM module's `WebAssembly.Memory`. The bridge marshals UTF-8 strings and binary structs across the boundary.
- **Compact Binaries**: Because no libc runtime is linked (`-nostdlib`), compiled binaries are tiny (typically **10 KB – 20 KB**).

---

## 📁 The Header Stubs (`include/`)

The header files in [`include/`](include/) are modular stubs covering Win32 types, constants, macros, and function prototypes:

* **[`include/windows.h`](include/windows.h)**: Master umbrella header including all modular headers.
* **[`include/windef.h`](include/windef.h)**: Win32 primitive types (`HWND`, `UINT`, `WPARAM`, `LPARAM`, `LRESULT`, `BOOL`, `RECT`, `POINT`, `HINSTANCE`, etc.).
* **[`include/winuser.h`](include/winuser.h)**: Window classes (`WNDCLASSEX`), window styles (`WS_OVERLAPPEDWINDOW`, `WS_CHILD`, etc.), messages (`WM_CREATE`, `WM_COMMAND`, `WM_PAINT`, `WM_TIMER`, `WM_DESTROY`), control styles (`BS_PUSHBUTTON`, `ES_MULTILINE`), and User32 prototypes.
* **[`include/wingdi.h`](include/wingdi.h)**: GDI types (`HDC`, `PAINTSTRUCT`, `COLORREF`, `RGB`), stock objects, pens, brushes, and drawing prototypes (`BeginPaint`, `EndPaint`, `Rectangle`, `Ellipse`, `TextOut`, `DrawText`, `MoveToEx`, `LineTo`, `CreateSolidBrush`, `CreatePen`).
* **[`include/winbase.h`](include/winbase.h)**: Helper macros (`LOWORD`, `HIWORD`, `MAKEWPARAM`, `MAKELPARAM`).
* **[`include/shellapi.h`](include/shellapi.h)**: Shell integration (`ShellExecute`).

Win32 functions in these headers are declared with the `WIN32_IMPORT` attribute:
```c
#ifndef WIN32_IMPORT
#define WIN32_IMPORT(name) __attribute__((import_module("win32"), import_name(name)))
#endif

WIN32_IMPORT("MessageBoxA")
int WINAPI MessageBoxA(HWND hWnd, LPCSTR lpText, LPCSTR lpCaption, UINT uType);
```

---

## 📁 Example Project with Makefile (`examples/simple_c_app/`)

The repository includes a ready-to-build C project located in [`examples/simple_c_app/`](examples/simple_c_app/).

### Directory Contents
```
examples/simple_c_app/
├── Makefile       # Multi-compiler build automation (Zig CC / Clang)
├── main.c         # Pure C99 Win32 application source code
└── README.md      # Project documentation
```

### Building with Make

You can build the example directly with standard `make`:

```bash
# Navigate to the example directory
cd examples/simple_c_app

# Build simple_app.wasm
make

# Or run from repository root via npm script
npm run build:example
```

### Makefile Targets

| Target | Command | Purpose |
|---|---|---|
| `all` / `build` | `make` | Compiles `main.c` into `simple_app.wasm` |
| `clean` | `make clean` | Deletes generated `.wasm` binary |
| `copy-to-public` | `make copy-to-public` | Copies binary and source into `public/wasm/` |
| `help` | `make help` | Displays compiler detection status and targets |

### The `Makefile` Structure

```makefile
# Detect available compiler: prefer zig cc, fallback to clang
ZIG := $(shell which zig 2>/dev/null)
CLANG := $(shell which clang 2>/dev/null)

ifeq ($(origin CC),default)
  ifneq ($(ZIG),)
    CC := zig cc
    TARGET ?= wasm32-freestanding
  else ifneq ($(CLANG),)
    CC := clang
    TARGET ?= wasm32-unknown-unknown
  else
    CC := zig cc
    TARGET ?= wasm32-freestanding
  endif
else
  TARGET ?= wasm32-freestanding
endif

INCLUDE_DIR ?= ../../include
CFLAGS ?= -target $(TARGET) -nostdlib -I$(INCLUDE_DIR) -O2 -Wall
LDFLAGS ?= -Wl,--no-entry -Wl,--export=WinMain -Wl,--export-table

OUTPUT = simple_app.wasm
SOURCES = main.c

all: build

build: $(OUTPUT)

$(OUTPUT): $(SOURCES)
	$(CC) $(CFLAGS) $(SOURCES) $(LDFLAGS) -o $@
	@echo "Built $(OUTPUT) successfully!"
```

---

## 🛠️ Compiling Manually (CLI)

### Method A: Using Zig (Recommended)

[Zig](https://ziglang.org/) bundles Clang/LLVM and can cross-compile freestanding WebAssembly out of the box without extra dependencies:

```bash
zig cc -target wasm32-freestanding -nostdlib \
  -Iinclude \
  examples/simple_c_app/main.c \
  -Wl,--no-entry \
  -Wl,--export=WinMain \
  -Wl,--export-table \
  -o simple_app.wasm
```

Or using `zig build-exe`:
```bash
zig build-exe -target wasm32-freestanding \
  -Iinclude \
  examples/simple_c_app/main.c \
  -fno-entry \
  --export=WinMain \
  --export-table \
  -femit-bin=simple_app.wasm
```

### Method B: Using LLVM / Clang

If you have LLVM `clang` and `lld` installed:

```bash
clang --target=wasm32-unknown-unknown -nostdlib \
  -Iinclude \
  examples/simple_c_app/main.c \
  -Wl,--no-entry \
  -Wl,--export=WinMain \
  -Wl,--export-table \
  -o simple_app.wasm
```

---

## 🔍 Linker and Compiler Flags Explained

| Flag | Purpose |
|---|---|
| `-target wasm32-freestanding` | Generates a 32-bit WebAssembly module with no OS or libc dependencies. |
| `-nostdlib` | Prevents linking against standard C runtimes, keeping the binary size around ~10–15 KB. |
| `-Iinclude` | Specifies the search path for `<windows.h>` stubs. |
| `-Wl,--no-entry` | Informs the WebAssembly linker that there is no standard C `_start` or `main()` entry point. |
| `-Wl,--export=WinMain` | Exports `WinMain` as a WebAssembly function export so `win32-svelte` can invoke it. |
| `-Wl,--export-table` | Exports `__indirect_function_table`. This allows the JavaScript runtime to invoke your `WndProc` function pointer when window messages arrive. |

---

## 💡 Win32 C Coding Examples

Here are modular, copy-pasteable coding examples demonstrating different Win32 patterns in WebAssembly:

### 1. Minimal Hello World & MessageBox

A bare-minimum application that creates a window and displays a message box.

```c
#include "windows.h"

LRESULT CALLBACK WndProc(HWND hwnd, UINT uMsg, WPARAM wParam, LPARAM lParam) {
    switch (uMsg) {
        case WM_CREATE:
            MessageBox(
                hwnd,
                "Hello from WebAssembly freestanding C!",
                "Win32 WASM Demo",
                MB_OK | MB_ICONINFORMATION
            );
            return 0;

        case WM_DESTROY:
            PostQuitMessage(0);
            return 0;

        default:
            return DefWindowProc(hwnd, uMsg, wParam, lParam);
    }
}

__attribute__((export_name("WinMain")))
int WINAPI WinMain(HINSTANCE hInstance, HINSTANCE hPrevInstance, LPSTR lpCmdLine, int nShowCmd) {
    WNDCLASSEX wc = {0};
    wc.cbSize = sizeof(WNDCLASSEX);
    wc.lpfnWndProc = WndProc;
    wc.hInstance = hInstance;
    wc.lpszClassName = "HelloClass";

    RegisterClassEx(&wc);

    HWND hwnd = CreateWindowEx(
        0, "HelloClass", "Hello World Window",
        WS_OVERLAPPEDWINDOW | WS_VISIBLE,
        150, 100, 300, 180,
        NULL, NULL, hInstance, NULL
    );

    ShowWindow(hwnd, SW_SHOW);
    UpdateWindow(hwnd);
    return 0;
}
```

---

### 2. Interactive Child Controls & State Management

Demonstrates creating `BUTTON` and `STATIC` controls, handling `WM_COMMAND`, and updating text dynamically without standard libc functions.

```c
#include "windows.h"

#define IDC_LABEL   101
#define IDC_BUTTON  102

static HWND g_hButton = NULL;
static int g_clicks = 0;

// Simple integer to string formatter without libc
static void int_to_str(int val, char *buf) {
    char tmp[16];
    int i = 0, j = 0;
    if (val == 0) { buf[0] = '0'; buf[1] = '\0'; return; }
    while (val > 0) {
        tmp[i++] = (char)('0' + (val % 10));
        val /= 10;
    }
    while (i > 0) buf[j++] = tmp[--i];
    buf[j] = '\0';
}

LRESULT CALLBACK WndProc(HWND hwnd, UINT uMsg, WPARAM wParam, LPARAM lParam) {
    switch (uMsg) {
        case WM_CREATE: {
            // Create a static text header
            CreateWindowEx(
                0, "STATIC", "Click the button below to update state:",
                WS_CHILD | WS_VISIBLE,
                15, 15, 260, 20,
                hwnd, (HMENU)IDC_LABEL, NULL, NULL
            );

            // Create an interactive button
            g_hButton = CreateWindowEx(
                0, "BUTTON", "Clicks: 0",
                WS_CHILD | WS_VISIBLE | BS_PUSHBUTTON,
                15, 45, 120, 26,
                hwnd, (HMENU)IDC_BUTTON, NULL, NULL
            );
            return 0;
        }

        case WM_COMMAND: {
            WORD id = LOWORD(wParam);
            if (id == IDC_BUTTON) {
                g_clicks++;

                char text[32] = "Clicks: ";
                char num[16];
                int_to_str(g_clicks, num);

                int p = 8, n = 0;
                while (num[n] != '\0') text[p++] = num[n++];
                text[p] = '\0';

                SetWindowText(g_hButton, text);
            }
            return 0;
        }

        case WM_DESTROY:
            PostQuitMessage(0);
            return 0;

        default:
            return DefWindowProc(hwnd, uMsg, wParam, lParam);
    }
}
```

---

### 3. Custom GDI 2D Graphics Painting (`WM_PAINT`)

Demonstrates pens, solid brushes, rectangles, ellipses, text styling, and proper handle cleanup via `DeleteObject`.

```c
#include "windows.h"

LRESULT CALLBACK WndProc(HWND hwnd, UINT uMsg, WPARAM wParam, LPARAM lParam) {
    switch (uMsg) {
        case WM_PAINT: {
            PAINTSTRUCT ps;
            HDC hdc = BeginPaint(hwnd, &ps);

            // 1. Fill background arena with dark navy brush
            RECT rect = { 10, 10, 310, 180 };
            HBRUSH hNavyBrush = CreateSolidBrush(RGB(10, 25, 47));
            FillRect(hdc, &rect, hNavyBrush);
            DeleteObject(hNavyBrush);

            // 2. Draw coordinate grid lines with custom pen
            HPEN hGridPen = CreatePen(PS_SOLID, 1, RGB(23, 42, 69));
            SelectObject(hdc, hGridPen);
            MoveToEx(hdc, 10, 95, NULL);
            LineTo(hdc, 310, 95);
            MoveToEx(hdc, 160, 10, NULL);
            LineTo(hdc, 160, 180);
            DeleteObject(hGridPen);

            // 3. Draw colored geometric shapes
            HBRUSH hYellowBrush = CreateSolidBrush(RGB(255, 215, 0));
            SelectObject(hdc, hYellowBrush);
            Rectangle(hdc, 30, 30, 80, 80);
            DeleteObject(hYellowBrush);

            HBRUSH hCyanBrush = CreateSolidBrush(RGB(0, 212, 255));
            SelectObject(hdc, hCyanBrush);
            Ellipse(hdc, 200, 40, 270, 110);
            DeleteObject(hCyanBrush);

            // 4. Render styled text
            SetTextColor(hdc, RGB(255, 255, 255));
            TextOut(hdc, 20, 150, "GDI Rendering from Freestanding C", 33);

            EndPaint(hwnd, &ps);
            return 0;
        }

        case WM_DESTROY:
            PostQuitMessage(0);
            return 0;

        default:
            return DefWindowProc(hwnd, uMsg, wParam, lParam);
    }
}
```

---

### 4. Real-Time Procedural Animation Loop (`WM_TIMER`)

Demonstrates setting up a timer with `SetTimer`, advancing animation coordinates in `WM_TIMER`, and calling `InvalidateRect` to trigger smooth 30 FPS rendering.

```c
#include "windows.h"

#define TIMER_ANIM 1

static int g_posX = 30;
static int g_speedX = 4;

LRESULT CALLBACK WndProc(HWND hwnd, UINT uMsg, WPARAM wParam, LPARAM lParam) {
    switch (uMsg) {
        case WM_CREATE:
            // Schedule timer for ~33ms intervals (~30 FPS)
            SetTimer(hwnd, TIMER_ANIM, 33, NULL);
            return 0;

        case WM_TIMER:
            if (wParam == TIMER_ANIM) {
                // Update position and bounce within bounds
                g_posX += g_speedX;
                if (g_posX <= 20 || g_posX >= 260) {
                    g_speedX = -g_speedX;
                }

                // Invalidate canvas to trigger WM_PAINT
                InvalidateRect(hwnd, NULL, FALSE);
            }
            return 0;

        case WM_PAINT: {
            PAINTSTRUCT ps;
            HDC hdc = BeginPaint(hwnd, &ps);

            // Draw animated bouncing circle
            HBRUSH hBrush = CreateSolidBrush(RGB(255, 69, 0));
            SelectObject(hdc, hBrush);
            Ellipse(hdc, g_posX, 40, g_posX + 40, 80);
            DeleteObject(hBrush);

            EndPaint(hwnd, &ps);
            return 0;
        }

        case WM_DESTROY:
            KillTimer(hwnd, TIMER_ANIM);
            PostQuitMessage(0);
            return 0;

        default:
            return DefWindowProc(hwnd, uMsg, wParam, lParam);
    }
}
```

---

### 5. Shell Integration & External Execution (`ShellExecute`)

Demonstrates opening files in the host sandbox (such as opening source code in Notepad) from C button clicks:

```c
#include "windows.h"

#define IDC_BTN_OPEN_FILE 101

LRESULT CALLBACK WndProc(HWND hwnd, UINT uMsg, WPARAM wParam, LPARAM lParam) {
    switch (uMsg) {
        case WM_CREATE:
            CreateWindowEx(
                0, "BUTTON", "Open Readme in Notepad",
                WS_CHILD | WS_VISIBLE | BS_PUSHBUTTON,
                20, 30, 200, 26,
                hwnd, (HMENU)IDC_BTN_OPEN_FILE, NULL, NULL
            );
            return 0;

        case WM_COMMAND:
            if (LOWORD(wParam) == IDC_BTN_OPEN_FILE) {
                // ShellExecute bridges to the win32-svelte virtual filesystem
                ShellExecute(hwnd, "open", "Welcome.txt", NULL, NULL, SW_SHOW);
            }
            return 0;

        case WM_DESTROY:
            PostQuitMessage(0);
            return 0;

        default:
            return DefWindowProc(hwnd, uMsg, wParam, lParam);
    }
}
```

---

### 6. Procedural Retro Audio Feedback (`MessageBeep`)

Demonstrates triggering procedural synthesized sound effects using the browser's Web Audio API:

```c
#include "windows.h"

#define IDC_BTN_BEEP 101

LRESULT CALLBACK WndProc(HWND hwnd, UINT uMsg, WPARAM wParam, LPARAM lParam) {
    switch (uMsg) {
        case WM_CREATE:
            CreateWindowEx(
                0, "BUTTON", "Play Alert Sound",
                WS_CHILD | WS_VISIBLE | BS_PUSHBUTTON,
                20, 30, 160, 26,
                hwnd, (HMENU)IDC_BTN_BEEP, NULL, NULL
            );
            return 0;

        case WM_COMMAND:
            if (LOWORD(wParam) == IDC_BTN_BEEP) {
                // Triggers procedural Asterisk / Exclamation chime synth
                MessageBeep(MB_ICONASTERISK);
            }
            return 0;

        case WM_DESTROY:
            PostQuitMessage(0);
            return 0;

        default:
            return DefWindowProc(hwnd, uMsg, wParam, lParam);
    }
}
```

---

## 📋 Supported Win32 C APIs Reference Table

The runtime bridge (`src/win32/wasm_bridge.ts`) implements the following Win32 functions:

| Module | Function | Description in WebAssembly Runtime |
|---|---|---|
| **User32** | `RegisterClassEx` | Registers window class and adds `WndProc` function pointer from indirect table |
| **User32** | `CreateWindowEx` | Creates top-level windows and child controls (`BUTTON`, `STATIC`, `EDIT`) |
| **User32** | `ShowWindow` / `UpdateWindow` | Sets window visibility state and schedules initial paint |
| **User32** | `DefWindowProc` | Default message processing fallback |
| **User32** | `PostQuitMessage` | Posts `WM_QUIT` and closes the application |
| **User32** | `SendMessage` | Synchronously dispatches a message to a window |
| **User32** | `PostMessage` | Queues a message asynchronously into the message queue |
| **User32** | `SetWindowText` | Sets title or control text from a WASM C string pointer |
| **User32** | `GetWindowText` | Reads window title or control text into a WASM buffer |
| **User32** | `GetClientRect` | Fills a `RECT` struct in linear memory with the window client dimensions |
| **User32** | `InvalidateRect` | Marks window region dirty and schedules `WM_PAINT` |
| **User32** | `MessageBox` | Opens an authentic Windows 98 modal dialog and awaits user response |
| **User32** | `MessageBeep` | Synthesizes retro system sounds (Chord, Ding, Chime) via Web Audio API |
| **User32** | `SetTimer` / `KillTimer` | Schedules periodic `WM_TIMER` notifications |
| **GDI32** | `BeginPaint` / `EndPaint` | Prepares HTML5 `<canvas>` context for drawing |
| **GDI32** | `MoveToEx` / `LineTo` | Moves graphics cursor and renders line segments |
| **GDI32** | `Rectangle` | Renders a stroked and filled rectangle |
| **GDI32** | `Ellipse` | Renders a stroked and filled ellipse/circle |
| **GDI32** | `TextOut` | Draws a text string at specified coordinates |
| **GDI32** | `DrawText` | Formats and draws text with alignment (`DT_CENTER`, `DT_VCENTER`) |
| **GDI32** | `SetTextColor` | Configures drawing text color |
| **GDI32** | `CreateSolidBrush` | Creates a solid color fill brush |
| **GDI32** | `CreatePen` | Creates a stroke pen with width and style |
| **GDI32** | `SelectObject` | Activates pen or brush in device context (`HDC`) |
| **GDI32** | `DeleteObject` | Releases GDI handle from tracking table |
| **GDI32** | `FillRect` | Fills a `RECT` using the specified brush |
| **Shell32**| `ShellExecute` | Launches files or applications inside the sandbox (e.g. Notepad) |

---

## 🏃 Running in the win32-svelte Sandbox

There are several ways to test your `.wasm` binary:

### 1. Drag & Drop into Windows Explorer
Because the demo Windows Explorer supports `WM_DROPFILES`, you can drag your `simple_app.wasm` file from your desktop into the **Windows Explorer** window inside the browser. It will be stored in the browser's Origin Private File System (OPFS) sandbox.

### 2. Double-Click in Windows Explorer
Navigate to `C:\wasm_application` inside the simulated Windows Explorer and double-click the `.wasm` file. The prototype loads the bytecode, instantiates the runtime, and executes `WinMain`.

### 3. Launch Programmatically via VFS Path
You can invoke the application programmatically in TypeScript:

```typescript
import { StartWasmApp } from "./samples/wasm_app";

// Reads binary from virtual filesystem and starts the app
await StartWasmApp(160, 120, "C:\\wasm_application\\simple_app.wasm");
```

### 4. Direct Instantiation with Bytecode
If you have raw WASM bytecode (`Uint8Array` or `ArrayBuffer`):

```typescript
import { Win32WasmRuntime } from "./win32/wasm_bridge";

const runtime = new Win32WasmRuntime();
await runtime.instantiate(wasmBytes);
runtime.runWinMain();
```

---

## ❓ Frequently Asked Questions & Troubleshooting

### Q: Why do I get `table index out of bounds` or invalid function pointer errors?
Make sure you compiled with `-Wl,--export-table` (or `--export-table` in Zig). The TypeScript runtime invokes your `WndProc` callback via WebAssembly's `__indirect_function_table`. If the table is not exported, function pointer calls cannot cross the boundary.

### Q: Why is `_start` or `main` reported missing during linking?
Win32 applications enter via `WinMain`. Use `-Wl,--no-entry` (or `-fno-entry`) to tell the linker that a standard libc startup symbol is not expected, and pass `-Wl,--export=WinMain` (or `__attribute__((export_name("WinMain")))`) to expose your entry point.

### Q: Can I use `printf` or `malloc`?
Because the binary is built with `-nostdlib` to remain lightweight, standard C library functions (`printf`, `malloc`, `free`, `sprintf`) are not linked by default. You can use fixed buffers on the stack, global arrays, or custom lightweight formatting functions (such as `itoa_simple` shown in the examples).
