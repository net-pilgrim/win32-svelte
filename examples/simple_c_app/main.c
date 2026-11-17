/**
 * main.c - Simple Win32 C WebAssembly Application for win32-svelte
 *
 * Demonstrates:
 * - Minimal freestanding C99 target (wasm32-freestanding) without libc.
 * - RegisterClassEx and CreateWindowEx for top-level window and child controls.
 * - Interactive event handling via WndProc and WM_COMMAND.
 * - GDI 2D graphics rendering via WM_PAINT (pens, brushes, shapes, text).
 * - Real-time animation timer via WM_TIMER and InvalidateRect.
 */

#include "windows.h"

// Control Identifiers
#define IDC_STATIC_BANNER  101
#define IDC_BTN_CLICK      102
#define IDC_BTN_MSGBOX     103
#define IDC_BTN_BEEP       104

// Global Application State
static HWND g_hBtnClick = NULL;
static int g_clicks = 0;
static int g_timerTicks = 0;
static int g_boxX = 20;
static int g_boxSpeed = 3;

// Lightweight integer-to-string formatter (no libc required)
static void itoa_simple(int val, char *buf) {
    char tmp[16];
    int i = 0, j = 0;
    if (val == 0) {
        buf[0] = '0';
        buf[1] = '\0';
        return;
    }
    if (val < 0) {
        buf[j++] = '-';
        val = -val;
    }
    while (val > 0) {
        tmp[i++] = (char)('0' + (val % 10));
        val /= 10;
    }
    while (i > 0) {
        buf[j++] = tmp[--i];
    }
    buf[j] = '\0';
}

// Window Procedure: Handles messages dispatched by win32-svelte kernel
LRESULT CALLBACK WndProc(HWND hwnd, UINT uMsg, WPARAM wParam, LPARAM lParam) {
    switch (uMsg) {
        case WM_CREATE: {
            // 1. Static informational header label
            CreateWindowEx(
                0, "STATIC",
                "Simple C Win32 App running in WebAssembly!\nPowered by win32-svelte & 98.css.",
                WS_CHILD | WS_VISIBLE,
                15, 10, 310, 36,
                hwnd, (HMENU)IDC_STATIC_BANNER, NULL, NULL
            );

            // 2. Interactive state counter button
            g_hBtnClick = CreateWindowEx(
                0, "BUTTON", "Clicks: 0",
                WS_CHILD | WS_VISIBLE | BS_PUSHBUTTON,
                15, 54, 95, 26,
                hwnd, (HMENU)IDC_BTN_CLICK, NULL, NULL
            );

            // 3. Message box prompt button
            CreateWindowEx(
                0, "BUTTON", "Show Dialog",
                WS_CHILD | WS_VISIBLE | BS_PUSHBUTTON,
                118, 54, 100, 26,
                hwnd, (HMENU)IDC_BTN_MSGBOX, NULL, NULL
            );

            // 4. Sound effect trigger button
            CreateWindowEx(
                0, "BUTTON", "Play Sound",
                WS_CHILD | WS_VISIBLE | BS_PUSHBUTTON,
                226, 54, 98, 26,
                hwnd, (HMENU)IDC_BTN_BEEP, NULL, NULL
            );

            // 5. Start real-time animation timer (~30 FPS, ~33ms interval)
            SetTimer(hwnd, 1, 33, NULL);
            return 0;
        }

        case WM_TIMER: {
            if (wParam == 1) {
                g_timerTicks++;

                // Animate horizontal bounce inside the GDI canvas area
                g_boxX += g_boxSpeed;
                if (g_boxX <= 20) {
                    g_boxX = 20;
                    g_boxSpeed = -g_boxSpeed;
                } else if (g_boxX >= 270) {
                    g_boxX = 270;
                    g_boxSpeed = -g_boxSpeed;
                }

                // Invalidate canvas area to trigger WM_PAINT
                InvalidateRect(hwnd, NULL, FALSE);
            }
            return 0;
        }

        case WM_COMMAND: {
            WORD id = LOWORD(wParam);

            if (id == IDC_BTN_CLICK) {
                g_clicks++;
                char text[32] = "Clicks: ";
                char num[16];
                itoa_simple(g_clicks, num);

                int p = 8;
                int n = 0;
                while (num[n] != '\0') {
                    text[p++] = num[n++];
                }
                text[p] = '\0';

                SetWindowText(g_hBtnClick, text);
                MessageBeep(0xFFFFFFFF);
                return 0;
            }

            if (id == IDC_BTN_MSGBOX) {
                MessageBox(
                    hwnd,
                    "This dialog was invoked from native C compiled to WebAssembly!\n\n"
                    "Message loops and dialogs integrate seamlessly with Svelte 5.",
                    "Simple C WASM App",
                    MB_OK | MB_ICONINFORMATION
                );
                return 0;
            }

            if (id == IDC_BTN_BEEP) {
                MessageBeep(MB_ICONEXCLAMATION);
                return 0;
            }

            return 0;
        }

        case WM_PAINT: {
            PAINTSTRUCT ps;
            HDC hdc = BeginPaint(hwnd, &ps);

            // 1. Draw outer viewport container
            RECT arenaRc = { 15, 90, 325, 205 };
            HBRUSH hArenaBrush = CreateSolidBrush(RGB(16, 24, 40));
            FillRect(hdc, &arenaRc, hArenaBrush);
            DeleteObject(hArenaBrush);

            // 2. Draw animated moving box with yellow brush and border
            HBRUSH hBoxBrush = CreateSolidBrush(RGB(255, 215, 0));
            HPEN hBoxPen = CreatePen(PS_SOLID, 1, RGB(255, 255, 255));
            SelectObject(hdc, hBoxBrush);
            SelectObject(hdc, hBoxPen);
            Rectangle(hdc, g_boxX, 100, g_boxX + 45, 140);
            DeleteObject(hBoxBrush);
            DeleteObject(hBoxPen);

            // 3. Draw stationary accent circle
            HBRUSH hCircleBrush = CreateSolidBrush(RGB(0, 168, 232));
            HPEN hCirclePen = CreatePen(PS_SOLID, 1, RGB(0, 120, 180));
            SelectObject(hdc, hCircleBrush);
            SelectObject(hdc, hCirclePen);
            Ellipse(hdc, 260, 150, 305, 195);
            DeleteObject(hCircleBrush);
            DeleteObject(hCirclePen);

            // 4. Render real-time status text
            SetTextColor(hdc, RGB(255, 255, 255));
            TextOut(hdc, 25, 150, "GDI 2D Canvas Active", 20);

            char status[48] = "Tick: ";
            char tickStr[16];
            itoa_simple(g_timerTicks, tickStr);
            int sp = 6;
            int tp = 0;
            while (tickStr[tp] != '\0') status[sp++] = tickStr[tp++];
            status[sp] = '\0';
            TextOut(hdc, 25, 172, status, sp);

            EndPaint(hwnd, &ps);
            return 0;
        }

        case WM_DESTROY: {
            KillTimer(hwnd, 1);
            PostQuitMessage(0);
            return 0;
        }

        default:
            return DefWindowProc(hwnd, uMsg, wParam, lParam);
    }
}

// Application Entry Point exported to WebAssembly runtime
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
    wc.lpszClassName = "SimpleCWasmWindowClass";

    if (!RegisterClassEx(&wc)) {
        return 1;
    }

    HWND hwnd = CreateWindowEx(
        0,
        "SimpleCWasmWindowClass",
        "Simple C Win32 App (WASM)",
        WS_OVERLAPPEDWINDOW | WS_VISIBLE,
        160, 120, 345, 245,
        NULL, NULL, hInstance, NULL
    );

    if (!hwnd) {
        return 2;
    }

    ShowWindow(hwnd, SW_SHOW);
    UpdateWindow(hwnd);

    return 0;
}
