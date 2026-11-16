#include "../../include/windows.h"

#define IDC_BTN_MSGBOX  1001
#define IDC_BTN_COUNTER 1002
#define IDC_BTN_REFRESH 1003
#define IDC_STATIC_INFO 1004
#define IDC_BTN_VIEW_C  1005
#define IDC_BTN_VIEW_H  1006

static HWND g_hBtnCounter = NULL;
static int g_counter = 0;

// Procedural real-time animation state
static int g_ticks = 0;
static int g_ballX = 60;
static int g_ballY = 175;
static int g_ballDX = 4;
static int g_ballDY = 3;
static int g_ballRadius = 9;

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

            // Start 30 FPS animation timer (~33ms ticks)
            SetTimer(hwnd, 1, 33, NULL);

            return 0;
        }

        case WM_TIMER: {
            if (wParam == 1) {
                g_ticks++;

                // Update animated ball coordinates
                g_ballX += g_ballDX;
                g_ballY += g_ballDY;

                // Bounds inside animation arena: x in [25, 325], y in [150, 245]
                if (g_ballX - g_ballRadius <= 20) {
                    g_ballX = 20 + g_ballRadius;
                    g_ballDX = -g_ballDX;
                } else if (g_ballX + g_ballRadius >= 330) {
                    g_ballX = 330 - g_ballRadius;
                    g_ballDX = -g_ballDX;
                }

                if (g_ballY - g_ballRadius <= 145) {
                    g_ballY = 145 + g_ballRadius;
                    g_ballDY = -g_ballDY;
                } else if (g_ballY + g_ballRadius >= 245) {
                    g_ballY = 245 - g_ballRadius;
                    g_ballDY = -g_ballDY;
                }

                // Invalidate window to trigger WM_PAINT for real-time rendering
                InvalidateRect(hwnd, NULL, FALSE);
                return 0;
            }
            return 0;
        }

        case WM_COMMAND: {
            WORD id = LOWORD(wParam);
            if (id == IDC_BTN_MSGBOX) {
                MessageBeep(MB_ICONINFORMATION);
                MessageBox(
                    hwnd,
                    "Hello from native C99 Win32 code!\n\n"
                    "• Compiled with: zig cc -target wasm32-freestanding\n"
                    "• Header: <windows.h>\n"
                    "• Runtime: win32-svelte (Svelte 5 + 98.css)\n"
                    "• Real-time GDI: 30-60 FPS procedural animation\n\n"
                    "Functions, callbacks, and structs are bridged into WASM memory!",
                    "WASM Win32 Native App",
                    MB_OK | MB_ICONINFORMATION
                );
                return 0;
            }

            if (id == IDC_BTN_COUNTER) {
                g_counter++;
                update_counter_button(hwnd);
                MessageBeep(0xFFFFFFFF);
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

            RECT clientRc;
            GetClientRect(hwnd, &clientRc);

            // 1. Fill animation arena with dark navy brush via FillRect
            RECT animRc = { 15, 140, 335, 255 };
            HBRUSH hNavyBrush = CreateSolidBrush(RGB(0, 0, 128));
            FillRect(hdc, &animRc, hNavyBrush);
            DeleteObject(hNavyBrush);

            // 2. Draw coordinate axes with custom pen via CreatePen, MoveToEx, LineTo
            HPEN hGridPen = CreatePen(PS_SOLID, 1, RGB(0, 96, 160));
            SelectObject(hdc, hGridPen);
            MoveToEx(hdc, 15, 197, NULL);
            LineTo(hdc, 335, 197);
            MoveToEx(hdc, 175, 140, NULL);
            LineTo(hdc, 175, 255);
            DeleteObject(hGridPen);

            // 3. Draw animated bouncing ball with yellow brush and black border
            HBRUSH hBallBrush = CreateSolidBrush(RGB(255, 255, 0));
            HPEN hBallPen = CreatePen(PS_SOLID, 1, RGB(0, 0, 0));
            SelectObject(hdc, hBallBrush);
            SelectObject(hdc, hBallPen);
            Ellipse(hdc, g_ballX - g_ballRadius, g_ballY - g_ballRadius,
                         g_ballX + g_ballRadius, g_ballY + g_ballRadius);
            DeleteObject(hBallBrush);
            DeleteObject(hBallPen);

            // 4. Draw orbital accent ring
            HPEN hRingPen = CreatePen(PS_SOLID, 1, RGB(0, 255, 128));
            HBRUSH hNullBrush = CreateSolidBrush(RGB(0, 0, 128));
            SelectObject(hdc, hRingPen);
            SelectObject(hdc, hNullBrush);
            Ellipse(hdc, 275, 150, 325, 200);
            DeleteObject(hRingPen);
            DeleteObject(hNullBrush);

            // 5. Draw formatted centered title with DrawText (DT_CENTER | DT_SINGLELINE)
            SetTextColor(hdc, RGB(255, 255, 255));
            RECT titleRc = { 15, 144, 335, 162 };
            DrawText(hdc, "⚡ Real-Time Procedural GDI Animation (30 FPS)", -1, &titleRc, DT_CENTER | DT_SINGLELINE);

            // 6. Draw dynamic frame tick and coordinate status line via DrawText
            char status[80] = "Tick: ";
            char tickStr[16];
            int_to_str(g_ticks, tickStr);
            int sp = 6;
            int tp = 0;
            while (tickStr[tp] != '\0') status[sp++] = tickStr[tp++];
            const char *mid = " | Ball: (";
            int mp = 0;
            while (mid[mp] != '\0') status[sp++] = mid[mp++];
            char numX[16], numY[16];
            int_to_str(g_ballX, numX);
            int_to_str(g_ballY, numY);
            int xp = 0;
            while (numX[xp] != '\0') status[sp++] = numX[xp++];
            status[sp++] = ',';
            status[sp++] = ' ';
            int yp = 0;
            while (numY[yp] != '\0') status[sp++] = numY[yp++];
            status[sp++] = ')';
            status[sp] = '\0';

            RECT statusRc = { 15, 235, 335, 252 };
            DrawText(hdc, status, -1, &statusRc, DT_CENTER | DT_SINGLELINE);

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
        140, 110, 355, 295,
        NULL, NULL, hInstance, NULL
    );

    if (!hwnd) {
        return 2;
    }

    ShowWindow(hwnd, SW_SHOW);
    UpdateWindow(hwnd);

    return 0;
}
