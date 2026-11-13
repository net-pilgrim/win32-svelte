#ifndef _WINUSER_H
#define _WINUSER_H

#include "windef.h"
#include "winbase.h"

#ifdef __cplusplus
extern "C" {
#endif

// Window Procedure callback
typedef LRESULT (CALLBACK *WNDPROC)(HWND, UINT, WPARAM, LPARAM);

// Window Class structure
typedef struct tagWNDCLASSEXA {
    UINT        cbSize;
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
    HICON       hIconSm;
} WNDCLASSEXA, *PWNDCLASSEXA, *NPWNDCLASSEXA, *LPWNDCLASSEXA;

typedef WNDCLASSEXA WNDCLASSEX;

// Message structure
typedef struct tagMSG {
    HWND        hwnd;
    UINT        message;
    WPARAM      wParam;
    LPARAM      lParam;
    DWORD       time;
    POINT       pt;
} MSG, *PMSG, *NPMSG, *LPMSG;

// Standard Window Messages
#define WM_NULL             0x0000
#define WM_CREATE           0x0001
#define WM_DESTROY          0x0002
#define WM_MOVE             0x0003
#define WM_SIZE             0x0005
#define WM_ACTIVATE         0x0006
#define WM_SETFOCUS         0x0007
#define WM_KILLFOCUS        0x0008
#define WM_ENABLE           0x000A
#define WM_SETREDRAW        0x000B
#define WM_SETTEXT          0x000C
#define WM_GETTEXT          0x000D
#define WM_GETTEXTLENGTH    0x000E
#define WM_PAINT            0x000F
#define WM_CLOSE            0x0010
#define WM_QUERYENDSESSION  0x0011
#define WM_QUIT             0x0012
#define WM_ERASEBKGND       0x0014
#define WM_SHOWWINDOW       0x0018

#define WM_COMMAND          0x0111
#define WM_TIMER            0x0113
#define WM_HSCROLL          0x0114
#define WM_VSCROLL          0x0115

// Mouse Messages
#define WM_MOUSEMOVE        0x0200
#define WM_LBUTTONDOWN      0x0201
#define WM_LBUTTONUP        0x0202
#define WM_LBUTTONDBLCLK    0x0203
#define WM_RBUTTONDOWN      0x0204
#define WM_RBUTTONUP        0x0205
#define WM_RBUTTONDBLCLK    0x0206

// Keyboard Messages
#define WM_KEYDOWN          0x0100
#define WM_KEYUP            0x0101
#define WM_CHAR             0x0102

// Window Styles
#define WS_OVERLAPPED       0x00000000L
#define WS_POPUP            0x80000000L
#define WS_CHILD            0x40000000L
#define WS_MINIMIZE         0x20000000L
#define WS_VISIBLE          0x10000000L
#define WS_DISABLED         0x08000000L
#define WS_CLIPSIBLINGS     0x04000000L
#define WS_CLIPCHILDREN     0x02000000L
#define WS_MAXIMIZE         0x01000000L
#define WS_CAPTION          0x00C00000L
#define WS_BORDER           0x00800000L
#define WS_DLGFRAME         0x00400000L
#define WS_VSCROLL          0x00200000L
#define WS_HSCROLL          0x00100000L
#define WS_SYSMENU          0x00080000L
#define WS_THICKFRAME       0x00040000L
#define WS_GROUP            0x00020000L
#define WS_TABSTOP          0x00010000L
#define WS_MINIMIZEBOX      0x00020000L
#define WS_MAXIMIZEBOX      0x00010000L

#define WS_OVERLAPPEDWINDOW (WS_OVERLAPPED     | \
                             WS_CAPTION        | \
                             WS_SYSMENU        | \
                             WS_THICKFRAME     | \
                             WS_MINIMIZEBOX    | \
                             WS_MAXIMIZEBOX)

// Extended Window Styles
#define WS_EX_DLGMODALFRAME 0x00000001L
#define WS_EX_NOPARENTNOTIFY 0x00000004L
#define WS_EX_TOPMOST       0x00000008L
#define WS_EX_ACCEPTFILES   0x00000010L
#define WS_EX_TRANSPARENT   0x00000020L
#define WS_EX_CLIENTEDGE    0x00000200L

// ShowWindow commands
#define SW_HIDE             0
#define SW_SHOWNORMAL       1
#define SW_NORMAL           1
#define SW_SHOWMINIMIZED    2
#define SW_SHOWMAXIMIZED    3
#define SW_MAXIMIZE         3
#define SW_SHOWNOACTIVATE   4
#define SW_SHOW             5
#define SW_MINIMIZE         6
#define SW_SHOWMINNOACTIVE  7
#define SW_SHOWNA           8
#define SW_RESTORE          9

// MessageBox flags
#define MB_OK                       0x00000000L
#define MB_OKCANCEL                 0x00000001L
#define MB_ABORTRETRYIGNORE         0x00000002L
#define MB_YESNOCANCEL              0x00000003L
#define MB_YESNO                    0x00000004L
#define MB_RETRYCANCEL              0x00000005L

#define MB_ICONHAND                 0x00000010L
#define MB_ICONQUESTION             0x00000020L
#define MB_ICONEXCLAMATION          0x00000030L
#define MB_ICONASTERISK             0x00000040L

#define MB_ICONWARNING              MB_ICONEXCLAMATION
#define MB_ICONERROR                MB_ICONHAND
#define MB_ICONINFORMATION          MB_ICONASTERISK
#define MB_ICONSTOP                 MB_ICONHAND

// MessageBox return values
#define IDOK                1
#define IDCANCEL            2
#define IDABORT             3
#define IDRETRY             4
#define IDIGNORE            5
#define IDYES               6
#define IDNO                7

// Button control styles & messages
#define BS_PUSHBUTTON       0x00000000L
#define BS_DEFPUSHBUTTON    0x00000001L
#define BS_CHECKBOX         0x00000002L
#define BS_AUTOCHECKBOX     0x00000003L
#define BS_RADIOBUTTON      0x00000004L
#define BS_AUTORADIOBUTTON  0x00000009L
#define BS_GROUPBOX         0x00000007L

#define BM_GETCHECK         0x00F0
#define BM_SETCHECK         0x00F1
#define BST_UNCHECKED       0x0000
#define BST_CHECKED         0x0001
#define BST_INDETERMINATE   0x0002

// Edit control styles
#define ES_LEFT             0x0000L
#define ES_CENTER           0x0001L
#define ES_RIGHT            0x0002L
#define ES_MULTILINE        0x0004L
#define ES_AUTOVSCROLL      0x0040L
#define ES_AUTOHSCROLL      0x0080L

// Static control styles
#define SS_LEFT             0x00000000L
#define SS_CENTER           0x00000001L
#define SS_RIGHT            0x00000002L
#define SS_ICON             0x00000003L
#define SS_BLACKRECT        0x00000004L
#define SS_ETCHEDHORZ       0x00000010L

// User32 Import Functions
WIN32_IMPORT("MessageBoxA")
int WINAPI MessageBoxA(HWND hWnd, LPCSTR lpText, LPCSTR lpCaption, UINT uType);

WIN32_IMPORT("RegisterClassExA")
ATOM WINAPI RegisterClassExA(const WNDCLASSEXA *lpwcx);

WIN32_IMPORT("CreateWindowExA")
HWND WINAPI CreateWindowExA(
    DWORD dwExStyle,
    LPCSTR lpClassName,
    LPCSTR lpWindowName,
    DWORD dwStyle,
    int X,
    int Y,
    int nWidth,
    int nHeight,
    HWND hWndParent,
    HMENU hMenu,
    HINSTANCE hInstance,
    LPVOID lpParam
);

WIN32_IMPORT("ShowWindow")
BOOL WINAPI ShowWindow(HWND hWnd, int nCmdShow);

WIN32_IMPORT("UpdateWindow")
BOOL WINAPI UpdateWindow(HWND hWnd);

WIN32_IMPORT("DefWindowProcA")
LRESULT WINAPI DefWindowProcA(HWND hWnd, UINT Msg, WPARAM wParam, LPARAM lParam);

WIN32_IMPORT("PostQuitMessage")
void WINAPI PostQuitMessage(int nExitCode);

WIN32_IMPORT("SendMessageA")
LRESULT WINAPI SendMessageA(HWND hWnd, UINT Msg, WPARAM wParam, LPARAM lParam);

WIN32_IMPORT("PostMessageA")
BOOL WINAPI PostMessageA(HWND hWnd, UINT Msg, WPARAM wParam, LPARAM lParam);

WIN32_IMPORT("SetWindowTextA")
BOOL WINAPI SetWindowTextA(HWND hWnd, LPCSTR lpString);

WIN32_IMPORT("GetWindowTextA")
int WINAPI GetWindowTextA(HWND hWnd, LPSTR lpString, int nMaxCount);

WIN32_IMPORT("InvalidateRect")
BOOL WINAPI InvalidateRect(HWND hWnd, const RECT *lpRect, BOOL bErase);

WIN32_IMPORT("SetTimer")
UINT_PTR WINAPI SetTimer(HWND hWnd, UINT_PTR nIDEvent, UINT uElapse, void* lpTimerFunc);

WIN32_IMPORT("KillTimer")
BOOL WINAPI KillTimer(HWND hWnd, UINT_PTR uIDEvent);

// Standard aliases
#define MessageBox      MessageBoxA
#define RegisterClassEx RegisterClassExA
#define CreateWindowEx  CreateWindowExA
#define DefWindowProc   DefWindowProcA
#define SendMessage     SendMessageA
#define PostMessage     PostMessageA
#define SetWindowText   SetWindowTextA
#define GetWindowText   GetWindowTextA

#ifdef __cplusplus
}
#endif

#endif // _WINUSER_H
