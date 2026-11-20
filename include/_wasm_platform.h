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

#include "stdlib.h"
#include "ctype.h"

#ifndef WM_DISPLAYCHANGE
#define WM_DISPLAYCHANGE    0x007E
#endif

#ifndef WM_INPUTLANGCHANGE
#define WM_INPUTLANGCHANGE  0x0051
#endif

#ifndef DEFAULT_CHARSET
#define ANSI_CHARSET        0
#define DEFAULT_CHARSET     1
#define SYMBOL_CHARSET      2
#define SHIFTJIS_CHARSET    128
#define HANGEUL_CHARSET     129
#define GB2312_CHARSET      134
#define CHINESEBIG5_CHARSET 136
#define OEM_CHARSET         255
#endif

#ifndef DEFAULT_PITCH
#define DEFAULT_PITCH       0
#define FIXED_PITCH         1
#define VARIABLE_PITCH      2
#endif

#ifndef LF_FACESIZE
#define LF_FACESIZE         32
#endif

WIN32_IMPORT("GetTextFaceA")
int WINAPI GetTextFaceA(HDC hdc, int c, LPSTR lpName);

#ifndef GetTextFace
#define GetTextFace GetTextFaceA
#endif

WIN32_IMPORT("CreateFontA")
HFONT WINAPI CreateFontA(
    int cHeight,
    int cWidth,
    int cEscapement,
    int cOrientation,
    int cWeight,
    DWORD bItalic,
    DWORD bUnderline,
    DWORD bStrikeOut,
    DWORD iCharSet,
    DWORD iOutPrecision,
    DWORD iClipPrecision,
    DWORD iQuality,
    DWORD iPitchAndFamily,
    LPCSTR pszFaceName
);

#ifndef CreateFont
#define CreateFont CreateFontA
#endif

#ifndef WM_KEYFIRST
#define WM_KEYFIRST         0x0100
#define WM_KEYLAST          0x0109
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

#ifndef _WASM_STRING_OPS_DEFINED
#define _WASM_STRING_OPS_DEFINED 1
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

static inline char *wasm_strcat(char *dest, const char *src) {
    char *d = dest;
    while (*d) d++;
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

static inline char *wasm_strstr(const char *haystack, const char *needle) {
    if (!haystack || !needle) return (char *)0;
    if (!*needle) return (char *)haystack;
    for (; *haystack; haystack++) {
        const char *h = haystack;
        const char *n = needle;
        while (*h && *n && (*h == *n)) {
            h++;
            n++;
        }
        if (!*n) return (char *)haystack;
    }
    return (char *)0;
}
#endif

#ifndef strstr
#define strstr wasm_strstr
#endif

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
#ifndef strcat
#define strcat wasm_strcat
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
// Keyboard Messages, Virtual Key Codes & Caret APIs (Chap 06)
// ============================================================================

#ifndef WM_KEYDOWN
#define WM_KEYDOWN          0x0100
#define WM_KEYUP            0x0101
#define WM_CHAR             0x0102
#define WM_DEADCHAR         0x0103
#define WM_SYSKEYDOWN       0x0104
#define WM_SYSKEYUP         0x0105
#define WM_SYSCHAR          0x0106
#define WM_SYSDEADCHAR      0x0107
#endif

#ifndef VK_LBUTTON
#define VK_LBUTTON          0x01
#define VK_RBUTTON          0x02
#define VK_CANCEL           0x03
#define VK_MBUTTON          0x04
#define VK_BACK             0x08
#define VK_TAB              0x09
#define VK_CLEAR            0x0C
#define VK_RETURN           0x0D
#define VK_SHIFT            0x10
#define VK_CONTROL          0x11
#define VK_MENU             0x12
#define VK_PAUSE            0x13
#define VK_CAPITAL          0x14
#define VK_ESCAPE           0x1B
#define VK_SPACE            0x20
#define VK_PRIOR            0x21
#define VK_NEXT             0x22
#define VK_END              0x23
#define VK_HOME             0x24
#define VK_LEFT             0x25
#define VK_UP               0x26
#define VK_RIGHT            0x27
#define VK_DOWN             0x28
#define VK_SELECT           0x29
#define VK_PRINT            0x2A
#define VK_EXECUTE          0x2B
#define VK_SNAPSHOT         0x2C
#define VK_INSERT           0x2D
#define VK_DELETE           0x2E
#define VK_HELP             0x2F
#define VK_NUMPAD0          0x60
#define VK_NUMPAD1          0x61
#define VK_NUMPAD2          0x62
#define VK_NUMPAD3          0x63
#define VK_NUMPAD4          0x64
#define VK_NUMPAD5          0x65
#define VK_NUMPAD6          0x66
#define VK_NUMPAD7          0x67
#define VK_NUMPAD8          0x68
#define VK_NUMPAD9          0x69
#define VK_MULTIPLY         0x6A
#define VK_ADD              0x6B
#define VK_SEPARATOR        0x6C
#define VK_SUBTRACT         0x6D
#define VK_DECIMAL          0x6E
#define VK_DIVIDE           0x6F
#define VK_F1               0x70
#define VK_F2               0x71
#define VK_F3               0x72
#define VK_F4               0x73
#define VK_F5               0x74
#define VK_F6               0x75
#define VK_F7               0x76
#define VK_F8               0x77
#define VK_F9               0x78
#define VK_F10              0x79
#define VK_F11              0x7A
#define VK_F12              0x7B
#define VK_NUMLOCK          0x90
#define VK_SCROLL           0x91
#endif

#ifndef TRANSPARENT
#define TRANSPARENT         1
#define OPAQUE              2
#endif

WIN32_IMPORT("CreateCaret")
BOOL WINAPI CreateCaret(HWND hWnd, HBITMAP hBitmap, int nWidth, int nHeight);

WIN32_IMPORT("SetCaretPos")
BOOL WINAPI SetCaretPos(int X, int Y);

WIN32_IMPORT("ShowCaret")
BOOL WINAPI ShowCaret(HWND hWnd);

WIN32_IMPORT("HideCaret")
BOOL WINAPI HideCaret(HWND hWnd);

WIN32_IMPORT("DestroyCaret")
BOOL WINAPI DestroyCaret(void);

WIN32_IMPORT("GetFocus")
HWND WINAPI GetFocus(void);

WIN32_IMPORT("SetBkMode")
int WINAPI SetBkMode(HDC hdc, int mode);

WIN32_IMPORT("GetKeyNameTextA")
int WINAPI GetKeyNameTextA(LONG lParam, LPSTR lpString, int cchSize);

#ifndef GetKeyNameText
#define GetKeyNameText GetKeyNameTextA
#endif

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
#include "string.h"

#ifndef LPDWORD
typedef DWORD *LPDWORD;
#endif
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

// --- Chapter 07: Mouse Input Definitions ---

#ifndef COLORREF
typedef DWORD COLORREF;
#endif
#ifndef PVOID
typedef void *PVOID;
#endif

// ROP2 Binary Raster Operations
#ifndef R2_BLACK
#define R2_BLACK            1   /*  0    */
#define R2_NOTMERGEPEN      2   /* DPon  */
#define R2_MASKNOTPEN       3   /* DPna  */
#define R2_NOTCOPYPEN       4   /* PN    */
#define R2_MASKPENNOT       5   /* PDna  */
#define R2_NOT              6   /* Dn    */
#define R2_XORPEN           7   /* DPx   */
#define R2_NOTXORPEN        8   /* DPxn  */
#define R2_MASKPEN          9   /* DPa   */
#define R2_NOTMASKPEN       10  /* DPan  */
#define R2_NOP              11  /* D     */
#define R2_MERGENOTPEN      12  /* DPno  */
#define R2_COPYPEN          13  /* P     */
#define R2_MERGEPENNOT      14  /* PDno  */
#define R2_MERGEPEN         15  /* DPo   */
#define R2_WHITE            16  /*  1    */
#define R2_LAST             16
#endif

// Mouse Wheel & SystemParametersInfo
#ifndef WM_SETTINGCHANGE
#define WM_SETTINGCHANGE    0x001A
#endif
#ifndef SPI_GETWHEELSCROLLLINES
#define SPI_GETWHEELSCROLLLINES 104
#endif
#ifndef WHEEL_DELTA
#define WHEEL_DELTA         120
#endif
#ifndef WM_MOUSEWHEEL
#define WM_MOUSEWHEEL       0x020A
#endif

// Window Long offsets
#ifndef GWL_WNDPROC
#define GWL_WNDPROC         (-4)
#define GWL_HINSTANCE       (-6)
#define GWL_HWNDPARENT      (-8)
#define GWL_STYLE           (-16)
#define GWL_EXSTYLE         (-20)
#define GWL_USERDATA        (-21)
#define GWL_ID              (-12)
#endif

// Function Prototypes with WIN32_IMPORT
WIN32_IMPORT("SetROP2")
int WINAPI SetROP2(HDC hdc, int rop2);

WIN32_IMPORT("GetROP2")
int WINAPI GetROP2(HDC hdc);

WIN32_IMPORT("SetCapture")
HWND WINAPI SetCapture(HWND hWnd);

WIN32_IMPORT("ReleaseCapture")
BOOL WINAPI ReleaseCapture(void);

WIN32_IMPORT("GetCapture")
HWND WINAPI GetCapture(void);

WIN32_IMPORT("GetCursorPos")
BOOL WINAPI GetCursorPos(LPPOINT lpPoint);

WIN32_IMPORT("SetCursorPos")
BOOL WINAPI SetCursorPos(int X, int Y);

WIN32_IMPORT("ScreenToClient")
BOOL WINAPI ScreenToClient(HWND hWnd, LPPOINT lpPoint);

WIN32_IMPORT("ClientToScreen")
BOOL WINAPI ClientToScreen(HWND hWnd, LPPOINT lpPoint);

WIN32_IMPORT("GetWindowLongA")
LONG WINAPI GetWindowLongA(HWND hWnd, int nIndex);

WIN32_IMPORT("SetWindowLongA")
LONG WINAPI SetWindowLongA(HWND hWnd, int nIndex, LONG dwNewLong);

#ifndef GetWindowLong
#define GetWindowLong GetWindowLongA
#endif
#ifndef SetWindowLong
#define SetWindowLong SetWindowLongA
#endif

WIN32_IMPORT("MoveWindow")
BOOL WINAPI MoveWindow(HWND hWnd, int X, int Y, int nWidth, int nHeight, BOOL bRepaint);

WIN32_IMPORT("SetFocus")
HWND WINAPI SetFocus(HWND hWnd);

WIN32_IMPORT("GetFocus")
HWND WINAPI GetFocus(void);

WIN32_IMPORT("GetDlgItem")
HWND WINAPI GetDlgItem(HWND hDlg, int nIDDlgItem);

WIN32_IMPORT("GetParent")
HWND WINAPI GetParent(HWND hWnd);

WIN32_IMPORT("SetPixel")
COLORREF WINAPI SetPixel(HDC hdc, int x, int y, COLORREF color);

WIN32_IMPORT("InvertRect")
BOOL WINAPI InvertRect(HDC hDC, const RECT *lprc);

WIN32_IMPORT("DrawFocusRect")
BOOL WINAPI DrawFocusRect(HDC hDC, const RECT *lprc);

WIN32_IMPORT("SystemParametersInfoA")
BOOL WINAPI SystemParametersInfoA(UINT uiAction, UINT uiParam, PVOID pvParam, UINT fWinIni);

#ifndef SystemParametersInfo
#define SystemParametersInfo SystemParametersInfoA
#endif

// --- Chapter 08: Timers, Date/Time & Display DCs ---

#ifndef SYSTEMTIME
typedef struct _SYSTEMTIME {
    WORD wYear;
    WORD wMonth;
    WORD wDayOfWeek;
    WORD wDay;
    WORD wHour;
    WORD wMinute;
    WORD wSecond;
    WORD wMilliseconds;
} SYSTEMTIME, *PSYSTEMTIME, *LPSYSTEMTIME;
#endif

#ifndef TIMERPROC
typedef void (CALLBACK *TIMERPROC)(HWND, UINT, UINT_PTR, DWORD);
#endif

#ifndef LCID
typedef DWORD LCID;
typedef DWORD LCTYPE;
#endif

#ifndef LOCALE_USER_DEFAULT
#define LOCALE_USER_DEFAULT 0x0400
#define LOCALE_ITIME        0x00000023
#define LOCALE_ITLZERO      0x00000025
#endif

#ifndef COLOR_SCROLLBAR
#define COLOR_SCROLLBAR         0
#define COLOR_BACKGROUND        1
#define COLOR_ACTIVECAPTION     2
#define COLOR_INACTIVECAPTION   3
#define COLOR_MENU              4
#define COLOR_WINDOW            5
#define COLOR_WINDOWFRAME       6
#define COLOR_MENUTEXT          7
#define COLOR_WINDOWTEXT        8
#define COLOR_CAPTIONTEXT       9
#define COLOR_ACTIVEBORDER      10
#define COLOR_INACTIVEBORDER    11
#define COLOR_APPWORKSPACE      12
#define COLOR_HIGHLIGHT         13
#define COLOR_HIGHLIGHTTEXT     14
#define COLOR_BTNFACE           15
#define COLOR_BTNSHADOW         16
#define COLOR_GRAYTEXT          17
#define COLOR_BTNTEXT           18
#define COLOR_INACTIVECAPTIONTEXT 19
#define COLOR_BTNHIGHLIGHT      20
#define COLOR_3DDKSHADOW        21
#define COLOR_3DLIGHT           22
#define COLOR_INFOTEXT          23
#define COLOR_INFOBK            24
#endif

WIN32_IMPORT("GetLocalTime")
void WINAPI GetLocalTime(LPSYSTEMTIME lpSystemTime);

WIN32_IMPORT("GetSystemTime")
void WINAPI GetSystemTime(LPSYSTEMTIME lpSystemTime);

WIN32_IMPORT("GetLocaleInfoA")
int WINAPI GetLocaleInfoA(LCID Locale, LCTYPE LCType, LPSTR lpLCData, int cchData);

#ifndef GetLocaleInfo
#define GetLocaleInfo GetLocaleInfoA
#endif

WIN32_IMPORT("CreateICA")
HDC WINAPI CreateICA(LPCSTR pszDriver, LPCSTR pszDevice, LPCSTR pszPort, const void *pdm);

#ifndef CreateIC
#define CreateIC CreateICA
#endif

WIN32_IMPORT("CreateDCA")
HDC WINAPI CreateDCA(LPCSTR pwszDriver, LPCSTR pwszDevice, LPCSTR pwszPort, const void *pdm);

#ifndef CreateDC
#define CreateDC CreateDCA
#endif

WIN32_IMPORT("DeleteDC")
BOOL WINAPI DeleteDC(HDC hdc);

WIN32_IMPORT("GetPixel")
COLORREF WINAPI GetPixel(HDC hdc, int x, int y);

WIN32_IMPORT("OffsetWindowOrgEx")
BOOL WINAPI OffsetWindowOrgEx(HDC hdc, int dx, int dy, LPPOINT lppt);

WIN32_IMPORT("OffsetViewportOrgEx")
BOOL WINAPI OffsetViewportOrgEx(HDC hdc, int dx, int dy, LPPOINT lppt);

WIN32_IMPORT("GetSysColor")
DWORD WINAPI GetSysColor(int nIndex);

// --- Chapter 09: Child Window Controls (Button, Edit, ListBox, Static, ScrollBar) ---

#ifndef MAX_PATH
#define MAX_PATH 260
#endif

#ifndef GetDialogBaseUnits
WIN32_IMPORT("GetDialogBaseUnits")
long WINAPI GetDialogBaseUnits(void);
#endif

// CREATESTRUCT
#ifndef LPCREATESTRUCT
typedef struct tagCREATESTRUCTA {
    LPVOID      lpCreateParams;
    HINSTANCE   hInstance;
    HMENU       hMenu;
    HWND        hwndParent;
    int         cy;
    int         cx;
    int         y;
    int         x;
    LONG        style;
    LPCSTR      lpszName;
    LPCSTR      lpszClass;
    DWORD       dwExStyle;
} CREATESTRUCTA, *LPCREATESTRUCTA;
typedef CREATESTRUCTA CREATESTRUCT;
typedef LPCREATESTRUCTA LPCREATESTRUCT;
#endif

// Owner-draw
#ifndef WM_DRAWITEM
#define WM_DRAWITEM         0x002B
#define WM_MEASUREITEM      0x002C
#endif

#ifndef ODT_BUTTON
#define ODT_MENU            1
#define ODT_LISTBOX         2
#define ODT_COMBOBOX        3
#define ODT_BUTTON          4
#define ODT_STATIC          5

#define ODA_DRAWENTIRE      0x0001
#define ODA_SELECT          0x0002
#define ODA_FOCUS           0x0004

#define ODS_SELECTED        0x0001
#define ODS_GRAYED          0x0002
#define ODS_DISABLED        0x0004
#define ODS_CHECKED         0x0008
#define ODS_FOCUS           0x0010
#define ODS_DEFAULT         0x0020
#endif

#ifndef DRAWITEMSTRUCT
typedef struct tagDRAWITEMSTRUCT {
    UINT        CtlType;
    UINT        CtlID;
    UINT        itemID;
    UINT        itemAction;
    UINT        itemState;
    HWND        hwndItem;
    HDC         hDC;
    RECT        rcItem;
    ULONG_PTR   itemData;
} DRAWITEMSTRUCT, *PDRAWITEMSTRUCT, *LPDRAWITEMSTRUCT;
#endif

// ScrollBar Control Styles
#ifndef SBS_VERT
#define SBS_HORZ                    0x0000
#define SBS_VERT                    0x0001
#define SBS_TOPALIGN                0x0002
#define SBS_LEFTALIGN               0x0002
#define SBS_BOTTOMALIGN             0x0004
#define SBS_RIGHTALIGN              0x0004
#define SBS_SIZEBOXTOPLEFTALIGN     0x0002
#define SBS_SIZEBOXBOTTOMRIGHTALIGN 0x0004
#define SBS_SIZEBOX                 0x0008
#define SBS_SIZEGRIP                0x0010
#endif

// Class Longs & Control Colors
#ifndef GCL_HBRBACKGROUND
#define GCL_MENUNAME        (-8)
#define GCL_HBRBACKGROUND   (-10)
#define GCL_HCURSOR         (-12)
#define GCL_HICON           (-14)
#define GCL_HMODULE         (-16)
#define GCL_CBWNDEXTRA      (-18)
#define GCL_CBCLSEXTRA      (-20)
#define GCL_WNDPROC         (-24)
#define GCL_STYLE           (-26)
#define GCW_ATOM            (-32)
#endif

#ifndef WM_CTLCOLORMSGBOX
#define WM_CTLCOLORMSGBOX       0x0132
#define WM_CTLCOLOREDIT         0x0133
#define WM_CTLCOLORLISTBOX      0x0134
#define WM_CTLCOLORBTN          0x0135
#define WM_CTLCOLORDLG          0x0136
#define WM_CTLCOLORSCROLLBAR    0x0137
#define WM_CTLCOLORSTATIC       0x0138
#define WM_SYSCOLORCHANGE       0x0015
#endif

// ListBox Styles & Messages
#ifndef LBS_NOTIFY
#define LBS_NOTIFY            0x0001L
#define LBS_SORT              0x0002L
#define LBS_NOREDRAW          0x0004L
#define LBS_MULTIPLESEL       0x0008L
#define LBS_OWNERDRAWFIXED    0x0010L
#define LBS_OWNERDRAWVARIABLE 0x0020L
#define LBS_HASSTRINGS        0x0040L
#define LBS_USETABSTOPS       0x0080L
#define LBS_NOINTEGRALHEIGHT  0x0100L
#define LBS_MULTICOLUMN       0x0200L
#define LBS_WANTKEYBOARDINPUT 0x0400L
#define LBS_EXTENDEDSEL       0x0800L
#define LBS_DISABLENOSCROLL   0x1000L
#define LBS_NODATA            0x2000L
#define LBS_NOSEL             0x4000L
#define LBS_COMBOBOX          0x8000L
#define LBS_STANDARD          (LBS_NOTIFY | LBS_SORT | WS_VSCROLL | WS_BORDER)
#endif

#ifndef LB_ADDSTRING
#define LB_ADDSTRING            0x0180
#define LB_INSERTSTRING         0x0181
#define LB_DELETESTRING         0x0182
#define LB_SELITEMRANGEEX       0x0183
#define LB_RESETCONTENT         0x0184
#define LB_SETSEL               0x0185
#define LB_SETCURSEL            0x0186
#define LB_GETSEL               0x0187
#define LB_GETCURSEL            0x0188
#define LB_GETTEXT              0x0189
#define LB_GETTEXTLEN           0x018A
#define LB_GETCOUNT             0x018B
#define LB_SELECTSTRING         0x018C
#define LB_DIR                  0x018D
#define LB_GETTOPINDEX          0x018E
#define LB_FINDSTRING           0x018F
#define LB_GETSELCOUNT          0x0190
#define LB_GETSELITEMS          0x0191
#define LB_SETTABSTOPS          0x0192
#define LB_GETHORIZONTALEXTENT  0x0193
#define LB_SETHORIZONTALEXTENT  0x0194
#define LB_SETCOLUMNWIDTH       0x0195
#define LB_ADDFILE              0x0196
#define LB_SETTOPINDEX          0x0197
#define LB_GETITEMRECT          0x0198
#define LB_GETITEMDATA          0x0199
#define LB_SETITEMDATA          0x019A
#define LB_SELITEMRANGE         0x019B
#define LB_SETANCHORINDEX       0x019C
#define LB_GETANCHORINDEX       0x019D
#define LB_SETCARETINDEX        0x019E
#define LB_GETCARETINDEX        0x019F
#define LB_SETITEMHEIGHT        0x01A0
#define LB_GETITEMHEIGHT        0x01A1
#define LB_FINDSTRINGEXACT      0x01A2
#define LB_OKAY                 0
#define LB_ERR                  (-1)
#define LB_ERRSPACE             (-2)

#define LBN_ERRSPACE            (-1)
#define LBN_SELCHANGE           1
#define LBN_DBLCLK              2
#define LBN_SELCANCEL           3
#define LBN_SETFOCUS            4
#define LBN_KILLFOCUS           5
#endif

#ifndef DDL_READWRITE
#define DDL_READWRITE       0x0000
#define DDL_READONLY        0x0001
#define DDL_HIDDEN          0x0002
#define DDL_SYSTEM          0x0004
#define DDL_DIRECTORY       0x0010
#define DDL_ARCHIVE         0x0020
#define DDL_DRIVES          0x4000
#define DDL_EXCLUSIVE       0x8000
#endif

// Edit Control Notifications & Styles
#ifndef EN_ERRSPACE
#define EN_SETFOCUS         0x0100
#define EN_KILLFOCUS        0x0200
#define EN_CHANGE           0x0300
#define EN_UPDATE           0x0400
#define EN_ERRSPACE         0x0500
#define EN_MAXTEXT          0x0501
#define EN_HSCROLL          0x0601
#define EN_VSCROLL          0x0602
#endif

#ifndef MB_ICONSTOP
#define MB_ICONSTOP         0x00000010L
#endif

#ifndef CopyMemory
#define CopyMemory(Destination,Source,Length) memcpy((Destination),(Source),(Length))
#endif

WIN32_IMPORT("ValidateRect")
BOOL WINAPI ValidateRect(HWND hWnd, const RECT *lpRect);

WIN32_IMPORT("SetClassLongA")
DWORD WINAPI SetClassLongA(HWND hWnd, int nIndex, LONG dwNewLong);
#ifndef SetClassLong
#define SetClassLong SetClassLongA
#endif

WIN32_IMPORT("GetKeyState")
SHORT WINAPI GetKeyState(int nVirtKey);

WIN32_IMPORT("CallWindowProcA")
LRESULT WINAPI CallWindowProcA(WNDPROC lpPrevWndFunc, HWND hWnd, UINT Msg, WPARAM wParam, LPARAM lParam);
#ifndef CallWindowProc
#define CallWindowProc CallWindowProcA
#endif

WIN32_IMPORT("GetWindowRect")
BOOL WINAPI GetWindowRect(HWND hWnd, LPRECT lpRect);

WIN32_IMPORT("FrameRect")
int WINAPI FrameRect(HDC hDC, const RECT *lprc, HBRUSH hbr);

WIN32_IMPORT("SetBkColor")
COLORREF WINAPI SetBkColor(HDC hdc, COLORREF color);

WIN32_IMPORT("GetEnvironmentStringsA")
LPSTR WINAPI GetEnvironmentStringsA(void);

WIN32_IMPORT("FreeEnvironmentStringsA")
BOOL WINAPI FreeEnvironmentStringsA(LPSTR);

#ifndef GetEnvironmentStrings
#define GetEnvironmentStrings GetEnvironmentStringsA
#endif
#ifndef FreeEnvironmentStrings
#define FreeEnvironmentStrings FreeEnvironmentStringsA
#endif

WIN32_IMPORT("GetEnvironmentVariableA")
DWORD WINAPI GetEnvironmentVariableA(LPCSTR lpName, LPSTR lpBuffer, DWORD nSize);

#ifndef GetEnvironmentVariable
#define GetEnvironmentVariable GetEnvironmentVariableA
#endif

WIN32_IMPORT("GetCurrentDirectoryA")
DWORD WINAPI GetCurrentDirectoryA(DWORD nBufferLength, LPSTR lpBuffer);

#ifndef GetCurrentDirectory
#define GetCurrentDirectory GetCurrentDirectoryA
#endif

// Win32 File I/O & String Helpers
#ifndef INVALID_HANDLE_VALUE
#define INVALID_HANDLE_VALUE ((HANDLE)(LONG_PTR)-1)
#endif

#ifndef GENERIC_READ
#define GENERIC_READ            (0x80000000L)
#define GENERIC_WRITE           (0x40000000L)
#define GENERIC_EXECUTE         (0x20000000L)
#define GENERIC_ALL             (0x10000000L)

#define FILE_SHARE_READ         0x00000001
#define FILE_SHARE_WRITE        0x00000002
#define FILE_SHARE_DELETE       0x00000004

#define CREATE_NEW          1
#define CREATE_ALWAYS       2
#define OPEN_EXISTING       3
#define OPEN_ALWAYS         4
#define TRUNCATE_EXISTING   5
#endif

WIN32_IMPORT("CreateFileA")
HANDLE WINAPI CreateFileA(
    LPCSTR lpFileName,
    DWORD dwDesiredAccess,
    DWORD dwShareMode,
    LPVOID lpSecurityAttributes,
    DWORD dwCreationDisposition,
    DWORD dwFlagsAndAttributes,
    HANDLE hTemplateFile
);

#ifndef CreateFile
#define CreateFile CreateFileA
#endif

WIN32_IMPORT("ReadFile")
BOOL WINAPI ReadFile(
    HANDLE hFile,
    LPVOID lpBuffer,
    DWORD nNumberOfBytesToRead,
    LPDWORD lpNumberOfBytesRead,
    LPVOID lpOverlapped
);

WIN32_IMPORT("CloseHandle")
BOOL WINAPI CloseHandle(HANDLE hObject);

WIN32_IMPORT("SetCurrentDirectoryA")
BOOL WINAPI SetCurrentDirectoryA(LPCSTR lpPathName);

#ifndef SetCurrentDirectory
#define SetCurrentDirectory SetCurrentDirectoryA
#endif

#ifndef lstrcpyA
#define lstrcpyA strcpy
#endif
#ifndef lstrcpy
#define lstrcpy lstrcpyA
#endif

#ifndef lstrcatA
#define lstrcatA strcat
#endif
#ifndef lstrcat
#define lstrcat lstrcatA
#endif

#ifndef lstrlenA
#define lstrlenA strlen
#endif
#ifndef lstrlen
#define lstrlen lstrlenA
#endif

// ==============================================================================
// Chapter 10: Menus, Accelerators & Resources
// ==============================================================================

#ifndef WM_CLOSE
#define WM_CLOSE            0x0010
#endif
#ifndef WM_QUERYENDSESSION
#define WM_QUERYENDSESSION  0x0011
#endif
#ifndef WM_QUIT
#define WM_QUIT             0x0012
#endif
#ifndef WM_ENDSESSION
#define WM_ENDSESSION       0x0016
#endif
#ifndef WM_CONTEXTMENU
#define WM_CONTEXTMENU      0x007B
#endif
#ifndef WM_SYSCOMMAND
#define WM_SYSCOMMAND       0x0112
#endif
#ifndef WM_INITMENU
#define WM_INITMENU         0x0116
#endif
#ifndef WM_INITMENUPOPUP
#define WM_INITMENUPOPUP    0x0117
#endif
#ifndef WM_MENUSELECT
#define WM_MENUSELECT       0x011F
#endif
#ifndef WM_MENUCHAR
#define WM_MENUCHAR         0x0120
#endif
#ifndef WM_CUT
#define WM_CUT              0x0300
#define WM_COPY             0x0301
#define WM_PASTE            0x0302
#define WM_CLEAR            0x0303
#define WM_UNDO             0x0304
#endif

#ifndef EM_GETSEL
#define EM_GETSEL           0x00B0
#define EM_SETSEL           0x00B1
#define EM_SCROLLCARET      0x00B7
#define EM_REPLACESEL       0x00C2
#define EM_LIMITTEXT        0x00C5
#define EM_CANUNDO          0x00C6
#define EM_UNDO             0x00C7
#define EM_EMPTYUNDOBUFFER  0x00CD
#endif

#ifndef MF_INSERT
#define MF_INSERT           0x00000000L
#define MF_CHANGE           0x00000080L
#define MF_APPEND           0x00000100L
#define MF_DELETE           0x00000200L
#define MF_REMOVE           0x00001000L

#define MF_BYCOMMAND        0x00000000L
#define MF_BYPOSITION       0x00000400L

#define MF_SEPARATOR        0x00000800L

#define MF_ENABLED          0x00000000L
#define MF_GRAYED           0x00000001L
#define MF_DISABLED         0x00000002L

#define MF_UNCHECKED        0x00000000L
#define MF_CHECKED          0x00000008L
#define MF_USECHECKBITMAPS  0x00000200L

#define MF_STRING           0x00000000L
#define MF_BITMAP           0x00000004L
#define MF_OWNERDRAW        0x00000100L

#define MF_POPUP            0x00000010L
#define MF_MENUBARBREAK     0x00000020L
#define MF_MENUBREAK        0x00000040L

#define MF_UNHILITE         0x00000000L
#define MF_HILITE           0x00000080L

#define MF_SYSMENU          0x00002000L
#define MF_HELP             0x00004000L
#define MF_RIGHTJUSTIFY     0x00004000L
#define MF_MOUSESELECT      0x00008000L
#endif

#ifndef TPM_LEFTBUTTON
#define TPM_LEFTBUTTON      0x0000L
#define TPM_RIGHTBUTTON     0x0002L
#define TPM_LEFTALIGN       0x0000L
#define TPM_CENTERALIGN     0x0004L
#define TPM_RIGHTALIGN      0x0008L
#define TPM_TOPALIGN        0x0000L
#define TPM_VCENTERALIGN    0x0010L
#define TPM_BOTTOMALIGN     0x0020L
#define TPM_HORIZONTAL      0x0000L
#define TPM_VERTICAL        0x0040L
#define TPM_NONOTIFY        0x0080L
#define TPM_RETURNCMD       0x0100L
#define TPM_RECURSE         0x0001L
#endif

#ifndef CF_TEXT
#define CF_TEXT             1
#define CF_BITMAP           2
#define CF_METAFILEPICT     3
#define CF_SYLK             4
#define CF_DIF              5
#define CF_TIFF             6
#define CF_OEMTEXT          7
#define CF_DIB              8
#define CF_PALETTE          9
#define CF_PENDATA          10
#define CF_RIFF             11
#define CF_WAVE             12
#define CF_UNICODETEXT      13
#define CF_ENHMETAFILE      14
#define CF_HDROP            15
#define CF_LOCALE           16
#endif

WIN32_IMPORT("CreateMenu")
HMENU WINAPI CreateMenu(void);

WIN32_IMPORT("CreatePopupMenu")
HMENU WINAPI CreatePopupMenu(void);

WIN32_IMPORT("AppendMenuA")
BOOL WINAPI AppendMenuA(HMENU hMenu, UINT uFlags, UINT_PTR uIDNewItem, LPCSTR lpNewItem);
#ifndef AppendMenu
#define AppendMenu AppendMenuA
#endif

WIN32_IMPORT("InsertMenuA")
BOOL WINAPI InsertMenuA(HMENU hMenu, UINT uPosition, UINT uFlags, UINT_PTR uIDNewItem, LPCSTR lpNewItem);
#ifndef InsertMenu
#define InsertMenu InsertMenuA
#endif

WIN32_IMPORT("ModifyMenuA")
BOOL WINAPI ModifyMenuA(HMENU hMnu, UINT uPosition, UINT uFlags, UINT_PTR uIDNewItem, LPCSTR lpItem);
#ifndef ModifyMenu
#define ModifyMenu ModifyMenuA
#endif

WIN32_IMPORT("DeleteMenu")
BOOL WINAPI DeleteMenu(HMENU hMenu, UINT uPosition, UINT uFlags);

WIN32_IMPORT("DestroyMenu")
BOOL WINAPI DestroyMenu(HMENU hMenu);

WIN32_IMPORT("DestroyWindow")
BOOL WINAPI DestroyWindow(HWND hWnd);

WIN32_IMPORT("SetMenu")
BOOL WINAPI SetMenu(HWND hWnd, HMENU hMenu);

WIN32_IMPORT("GetMenu")
HMENU WINAPI GetMenu(HWND hWnd);

WIN32_IMPORT("GetSubMenu")
HMENU WINAPI GetSubMenu(HMENU hMenu, int nPos);

WIN32_IMPORT("GetSystemMenu")
HMENU WINAPI GetSystemMenu(HWND hWnd, BOOL bRevert);

WIN32_IMPORT("TrackPopupMenu")
BOOL WINAPI TrackPopupMenu(HMENU hMenu, UINT uFlags, int x, int y, int nReserved, HWND hWnd, const RECT *prcRect);

WIN32_IMPORT("EnableMenuItem")
BOOL WINAPI EnableMenuItem(HMENU hMenu, UINT uIDEnableItem, UINT uEnable);

WIN32_IMPORT("CheckMenuItem")
DWORD WINAPI CheckMenuItem(HMENU hMenu, UINT uIDCheckItem, UINT uCheck);

WIN32_IMPORT("LoadMenuA")
HMENU WINAPI LoadMenuA(HINSTANCE hInstance, LPCSTR lpMenuName);
#ifndef LoadMenu
#define LoadMenu LoadMenuA
#endif

WIN32_IMPORT("LoadAcceleratorsA")
HACCEL WINAPI LoadAcceleratorsA(HINSTANCE hInstance, LPCSTR lpTableName);
#ifndef LoadAccelerators
#define LoadAccelerators LoadAcceleratorsA
#endif

WIN32_IMPORT("TranslateAcceleratorA")
int WINAPI TranslateAcceleratorA(HWND hWnd, HACCEL hAccTable, LPMSG lpMsg);
#ifndef TranslateAccelerator
#define TranslateAccelerator TranslateAcceleratorA
#endif

WIN32_IMPORT("FindResourceA")
HRSRC WINAPI FindResourceA(HMODULE hModule, LPCSTR lpName, LPCSTR lpType);
#ifndef FindResource
#define FindResource FindResourceA
#endif

WIN32_IMPORT("LoadResource")
HGLOBAL WINAPI LoadResource(HMODULE hModule, HRSRC hResInfo);

WIN32_IMPORT("LockResource")
LPVOID WINAPI LockResource(HGLOBAL hResData);

WIN32_IMPORT("SizeofResource")
DWORD WINAPI SizeofResource(HMODULE hModule, HRSRC hResInfo);

WIN32_IMPORT("FreeResource")
BOOL WINAPI FreeResource(HGLOBAL hResData);

WIN32_IMPORT("LoadStringA")
int WINAPI LoadStringA(HINSTANCE hInstance, UINT uID, LPSTR lpBuffer, int cchBufferMax);
#ifndef LoadString
#define LoadString LoadStringA
#endif

WIN32_IMPORT("DrawIcon")
BOOL WINAPI DrawIcon(HDC hDC, int X, int Y, HICON hIcon);

WIN32_IMPORT("IsClipboardFormatAvailable")
BOOL WINAPI IsClipboardFormatAvailable(UINT format);

static inline LPSTR AnsiNext(LPCSTR current) {
    if (!current || !*current) return (LPSTR)current;
    return (LPSTR)(current + 1);
}

// ==============================================================================
// Chapter 11: Modal & Modeless Dialog Boxes & Controls
// ==============================================================================

#ifndef DLGWINDOWEXTRA
#define DLGWINDOWEXTRA      30
#endif

#ifndef BM_GETCHECK
#define BM_GETCHECK         0x00F0
#define BM_SETCHECK         0x00F1
#define BM_GETSTATE         0x00F2
#define BM_SETSTATE         0x00F3
#define BM_SETSTYLE         0x00F4
#define BM_CLICK            0x00F5
#define BM_GETIMAGE         0x00F6
#define BM_SETIMAGE         0x00F7
#endif

WIN32_IMPORT("Sleep")
void WINAPI Sleep(DWORD dwMilliseconds);

#ifndef MAXDWORD
#define MAXDWORD            0xffffffff
#endif

#ifndef LF_FACESIZE
#define LF_FACESIZE         32
#endif

#ifndef _LOGFONT_DEFINED
#define _LOGFONT_DEFINED
typedef struct tagLOGFONTA {
    LONG      lfHeight;
    LONG      lfWidth;
    LONG      lfEscapement;
    LONG      lfOrientation;
    LONG      lfWeight;
    BYTE      lfItalic;
    BYTE      lfUnderline;
    BYTE      lfStrikeOut;
    BYTE      lfCharSet;
    BYTE      lfOutPrecision;
    BYTE      lfClipPrecision;
    BYTE      lfQuality;
    BYTE      lfPitchAndFamily;
    CHAR      lfFaceName[LF_FACESIZE];
} LOGFONTA, *PLOGFONTA, *NPLOGFONTA, *LPLOGFONTA;

typedef LOGFONTA LOGFONT;
typedef LPLOGFONTA LPLOGFONT;
#endif

#ifndef WM_SETFONT
#define WM_SETFONT          0x0030
#define WM_GETFONT          0x0031
#endif

#ifndef EN_SETFOCUS
#define EN_SETFOCUS         0x0100
#define EN_KILLFOCUS        0x0200
#define EN_CHANGE           0x0300
#define EN_UPDATE           0x0400
#define EN_ERRSPACE         0x0500
#define EN_MAXTEXT          0x0501
#define EN_HSCROLL          0x0601
#define EN_VSCROLL          0x0602
#endif

#ifndef ES_LEFT
#define ES_LEFT             0x0000L
#define ES_CENTER           0x0001L
#define ES_RIGHT            0x0002L
#define ES_MULTILINE        0x0004L
#define ES_UPPERCASE        0x0008L
#define ES_LOWERCASE        0x0010L
#define ES_PASSWORD         0x0020L
#define ES_AUTOVSCROLL      0x0040L
#define ES_AUTOHSCROLL      0x0080L
#define ES_NOHIDESEL        0x0100L
#define ES_OEMCONVERT       0x0400L
#define ES_READONLY         0x0800L
#define ES_WANTRETURN       0x1000L
#define ES_NUMBER           0x2000L
#endif

typedef INT_PTR (CALLBACK *DLGPROC)(HWND, UINT, WPARAM, LPARAM);

WIN32_IMPORT("DialogBoxParamA")
INT_PTR WINAPI DialogBoxParamA(HINSTANCE hInstance, LPCSTR lpTemplateName, HWND hWndParent, DLGPROC lpDialogFunc, LPARAM dwInitParam);
#ifndef DialogBoxParam
#define DialogBoxParam DialogBoxParamA
#endif
#ifndef DialogBoxA
#define DialogBoxA(hInstance, lpTemplate, hWndParent, lpDialogFunc) DialogBoxParamA(hInstance, lpTemplate, hWndParent, lpDialogFunc, 0L)
#endif
#ifndef DialogBox
#define DialogBox DialogBoxA
#endif

WIN32_IMPORT("CreateDialogParamA")
HWND WINAPI CreateDialogParamA(HINSTANCE hInstance, LPCSTR lpTemplateName, HWND hWndParent, DLGPROC lpDialogFunc, LPARAM dwInitParam);
#ifndef CreateDialogParam
#define CreateDialogParam CreateDialogParamA
#endif
#ifndef CreateDialogA
#define CreateDialogA(hInstance, lpName, hWndParent, lpDialogFunc) CreateDialogParamA(hInstance, lpName, hWndParent, lpDialogFunc, 0L)
#endif
#ifndef CreateDialog
#define CreateDialog CreateDialogA
#endif

WIN32_IMPORT("EndDialog")
BOOL WINAPI EndDialog(HWND hDlg, INT_PTR nResult);

WIN32_IMPORT("IsDialogMessageA")
BOOL WINAPI IsDialogMessageA(HWND hDlg, LPMSG lpMsg);
#ifndef IsDialogMessage
#define IsDialogMessage IsDialogMessageA
#endif

WIN32_IMPORT("CheckRadioButton")
BOOL WINAPI CheckRadioButton(HWND hDlg, int nIDFirstButton, int nIDLastButton, int nIDCheckButton);

WIN32_IMPORT("CheckDlgButton")
BOOL WINAPI CheckDlgButton(HWND hDlg, int nIDButton, UINT uCheck);

WIN32_IMPORT("IsDlgButtonChecked")
UINT WINAPI IsDlgButtonChecked(HWND hDlg, int nIDButton);

WIN32_IMPORT("SetDlgItemInt")
BOOL WINAPI SetDlgItemInt(HWND hDlg, int nIDDlgItem, UINT uValue, BOOL bSigned);

WIN32_IMPORT("GetDlgItemInt")
UINT WINAPI GetDlgItemInt(HWND hDlg, int nIDDlgItem, BOOL *lpTranslated, BOOL bSigned);

WIN32_IMPORT("SetDlgItemTextA")
BOOL WINAPI SetDlgItemTextA(HWND hDlg, int nIDDlgItem, LPCSTR lpString);
#ifndef SetDlgItemText
#define SetDlgItemText SetDlgItemTextA
#endif

WIN32_IMPORT("GetDlgItemTextA")
UINT WINAPI GetDlgItemTextA(HWND hDlg, int nIDDlgItem, LPSTR lpString, int cchMax);
#ifndef GetDlgItemText
#define GetDlgItemText GetDlgItemTextA
#endif

WIN32_IMPORT("SendDlgItemMessageA")
LRESULT WINAPI SendDlgItemMessageA(HWND hDlg, int nIDDlgItem, UINT Msg, WPARAM wParam, LPARAM lParam);
#ifndef SendDlgItemMessage
#define SendDlgItemMessage SendDlgItemMessageA
#endif

WIN32_IMPORT("CreateFontIndirectA")
HFONT WINAPI CreateFontIndirectA(const LOGFONTA *lplf);
#ifndef CreateFontIndirect
#define CreateFontIndirect CreateFontIndirectA
#endif

WIN32_IMPORT("GetObjectA")
int WINAPI GetObjectA(HANDLE hgdiobj, int cbBuffer, LPVOID lpvObject);
#ifndef GetObject
#define GetObject GetObjectA
#endif

WIN32_IMPORT("WriteFile")
BOOL WINAPI WriteFile(
    HANDLE hFile,
    LPCVOID lpBuffer,
    DWORD nNumberOfBytesToWrite,
    LPDWORD lpNumberOfBytesWritten,
    LPVOID lpOverlapped
);

WIN32_IMPORT("GetWindowTextLengthA")
int WINAPI GetWindowTextLengthA(HWND hWnd);
#ifndef GetWindowTextLength
#define GetWindowTextLength GetWindowTextLengthA
#endif

WIN32_IMPORT("RegisterWindowMessageA")
UINT WINAPI RegisterWindowMessageA(LPCSTR lpString);
#ifndef RegisterWindowMessage
#define RegisterWindowMessage RegisterWindowMessageA
#endif

static inline LPSTR CharUpperA(LPSTR lpsz) {
    if (((UINT_PTR)lpsz) < 0x10000) {
        char c = (char)(UINT_PTR)lpsz;
        if (c >= 'a' && c <= 'z') c -= 32;
        return (LPSTR)(UINT_PTR)(unsigned char)c;
    }
    if (!lpsz) return (LPSTR)0;
    for (char *p = lpsz; *p; p++) {
        if (*p >= 'a' && *p <= 'z') *p -= 32;
    }
    return lpsz;
}
#ifndef CharUpper
#define CharUpper CharUpperA
#endif

#ifndef CP_ACP
#define CP_ACP              0
#define CP_OEMCP            1
#define CP_UTF8             65001
#endif

#ifndef IS_TEXT_UNICODE_SIGNATURE
#define IS_TEXT_UNICODE_ASCII16            0x0001
#define IS_TEXT_UNICODE_REVERSE_ASCII16    0x0010
#define IS_TEXT_UNICODE_STATISTICS         0x0002
#define IS_TEXT_UNICODE_REVERSE_STATISTICS 0x0020
#define IS_TEXT_UNICODE_CONTROLS           0x0004
#define IS_TEXT_UNICODE_REVERSE_CONTROLS   0x0040
#define IS_TEXT_UNICODE_SIGNATURE          0x0008
#define IS_TEXT_UNICODE_REVERSE_SIGNATURE  0x0080
#endif

WIN32_IMPORT("GetFileSize")
DWORD WINAPI GetFileSize(HANDLE hFile, LPDWORD lpFileSizeHigh);

WIN32_IMPORT("IsTextUnicode")
BOOL WINAPI IsTextUnicode(const void *lpv, int iSize, LPINT lpiResult);

WIN32_IMPORT("WideCharToMultiByte")
int WINAPI WideCharToMultiByte(
    UINT CodePage,
    DWORD dwFlags,
    LPCWSTR lpWideCharStr,
    int cchWideChar,
    LPSTR lpMultiByteStr,
    int cbMultiByte,
    LPCSTR lpDefaultChar,
    LPBOOL lpUsedDefaultChar
);

WIN32_IMPORT("MultiByteToWideChar")
int WINAPI MultiByteToWideChar(
    UINT CodePage,
    DWORD dwFlags,
    LPCSTR lpMultiByteStr,
    int cbMultiByte,
    LPWSTR lpWideCharStr,
    int cchWideChar
);

#ifdef __cplusplus
}
#endif

#endif // _WASM_PLATFORM_H
