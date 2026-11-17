/*
 * afxwin.h - Freestanding C++ Microsoft Foundation Classes (MFC) Header for WebAssembly (WASM32)
 *
 * Provides minimal object-oriented MFC class hierarchy for freestanding C++:
 * - CObject: Basic RTTI and runtime class helpers
 * - CCmdTarget: Command target base class
 * - CWnd: HWND encapsulation, ShowWindow, UpdateWindow, SetWindowText, Invalidate
 * - CFrameWnd: Single-document interface (SDI) frame window creation
 * - CPaintDC: Scoped BeginPaint / EndPaint device context wrapper
 * - CWinApp: Application object lifecycle (InitInstance)
 */

#ifndef _AFXWIN_H
#define _AFXWIN_H

#include "windows.h"

// Freestanding C++ runtime stubs
#ifdef __cplusplus
extern "C" {
    inline void* memset(void* dest, int c, unsigned long n) {
        char* d = (char*)dest;
        while (n--) *d++ = (char)c;
        return dest;
    }
    inline int __cxa_atexit(void (*)(void*), void*, void*) {
        return 0;
    }
}

void operator delete(void*) noexcept {}
void operator delete(void*, unsigned long) noexcept {}
#endif

#ifdef __cplusplus

class CObject {
public:
    virtual ~CObject() {}
    virtual const char* GetRuntimeClass() const { return "CObject"; }
    virtual BOOL IsKindOf(const char* className) const {
        return className && className[0] == 'C' && className[1] == 'O';
    }
};

class CCmdTarget : public CObject {
public:
    virtual const char* GetRuntimeClass() const { return "CCmdTarget"; }
};

class CWnd : public CCmdTarget {
public:
    HWND m_hWnd;

    CWnd() : m_hWnd(NULL) {}
    virtual ~CWnd() {}

    virtual const char* GetRuntimeClass() const { return "CWnd"; }

    BOOL Attach(HWND hWnd) {
        m_hWnd = hWnd;
        return m_hWnd != NULL;
    }

    HWND Detach() {
        HWND hWnd = m_hWnd;
        m_hWnd = NULL;
        return hWnd;
    }

    BOOL ShowWindow(int nCmdShow = SW_SHOW) {
        return ::ShowWindow(m_hWnd, nCmdShow);
    }

    BOOL UpdateWindow() {
        return ::UpdateWindow(m_hWnd);
    }

    BOOL SetWindowText(LPCSTR lpszString) {
        return ::SetWindowTextA(m_hWnd, lpszString);
    }

    int GetWindowText(LPSTR lpString, int nMaxCount) {
        return ::GetWindowTextA(m_hWnd, lpString, nMaxCount);
    }

    BOOL Invalidate(BOOL bErase = TRUE) {
        return ::InvalidateRect(m_hWnd, NULL, bErase);
    }

    BOOL InvalidateRect(LPCRECT lpRect, BOOL bErase = TRUE) {
        return ::InvalidateRect(m_hWnd, lpRect, bErase);
    }

    BOOL GetClientRect(LPRECT lpRect) {
        return ::GetClientRect(m_hWnd, lpRect);
    }

    LRESULT SendMessage(UINT message, WPARAM wParam = 0, LPARAM lParam = 0) {
        return ::SendMessageA(m_hWnd, message, wParam, lParam);
    }

    BOOL PostMessage(UINT message, WPARAM wParam = 0, LPARAM lParam = 0) {
        return ::PostMessageA(m_hWnd, message, wParam, lParam);
    }

    UINT_PTR SetTimer(UINT_PTR nIDEvent, UINT nElapse) {
        return ::SetTimer(m_hWnd, nIDEvent, nElapse, NULL);
    }

    BOOL KillTimer(UINT_PTR nIDEvent) {
        return ::KillTimer(m_hWnd, nIDEvent);
    }
};

class CFrameWnd : public CWnd {
public:
    virtual const char* GetRuntimeClass() const { return "CFrameWnd"; }

    BOOL Create(
        LPCSTR lpszClassName,
        LPCSTR lpszWindowName,
        DWORD dwStyle = WS_OVERLAPPEDWINDOW | WS_VISIBLE,
        int x = 140,
        int y = 100,
        int nWidth = 380,
        int nHeight = 280,
        HWND hWndParent = NULL,
        HMENU hMenu = NULL,
        HINSTANCE hInstance = NULL
    ) {
        m_hWnd = ::CreateWindowExA(
            0,
            lpszClassName,
            lpszWindowName,
            dwStyle,
            x, y, nWidth, nHeight,
            hWndParent,
            hMenu,
            hInstance,
            NULL
        );
        return m_hWnd != NULL;
    }
};

class CPaintDC {
public:
    HDC m_hDC;
    PAINTSTRUCT m_ps;
    HWND m_hWnd;

    CPaintDC(CWnd* pWnd) : m_hWnd(pWnd ? pWnd->m_hWnd : NULL) {
        m_hDC = ::BeginPaint(m_hWnd, &m_ps);
    }

    CPaintDC(HWND hWnd) : m_hWnd(hWnd) {
        m_hDC = ::BeginPaint(m_hWnd, &m_ps);
    }

    ~CPaintDC() {
        if (m_hWnd) {
            ::EndPaint(m_hWnd, &m_ps);
        }
    }

    BOOL Rectangle(int left, int top, int right, int bottom) {
        return ::Rectangle(m_hDC, left, top, right, bottom);
    }

    BOOL Ellipse(int left, int top, int right, int bottom) {
        return ::Ellipse(m_hDC, left, top, right, bottom);
    }

    BOOL TextOut(int x, int y, LPCSTR lpString, int nCount) {
        return ::TextOutA(m_hDC, x, y, lpString, nCount);
    }

    COLORREF SetTextColor(COLORREF crColor) {
        return ::SetTextColor(m_hDC, crColor);
    }

    int DrawText(LPCSTR lpchText, int nCount, LPRECT lpRect, UINT uFormat) {
        return ::DrawTextA(m_hDC, lpchText, nCount, lpRect, uFormat);
    }

    BOOL FillRect(LPCRECT lpRect, HBRUSH hbr) {
        return ::FillRect(m_hDC, lpRect, hbr);
    }

    HGDIOBJ SelectObject(HGDIOBJ h) {
        return ::SelectObject(m_hDC, h);
    }
};

class CWinApp : public CCmdTarget {
public:
    CWnd* m_pMainWnd;
    LPCSTR m_pszAppName;

    CWinApp(LPCSTR appName = "MFC Application") : m_pMainWnd(NULL), m_pszAppName(appName) {}
    virtual ~CWinApp() {}

    virtual const char* GetRuntimeClass() const { return "CWinApp"; }

    virtual BOOL InitInstance() {
        return TRUE;
    }

    virtual int ExitInstance() {
        return 0;
    }
};

#endif // __cplusplus

#endif // _AFXWIN_H
