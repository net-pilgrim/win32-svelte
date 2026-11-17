/**
 * main.cpp - Starter C++ MFC Application compiled to WebAssembly (WASM32)
 *
 * Demonstrates:
 * - Freestanding C++ (wasm32-freestanding) with -fno-exceptions -fno-rtti.
 * - MFC class hierarchy: CObject -> CCmdTarget -> CWnd -> CFrameWnd.
 * - Application lifecycle with CWinApp.
 * - Scoped GDI device context drawing with CPaintDC.
 * - Interactive child controls (BUTTON, STATIC) and message handling.
 */

#include "afxwin.h"

#define IDC_BTN_CLICK   1001
#define IDC_BTN_MSGBOX  1002
#define IDC_STATIC_INFO 1003

static void itoa_simple(int val, char* buf) {
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

class CMyFrameWnd : public CFrameWnd {
public:
    HWND m_hBtnClick;
    int m_clicks;

    CMyFrameWnd() : m_hBtnClick(NULL), m_clicks(0) {}

    virtual const char* GetRuntimeClass() const override {
        return "CMyFrameWnd";
    }

    void OnCreate(HWND hwnd) {
        m_hWnd = hwnd;

        // Static description label
        CreateWindowExA(
            0, "STATIC",
            "C++ MFC Application running in WebAssembly!\nCompiled with zig c++ / clang++ via Makefile.",
            WS_CHILD | WS_VISIBLE,
            15, 12, 330, 36,
            hwnd, (HMENU)IDC_STATIC_INFO, NULL, NULL
        );

        // State counter button
        m_hBtnClick = CreateWindowExA(
            0, "BUTTON", "C++ Clicks: 0",
            WS_CHILD | WS_VISIBLE | BS_PUSHBUTTON,
            15, 54, 130, 26,
            hwnd, (HMENU)IDC_BTN_CLICK, NULL, NULL
        );

        // About prompt button
        CreateWindowExA(
            0, "BUTTON", "About MFC WASM",
            WS_CHILD | WS_VISIBLE | BS_PUSHBUTTON,
            155, 54, 140, 26,
            hwnd, (HMENU)IDC_BTN_MSGBOX, NULL, NULL
        );
    }

    void OnPaint() {
        CPaintDC dc(this);

        // Fill background arena
        RECT arenaRc = { 15, 90, 345, 230 };
        HBRUSH hBrush = CreateSolidBrush(RGB(20, 30, 55));
        dc.FillRect(&arenaRc, hBrush);
        DeleteObject(hBrush);

        // Draw rectangle
        HBRUSH hRectBrush = CreateSolidBrush(RGB(0, 102, 204));
        HPEN hWhitePen = CreatePen(PS_SOLID, 2, RGB(255, 255, 255));
        dc.SelectObject(hRectBrush);
        dc.SelectObject(hWhitePen);
        dc.Rectangle(30, 105, 180, 175);
        DeleteObject(hRectBrush);
        DeleteObject(hWhitePen);

        // Draw circle
        HBRUSH hCircleBrush = CreateSolidBrush(RGB(230, 126, 34));
        dc.SelectObject(hCircleBrush);
        dc.Ellipse(210, 105, 280, 175);
        DeleteObject(hCircleBrush);

        // Draw text
        dc.SetTextColor(RGB(255, 255, 255));
        dc.TextOut(35, 125, "CPaintDC::Rectangle", 19);
        dc.TextOut(20, 195, "MFC C++ Object-Oriented Win32 Core", 34);
    }

    void OnCommand(WORD id) {
        if (id == IDC_BTN_CLICK) {
            m_clicks++;
            char text[32] = "C++ Clicks: ";
            char num[16];
            itoa_simple(m_clicks, num);
            int p = 12, n = 0;
            while (num[n] != '\0') text[p++] = num[n++];
            text[p] = '\0';

            ::SetWindowTextA(m_hBtnClick, text);
            MessageBeep(0xFFFFFFFF);
        } else if (id == IDC_BTN_MSGBOX) {
            ::MessageBoxA(
                m_hWnd,
                "Hello from C++ Microsoft Foundation Classes (MFC) in WebAssembly!\n\n"
                "- Compiled from main.cpp with <afxwin.h>\n"
                "- CWinApp, CFrameWnd, CPaintDC\n"
                "- Zero libc footprint (~8 KB binary)",
                "MFC C++ WebAssembly",
                MB_OK | MB_ICONINFORMATION
            );
        }
    }
};

static CMyFrameWnd g_frame;

LRESULT CALLBACK MfcWndProc(HWND hwnd, UINT uMsg, WPARAM wParam, LPARAM lParam) {
    switch (uMsg) {
        case WM_CREATE:
            g_frame.OnCreate(hwnd);
            return 0;

        case WM_PAINT:
            g_frame.OnPaint();
            return 0;

        case WM_COMMAND:
            g_frame.OnCommand(LOWORD(wParam));
            return 0;

        case WM_DESTROY:
            PostQuitMessage(0);
            return 0;

        default:
            return DefWindowProcA(hwnd, uMsg, wParam, lParam);
    }
}

class CMyMfcApp : public CWinApp {
public:
    CMyMfcApp() : CWinApp("MFC C++ WASM Application") {}

    virtual BOOL InitInstance() override {
        WNDCLASSEX wc = {0};
        wc.cbSize = sizeof(WNDCLASSEX);
        wc.lpfnWndProc = MfcWndProc;
        wc.lpszClassName = "MfcWasmWindowClass";

        if (!RegisterClassExA(&wc)) {
            return FALSE;
        }

        if (!g_frame.Create(
            "MfcWasmWindowClass",
            "C++ MFC Application (WASM)",
            WS_OVERLAPPEDWINDOW | WS_VISIBLE,
            160, 100, 375, 275
        )) {
            return FALSE;
        }

        m_pMainWnd = &g_frame;
        g_frame.ShowWindow(SW_SHOW);
        g_frame.UpdateWindow();

        return TRUE;
    }
};

static CMyMfcApp theApp;

extern "C" __attribute__((export_name("WinMain")))
int WINAPI WinMain(HINSTANCE hInstance, HINSTANCE hPrevInstance, LPSTR lpCmdLine, int nShowCmd) {
    if (!theApp.InitInstance()) {
        return 1;
    }
    return 0;
}
