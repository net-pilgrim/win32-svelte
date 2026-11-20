/*
 * _wasm_platform.h - Freestanding WebAssembly Platform Header & Compatibility Shims
 * Generated for win32-svelte WebAssembly environment.
 *
 * Provides missing runtime functions, libc shims, and Win32 compatibility stubs
 * for compiling native Win32 C applications directly to wasm32-freestanding.
 */

#ifndef _WASM_PLATFORM_H
#define _WASM_PLATFORM_H

#ifdef __cplusplus
extern "C" {
#endif

// Win32 Import Attribute for WebAssembly
#ifndef WIN32_IMPORT
#define WIN32_IMPORT(name) __attribute__((import_module("win32"), import_name(name)))
#endif

#ifndef min
#define min(a,b)            (((a) < (b)) ? (a) : (b))
#endif
#ifndef max
#define max(a,b)            (((a) > (b)) ? (a) : (b))
#endif

// Base Win32 Types
#ifndef _WINDEF_H
#include "windef.h"
#endif

#ifndef MAKEINTRESOURCEA
#define MAKEINTRESOURCEA(i) ((LPSTR)((ULONG_PTR)((WORD)(i))))
#endif
#ifndef MAKEINTRESOURCEW
#define MAKEINTRESOURCEW(i) ((LPWSTR)((ULONG_PTR)((WORD)(i))))
#endif
#ifndef MAKEINTRESOURCE
#ifdef UNICODE
#define MAKEINTRESOURCE     MAKEINTRESOURCEW
#else
#define MAKEINTRESOURCE     MAKEINTRESOURCEA
#endif
#endif

// ============================================================================
// Minimal Freestanding C Runtime Polyfills
// ============================================================================

#ifndef _SIZE_T_DEFINED
#define _SIZE_T_DEFINED
typedef unsigned long size_t;
#endif

#ifndef _UINTPTR_T_DEFINED
#define _UINTPTR_T_DEFINED
typedef unsigned long uintptr_t;
#endif

#ifndef _LPINT_DEFINED
#define _LPINT_DEFINED
typedef int *LPINT, *PINT;
#endif

static inline void *wasm_memset(void *dest, int c, size_t n) {
    unsigned char *d = (unsigned char *)dest;
    while (n--) *d++ = (unsigned char)c;
    return dest;
}

static inline void *wasm_memcpy(void *dest, const void *src, size_t n) {
    unsigned char *d = (unsigned char *)dest;
    const unsigned char *s = (const unsigned char *)src;
    while (n--) *d++ = *s++;
    return dest;
}

static inline size_t wasm_strlen(const char *s) {
    size_t len = 0;
    while (s && *s++) len++;
    return len;
}

static inline char *wasm_strcpy(char *dest, const char *src) {
    char *d = dest;
    while ((*d++ = *src++));
    return dest;
}

static inline int wasm_strcmp(const char *s1, const char *s2) {
    while (*s1 && (*s1 == *s2)) {
        s1++;
        s2++;
    }
    return *(const unsigned char *)s1 - *(const unsigned char *)s2;
}

#ifndef memset
#define memset wasm_memset
#endif
#ifndef memcpy
#define memcpy wasm_memcpy
#endif
#ifndef strlen
#define strlen wasm_strlen
#endif
#ifndef strcpy
#define strcpy wasm_strcpy
#endif
#ifndef strcmp
#define strcmp wasm_strcmp
#endif

#ifndef lstrlenA
#define lstrlenA wasm_strlen
#endif
#ifndef lstrlenW
static inline int wasm_lstrlenW(const unsigned short *s) {
    int len = 0;
    while (s && *s++) len++;
    return len;
}
#define lstrlenW wasm_lstrlenW
#endif
#ifndef lstrlen
#ifdef UNICODE
#define lstrlen lstrlenW
#else
#define lstrlen lstrlenA
#endif
#endif

// Pseudo-random number generator
#ifndef _RAND_DEFINED
#define _RAND_DEFINED
static unsigned long _wasm_next_rand = 1;
static inline int wasm_rand(void) {
    _wasm_next_rand = _wasm_next_rand * 1103515245 + 12345;
    return (int)((unsigned int)(_wasm_next_rand / 65536) % 32768);
}
static inline void wasm_srand(unsigned int seed) {
    _wasm_next_rand = seed;
}
#ifndef rand
#define rand wasm_rand
#endif
#ifndef srand
#define srand wasm_srand
#endif
#endif

// ============================================================================
// Win32 Platform Compatibility & Window Management Shims
// ============================================================================

// Window Procedure callback
#ifndef _WNDPROC_DEFINED
#define _WNDPROC_DEFINED
typedef LRESULT (CALLBACK *WNDPROC)(HWND, UINT, WPARAM, LPARAM);
#endif

// Window Class Structures
#ifndef _WNDCLASS_DEFINED
#define _WNDCLASS_DEFINED
typedef struct tagWNDCLASSA {
    UINT        style;
    WNDPROC     lpfnWndProc;
    int         cbClsExtra;
    int         cbWndExtra;
    HINSTANCE   hInstance;
    HICON       hIcon;
    HCURSOR     hCursor;
    HBRUSH      hbrBackground;
    LPCSTR      lpszMenuName;
    LPCSTR      lpszClassName;
} WNDCLASSA, *PWNDCLASSA, *NPWNDCLASSA, *LPWNDCLASSA;

typedef WNDCLASSA WNDCLASS;
typedef PWNDCLASSA PWNDCLASS;
typedef NPWNDCLASSA NPWNDCLASS;
typedef LPWNDCLASSA LPWNDCLASS;
#endif

// Class Styles (CS_*)
#ifndef CS_VREDRAW
#define CS_VREDRAW          0x0001
#define CS_HREDRAW          0x0002
#define CS_DBLCLKS          0x0008
#define CS_OWNDC            0x0020
#define CS_CLASSDC          0x0040
#define CS_PARENTDC         0x0080
#define CS_NOCLOSE          0x0200
#define CS_SAVEBITS         0x0800
#define CS_BYTEALIGNCLIENT  0x1000
#define CS_BYTEALIGNWINDOW  0x2000
#define CS_GLOBALCLASS      0x4000
#endif

// Standard Icons & Cursors
#ifndef IDI_APPLICATION
#define IDI_APPLICATION     MAKEINTRESOURCE(32512)
#define IDI_HAND            MAKEINTRESOURCE(32513)
#define IDI_QUESTION        MAKEINTRESOURCE(32514)
#define IDI_EXCLAMATION     MAKEINTRESOURCE(32515)
#define IDI_ASTERISK        MAKEINTRESOURCE(32516)
#define IDI_WINLOGO         MAKEINTRESOURCE(32517)
#define IDI_WARNING         IDI_EXCLAMATION
#define IDI_ERROR           IDI_HAND
#define IDI_INFORMATION     IDI_ASTERISK
#endif

#ifndef IDC_ARROW
#define IDC_ARROW           MAKEINTRESOURCE(32512)
#define IDC_IBEAM           MAKEINTRESOURCE(32513)
#define IDC_WAIT            MAKEINTRESOURCE(32514)
#define IDC_CROSS           MAKEINTRESOURCE(32515)
#define IDC_UPARROW         MAKEINTRESOURCE(32516)
#define IDC_SIZE            MAKEINTRESOURCE(32640)
#define IDC_ICON            MAKEINTRESOURCE(32641)
#define IDC_SIZENWSE        MAKEINTRESOURCE(32642)
#define IDC_SIZENESW        MAKEINTRESOURCE(32643)
#define IDC_SIZEWE          MAKEINTRESOURCE(32644)
#define IDC_SIZENS          MAKEINTRESOURCE(32645)
#define IDC_SIZEALL         MAKEINTRESOURCE(32646)
#define IDC_NO              MAKEINTRESOURCE(32648)
#define IDC_HAND            MAKEINTRESOURCE(32649)
#define IDC_APPSTARTING     MAKEINTRESOURCE(32650)
#define IDC_HELP            MAKEINTRESOURCE(32651)
#endif

#ifndef MK_LBUTTON
#define MK_LBUTTON          0x0001
#define MK_RBUTTON          0x0002
#define MK_SHIFT            0x0004
#define MK_CONTROL          0x0008
#define MK_MBUTTON          0x0010
#endif

// Default window coordinates
#ifndef CW_USEDEFAULT
#define CW_USEDEFAULT       ((int)0x80000000)
#endif

// CreateWindow macro wrapping CreateWindowExA
#ifndef CreateWindowA
#define CreateWindowA(lpClassName, lpWindowName, dwStyle, x, y, nWidth, nHeight, hWndParent, hMenu, hInstance, lpParam) \
    CreateWindowExA(0L, lpClassName, lpWindowName, dwStyle, x, y, nWidth, nHeight, hWndParent, hMenu, hInstance, lpParam)
#define CreateWindow CreateWindowA
#endif

// Stock Objects
#ifndef WHITE_BRUSH
#define WHITE_BRUSH         0
#define LTGRAY_BRUSH        1
#define GRAY_BRUSH          2
#define DKGRAY_BRUSH        3
#define BLACK_BRUSH         4
#define NULL_BRUSH          5
#define HOLLOW_BRUSH        NULL_BRUSH
#define WHITE_PEN           6
#define BLACK_PEN           7
#define NULL_PEN            8
#define OEM_FIXED_FONT      10
#define ANSI_FIXED_FONT     11
#define ANSI_VAR_FONT       12
#define SYSTEM_FONT         13
#define DEVICE_DEFAULT_FONT 14
#define DEFAULT_PALETTE     15
#define SYSTEM_FIXED_FONT   16
#define DEFAULT_GUI_FONT    17
#define DC_BRUSH            18
#define DC_PEN              19
#endif

// Multimedia / PlaySound flags
#ifndef SND_SYNC
#define SND_SYNC            0x00000000
#define SND_ASYNC           0x00000001
#define SND_NODEFAULT       0x00000002
#define SND_MEMORY          0x00000004
#define SND_LOOP            0x00000008
#define SND_NOSTOP          0x00000010
#define SND_NOWAIT          0x00002000
#define SND_ALIAS           0x00010000
#define SND_FILENAME        0x00020000
#define SND_RESOURCE        0x00040004
#define SND_PURGE           0x00000040
#define SND_APPLICATION     0x00000080
#endif

// ============================================================================
// Text Metrics & GDI Text Alignment (Chap 04)
// ============================================================================

#ifndef _TEXTMETRIC_DEFINED
#define _TEXTMETRIC_DEFINED
typedef struct tagTEXTMETRICA {
    LONG        tmHeight;
    LONG        tmAscent;
    LONG        tmDescent;
    LONG        tmInternalLeading;
    LONG        tmExternalLeading;
    LONG        tmAveCharWidth;
    LONG        tmMaxCharWidth;
    LONG        tmWeight;
    LONG        tmOverhang;
    LONG        tmDigitizedAspectX;
    LONG        tmDigitizedAspectY;
    BYTE        tmFirstChar;
    BYTE        tmLastChar;
    BYTE        tmDefaultChar;
    BYTE        tmBreakChar;
    BYTE        tmItalic;
    BYTE        tmUnderlined;
    BYTE        tmStruckOut;
    BYTE        tmPitchAndFamily;
    BYTE        tmCharSet;
} TEXTMETRICA, *PTEXTMETRICA, *NPTEXTMETRICA, *LPTEXTMETRICA;

typedef TEXTMETRICA TEXTMETRIC;
typedef PTEXTMETRICA PTEXTMETRIC;
typedef LPTEXTMETRICA LPTEXTMETRIC;
#endif

#ifndef TA_NOUPDATECP
#define TA_NOUPDATECP       0
#define TA_UPDATECP         1
#define TA_LEFT             0
#define TA_RIGHT            2
#define TA_CENTER           6
#define TA_TOP              0
#define TA_BOTTOM           8
#define TA_BASELINE         24
#endif

// ============================================================================
// GDI Device Capabilities, Mapping Modes & Advanced Drawing (Chap 05)
// ============================================================================

#ifndef DRIVERVERSION
#define DRIVERVERSION       0
#define TECHNOLOGY          2
#define HORZSIZE            4
#define VERTSIZE            6
#define HORZRES             8
#define VERTRES             10
#define BITSPIXEL           12
#define PLANES              14
#define NUMBRUSHES          16
#define NUMPENS             18
#define NUMMARKERS          20
#define NUMFONTS            22
#define NUMCOLORS           24
#define PDEVICESIZE         26
#define CURVECAPS           28
#define LINECAPS            30
#define POLYGONALCAPS       32
#define TEXTCAPS            34
#define CLIPCAPS            36
#define RASTERCAPS          38
#define ASPECTX             40
#define ASPECTY             42
#define ASPECTXY            44
#define LOGPIXELSX          88
#define LOGPIXELSY          90
#define SIZEPALETTE         104
#define NUMRESERVED         106
#define COLORRES            108
#endif

#ifndef MM_TEXT
#define MM_TEXT             1
#define MM_LOMETRIC         2
#define MM_HIMETRIC         3
#define MM_LOENGLISH        4
#define MM_HIENGLISH        5
#define MM_TWIPS            6
#define MM_ISOTROPIC        7
#define MM_ANISOTROPIC      8
#endif

#ifndef RGN_AND
#define RGN_AND             1
#define RGN_OR              2
#define RGN_XOR             3
#define RGN_DIFF            4
#define RGN_COPY            5
#endif

#ifndef ALTERNATE
#define ALTERNATE           1
#define WINDING             2
#endif

WIN32_IMPORT("GetDeviceCaps")
int WINAPI GetDeviceCaps(HDC hdc, int nIndex);

WIN32_IMPORT("SetMapMode")
int WINAPI SetMapMode(HDC hdc, int iMode);

WIN32_IMPORT("GetMapMode")
int WINAPI GetMapMode(HDC hdc);

WIN32_IMPORT("SetWindowExtEx")
BOOL WINAPI SetWindowExtEx(HDC hdc, int x, int y, LPSIZE lpsz);

WIN32_IMPORT("SetViewportExtEx")
BOOL WINAPI SetViewportExtEx(HDC hdc, int x, int y, LPSIZE lpsz);

WIN32_IMPORT("SetWindowOrgEx")
BOOL WINAPI SetWindowOrgEx(HDC hdc, int x, int y, LPPOINT lppt);

WIN32_IMPORT("SetViewportOrgEx")
BOOL WINAPI SetViewportOrgEx(HDC hdc, int x, int y, LPPOINT lppt);

WIN32_IMPORT("DPtoLP")
BOOL WINAPI DPtoLP(HDC hdc, LPPOINT lppt, int c);

WIN32_IMPORT("LPtoDP")
BOOL WINAPI LPtoDP(HDC hdc, LPPOINT lppt, int c);

WIN32_IMPORT("PolyBezier")
BOOL WINAPI PolyBezier(HDC hdc, const POINT *apt, DWORD cpt);

WIN32_IMPORT("Polyline")
BOOL WINAPI Polyline(HDC hdc, const POINT *apt, int cpt);

WIN32_IMPORT("Polygon")
BOOL WINAPI Polygon(HDC hdc, const POINT *apt, int cpt);

WIN32_IMPORT("PolyPolygon")
BOOL WINAPI PolyPolygon(HDC hdc, const POINT *apt, const INT *asz, int csz);

WIN32_IMPORT("RoundRect")
BOOL WINAPI RoundRect(HDC hdc, int left, int top, int right, int bottom, int width, int height);

WIN32_IMPORT("Arc")
BOOL WINAPI Arc(HDC hdc, int x1, int y1, int x2, int y2, int x3, int y3, int x4, int y4);

WIN32_IMPORT("Chord")
BOOL WINAPI Chord(HDC hdc, int x1, int y1, int x2, int y2, int x3, int y3, int x4, int y4);

WIN32_IMPORT("Pie")
BOOL WINAPI Pie(HDC hdc, int x1, int y1, int x2, int y2, int x3, int y3, int x4, int y4);

WIN32_IMPORT("SetPolyFillMode")
int WINAPI SetPolyFillMode(HDC hdc, int mode);

WIN32_IMPORT("CreateRectRgn")
HRGN WINAPI CreateRectRgn(int x1, int y1, int x2, int y2);

WIN32_IMPORT("CreateEllipticRgn")
HRGN WINAPI CreateEllipticRgn(int x1, int y1, int x2, int y2);

WIN32_IMPORT("CombineRgn")
int WINAPI CombineRgn(HRGN hrgnDest, HRGN hrgnSrc1, HRGN hrgnSrc2, int fnCombineMode);

WIN32_IMPORT("SelectClipRgn")
int WINAPI SelectClipRgn(HDC hdc, HRGN hrgn);

WIN32_IMPORT("SaveDC")
int WINAPI SaveDC(HDC hdc);

WIN32_IMPORT("RestoreDC")
BOOL WINAPI RestoreDC(HDC hdc, int nSavedDC);

// ============================================================================
// Scrollbars (Chap 04 - SysMets2 & SysMets3)
// ============================================================================

#ifndef WM_HSCROLL
#define WM_HSCROLL          0x0114
#define WM_VSCROLL          0x0115
#endif

#ifndef WS_VSCROLL
#define WS_VSCROLL          0x00200000L
#define WS_HSCROLL          0x00100000L
#endif

#ifndef SB_HORZ
#define SB_HORZ             0
#define SB_VERT             1
#define SB_CTL              2
#define SB_BOTH             3
#endif

#ifndef SB_LINEUP
#define SB_LINEUP           0
#define SB_LINELEFT         0
#define SB_LINEDOWN         1
#define SB_LINERIGHT        1
#define SB_PAGEUP           2
#define SB_PAGELEFT         2
#define SB_PAGEDOWN         3
#define SB_PAGERIGHT        3
#define SB_THUMBPOSITION    4
#define SB_THUMBTRACK       5
#define SB_TOP              6
#define SB_LEFT             6
#define SB_BOTTOM           7
#define SB_RIGHT            7
#define SB_ENDSCROLL        8
#endif

#ifndef SIF_RANGE
#define SIF_RANGE           0x0001
#define SIF_PAGE            0x0002
#define SIF_POS             0x0004
#define SIF_DISABLENOSCROLL 0x0008
#define SIF_TRACKPOS        0x0010
#define SIF_ALL             (SIF_RANGE | SIF_PAGE | SIF_POS | SIF_TRACKPOS)
#endif

#ifndef _SCROLLINFO_DEFINED
#define _SCROLLINFO_DEFINED
typedef struct tagSCROLLINFO {
    UINT    cbSize;
    UINT    fMask;
    int     nMin;
    int     nMax;
    UINT    nPage;
    int     nPos;
    int     nTrackPos;
} SCROLLINFO, *PSCROLLINFO, *LPSCROLLINFO;
typedef const SCROLLINFO *LPCSCROLLINFO;
#endif

// ============================================================================
// Runtime WASM Imported Functions & Forward Declarations
// ============================================================================

#ifndef _MSG_DEFINED
#define _MSG_DEFINED
typedef struct tagMSG {
    HWND        hwnd;
    UINT        message;
    WPARAM      wParam;
    LPARAM      lParam;
    DWORD       time;
    POINT       pt;
} MSG, *PMSG, *NPMSG, *LPMSG;
#endif

WIN32_IMPORT("RegisterClassA")
ATOM WINAPI RegisterClassA(const WNDCLASSA *lpWndClass);

#ifndef RegisterClass
#define RegisterClass RegisterClassA
#endif

WIN32_IMPORT("LoadIconA")
HICON WINAPI LoadIconA(HINSTANCE hInstance, LPCSTR lpIconName);

#ifndef LoadIcon
#define LoadIcon LoadIconA
#endif

WIN32_IMPORT("LoadCursorA")
HCURSOR WINAPI LoadCursorA(HINSTANCE hInstance, LPCSTR lpCursorName);

#ifndef LoadCursor
#define LoadCursor LoadCursorA
#endif

WIN32_IMPORT("SetCursor")
HCURSOR WINAPI SetCursor(HCURSOR hCursor);

WIN32_IMPORT("ShowCursor")
int WINAPI ShowCursor(BOOL bShow);

WIN32_IMPORT("GetStockObject")
HGDIOBJ WINAPI GetStockObject(int i);

#ifndef PM_REMOVE
#define PM_NOREMOVE         0x0000
#define PM_REMOVE           0x0001
#define PM_NOYIELD          0x0002
#endif

WIN32_IMPORT("PeekMessageA")
BOOL WINAPI PeekMessageA(LPMSG lpMsg, HWND hWnd, UINT wMsgFilterMin, UINT wMsgFilterMax, UINT wRemoveMsg);

#ifndef PeekMessage
#define PeekMessage PeekMessageA
#endif

static inline BOOL wasm_SetRect(LPRECT lprc, int xLeft, int yTop, int xRight, int yBottom) {
    if (!lprc) return 0;
    lprc->left = xLeft;
    lprc->top = yTop;
    lprc->right = xRight;
    lprc->bottom = yBottom;
    return 1;
}
#ifndef SetRect
#define SetRect wasm_SetRect
#endif

WIN32_IMPORT("GetMessageA")
BOOL WINAPI GetMessageA(LPMSG lpMsg, HWND hWnd, UINT wMsgFilterMin, UINT wMsgFilterMax);

#ifndef GetMessage
#define GetMessage GetMessageA
#endif

WIN32_IMPORT("TranslateMessage")
BOOL WINAPI TranslateMessage(const MSG *lpMsg);

WIN32_IMPORT("DispatchMessageA")
LRESULT WINAPI DispatchMessageA(const MSG *lpMsg);

#ifndef DispatchMessage
#define DispatchMessage DispatchMessageA
#endif

WIN32_IMPORT("PlaySoundA")
BOOL WINAPI PlaySoundA(LPCSTR pszSound, HMODULE hmod, DWORD fdwSound);

#ifndef PlaySound
#define PlaySound PlaySoundA
#endif

WIN32_IMPORT("sndPlaySoundA")
BOOL WINAPI sndPlaySoundA(LPCSTR pszSound, UINT fuSound);

#ifndef sndPlaySound
#define sndPlaySound sndPlaySoundA
#endif

WIN32_IMPORT("GetDC")
HDC WINAPI GetDC(HWND hWnd);

WIN32_IMPORT("ReleaseDC")
int WINAPI ReleaseDC(HWND hWnd, HDC hDC);

WIN32_IMPORT("GetTextMetricsA")
BOOL WINAPI GetTextMetricsA(HDC hdc, LPTEXTMETRICA lptm);

#ifndef GetTextMetrics
#define GetTextMetrics GetTextMetricsA
#endif

WIN32_IMPORT("SetTextAlign")
UINT WINAPI SetTextAlign(HDC hdc, UINT align);

WIN32_IMPORT("ScrollWindow")
BOOL WINAPI ScrollWindow(HWND hWnd, int XAmount, int YAmount, const RECT *lpRect, const RECT *lpClipRect);

WIN32_IMPORT("SetScrollInfo")
int WINAPI SetScrollInfo(HWND hwnd, int nBar, const SCROLLINFO *lpsi, BOOL redraw);

WIN32_IMPORT("GetScrollInfo")
BOOL WINAPI GetScrollInfo(HWND hwnd, int nBar, LPSCROLLINFO lpsi);

WIN32_IMPORT("SetScrollPos")
int WINAPI SetScrollPos(HWND hWnd, int nBar, int nPos, BOOL bRedraw);

WIN32_IMPORT("GetScrollPos")
int WINAPI GetScrollPos(HWND hWnd, int nBar);

WIN32_IMPORT("SetScrollRange")
BOOL WINAPI SetScrollRange(HWND hWnd, int nBar, int nMinPos, int nMaxPos, BOOL bRedraw);

WIN32_IMPORT("GetScrollRange")
BOOL WINAPI GetScrollRange(HWND hWnd, int nBar, LPINT lpMinPos, LPINT lpMaxPos);

// Win32 wsprintf implementation
#include "stdio.h"
#include "stdarg.h"
static inline int wasm_wsprintfA(char *buffer, const char *format, ...) {
    va_list args;
    va_start(args, format);
    int n = vsnprintf(buffer, 1024, format, args);
    va_end(args);
    return n;
}
#ifndef wsprintfA
#define wsprintfA wasm_wsprintfA
#endif
#ifndef wsprintf
#define wsprintf wasm_wsprintfA
#endif

#ifdef __cplusplus
}
#endif

#endif // _WASM_PLATFORM_H
