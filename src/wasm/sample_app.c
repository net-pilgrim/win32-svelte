#include "../../include/windows.h"

#define IDC_BTN_MSGBOX  1001
#define IDC_BTN_COUNTER 1002
#define IDC_BTN_REFRESH 1003
#define IDC_STATIC_INFO 1004
#define IDC_BTN_VIEW_C  1005
#define IDC_BTN_VIEW_H  1006

static HWND g_hBtnCounter = NULL;
static int g_counter = 0;

// Simple integer to string formatter without requiring libc
static void int_to_str(int val, char *buf) {
    char temp[16];
    int i = 0, j = 0;
    if (val == 0) {
        buf[0] = '0';
        buf[1] = '\0';
        return;
    }
    while (val > 0) {
        temp[i++] = '0' + (val % 10);
        val /= 10;
    }
    while (i > 0) {
        buf[j++] = temp[--i];
    }
    buf[j] = '\0';
}

static void update_counter_button(HWND hwnd) {
    char text[64] = "C Clicks: ";
    char num[16];
    int_to_str(g_counter, num);
    
    // Concatenate text + num
    int p = 10; // length of "C Clicks: "
    int np = 0;
    while (num[np] != '\0') {
        text[p++] = num[np++];
    }
    text[p] = '\0';

    if (g_hBtnCounter) {
        SetWindowText(g_hBtnCounter, text);
    }
}

LRESULT CALLBACK WndProc(HWND hwnd, UINT uMsg, WPARAM wParam, LPARAM lParam) {
    switch (uMsg) {
        case WM_CREATE: {
            // Informational static label
            CreateWindowEx(
                0, "STATIC",
                "Compiled with Zig/Clang to WebAssembly (WASM32)!\nRunning on win32-svelte user32/gdi32 engine.",
                WS_CHILD | WS_VISIBLE,
                15, 10, 310, 34,
                hwnd, (HMENU)IDC_STATIC_INFO, NULL, NULL
            );

            // Message box demo button
            CreateWindowEx(
                0, "BUTTON", "Show C MessageBox",
                WS_CHILD | WS_VISIBLE | BS_PUSHBUTTON,
                15, 50, 150, 24,
                hwnd, (HMENU)IDC_BTN_MSGBOX, NULL, NULL
            );

            // State counter button
            g_hBtnCounter = CreateWindowEx(
                0, "BUTTON", "C Clicks: 0",
                WS_CHILD | WS_VISIBLE | BS_PUSHBUTTON,
                175, 50, 150, 24,
                hwnd, (HMENU)IDC_BTN_COUNTER, NULL, NULL
            );

            // GDI redraw trigger button
            CreateWindowEx(
                0, "BUTTON", "Invalidate GDI Canvas",
                WS_CHILD | WS_VISIBLE | BS_PUSHBUTTON,
                15, 80, 310, 24,
                hwnd, (HMENU)IDC_BTN_REFRESH, NULL, NULL
            );

            // Source code viewer buttons
            CreateWindowEx(
                0, "BUTTON", "📄 View sample_app.c",
                WS_CHILD | WS_VISIBLE | BS_PUSHBUTTON,
                15, 110, 150, 24,
                hwnd, (HMENU)IDC_BTN_VIEW_C, NULL, NULL
            );

            CreateWindowEx(
                0, "BUTTON", "📋 View windows.h",
                WS_CHILD | WS_VISIBLE | BS_PUSHBUTTON,
                175, 110, 150, 24,
                hwnd, (HMENU)IDC_BTN_VIEW_H, NULL, NULL
            );

            return 0;
        }

        case WM_COMMAND: {
            WORD id = LOWORD(wParam);
            if (id == IDC_BTN_MSGBOX) {
                MessageBox(
                    hwnd,
                    "Hello from native C99 Win32 code!\n\n"
                    "• Compiled with: zig cc -target wasm32-freestanding\n"
                    "• Header: <windows.h>\n"
                    "• Runtime: win32-svelte (Svelte 5 + 98.css)\n\n"
                    "Functions, callbacks, and structs are bridged into WASM memory!",
                    "WASM Win32 Native App",
                    MB_OK | MB_ICONINFORMATION
                );
                return 0;
            }

            if (id == IDC_BTN_COUNTER) {
                g_counter++;
                update_counter_button(hwnd);
                return 0;
            }

            if (id == IDC_BTN_REFRESH) {
                InvalidateRect(hwnd, NULL, TRUE);
                return 0;
            }

            if (id == IDC_BTN_VIEW_C) {
                ShellExecute(hwnd, "open", "sample_app.c", NULL, NULL, SW_SHOW);
                return 0;
            }

            if (id == IDC_BTN_VIEW_H) {
                ShellExecute(hwnd, "open", "windows.h", NULL, NULL, SW_SHOW);
                return 0;
            }

            return 0;
        }

        case WM_PAINT: {
            PAINTSTRUCT ps;
            HDC hdc = BeginPaint(hwnd, &ps);

            // Draw a navy blue banner
            HBRUSH hNavyBrush = CreateSolidBrush(RGB(0, 0, 128));
            SelectObject(hdc, hNavyBrush);
            Rectangle(hdc, 15, 145, 325, 210);
            DeleteObject(hNavyBrush);

            // White text inside banner
            SetTextColor(hdc, RGB(255, 255, 255));
            TextOut(hdc, 25, 158, "Native GDI 2D Graphics via WASM", 31);

            char counterMsg[64] = "Current C State Counter: ";
            char num[16];
            int_to_str(g_counter, num);
            int cp = 25;
            int np = 0;
            while (num[np] != '\0') {
                counterMsg[cp++] = num[np++];
            }
            counterMsg[cp] = '\0';
            TextOut(hdc, 25, 180, counterMsg, cp);

            // Draw accent circles with green brush
            HBRUSH hGreenBrush = CreateSolidBrush(RGB(0, 128, 64));
            SelectObject(hdc, hGreenBrush);
            Ellipse(hdc, 280, 155, 315, 200);
            DeleteObject(hGreenBrush);

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

__attribute__((export_name("WinMain")))
int WINAPI WinMain(
    HINSTANCE hInstance,
    HINSTANCE hPrevInstance,
    LPSTR lpCmdLine,
    int nShowCmd
) {
    WNDCLASSEX wc = {0};
    wc.cbSize = sizeof(WNDCLASSEX);
    wc.lpfnWndProc = WndProc;
    wc.hInstance = hInstance;
    wc.lpszClassName = "WasmCWindowClass";

    if (!RegisterClassEx(&wc)) {
        return 1;
    }

    HWND hwnd = CreateWindowEx(
        0,
        "WasmCWindowClass",
        "WASM Win32 Native App (C99)",
        WS_OVERLAPPEDWINDOW | WS_VISIBLE,
        140, 110, 355, 265,
        NULL, NULL, hInstance, NULL
    );

    if (!hwnd) {
        return 2;
    }

    ShowWindow(hwnd, SW_SHOW);
    UpdateWindow(hwnd);

    return 0;
}
