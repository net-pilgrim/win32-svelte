#ifndef _WINDOWS_H
#define _WINDOWS_H

/*
 * windows.h - Lightweight Win32 Header for WebAssembly (WASM32)
 *
 * Enables compiling native C Win32 applications directly to WebAssembly
 * and linking them against the win32-svelte user32/gdi32/kernel32 runtime.
 */

#ifdef __cplusplus
extern "C" {
#endif

#include "windef.h"
#include "winbase.h"
#include "wingdi.h"
#include "winuser.h"

// WinMain entry point prototype
int WINAPI WinMain(
    HINSTANCE hInstance,
    HINSTANCE hPrevInstance,
    LPSTR lpCmdLine,
    int nShowCmd
);

#ifdef __cplusplus
}
#endif

#endif // _WINDOWS_H
