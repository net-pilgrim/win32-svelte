#ifndef _WINGDI_H
#define _WINGDI_H

#include "windef.h"
#include "winbase.h"

#ifdef __cplusplus
extern "C" {
#endif

typedef DWORD COLORREF;

#define RGB(r,g,b)          ((COLORREF)(((BYTE)(r)|((WORD)((BYTE)(g))<<8))|(((DWORD)(BYTE)(b))<<16)))
#define GetRValue(rgb)      ((BYTE)(rgb))
#define GetGValue(rgb)      ((BYTE)(((WORD)(rgb)) >> 8))
#define GetBValue(rgb)      ((BYTE)((rgb)>>16))

// Stock Objects
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

// Pen Styles
#define PS_SOLID            0
#define PS_DASH             1
#define PS_DOT              2
#define PS_DASHDOT          3
#define PS_DASHDOTDOT       4
#define PS_NULL             5

// Background Modes
#define TRANSPARENT         1
#define OPAQUE              2

// Paint Structure
typedef struct tagPAINTSTRUCT {
    HDC  hdc;
    BOOL fErase;
    RECT rcPaint;
    BOOL fRestore;
    BOOL fIncUpdate;
    BYTE rgbReserved[32];
} PAINTSTRUCT, *PPAINTSTRUCT, *NPPAINTSTRUCT, *LPPAINTSTRUCT;

// GDI Import Functions
WIN32_IMPORT("BeginPaint")
HDC WINAPI BeginPaint(HWND hWnd, LPPAINTSTRUCT lpPaint);

WIN32_IMPORT("EndPaint")
BOOL WINAPI EndPaint(HWND hWnd, const PAINTSTRUCT *lpPaint);

WIN32_IMPORT("MoveToEx")
BOOL WINAPI MoveToEx(HDC hdc, int x, int y, LPPOINT lppt);

WIN32_IMPORT("LineTo")
BOOL WINAPI LineTo(HDC hdc, int x, int y);

WIN32_IMPORT("Rectangle")
BOOL WINAPI Rectangle(HDC hdc, int left, int top, int right, int bottom);

WIN32_IMPORT("Ellipse")
BOOL WINAPI Ellipse(HDC hdc, int left, int top, int right, int bottom);

WIN32_IMPORT("TextOutA")
BOOL WINAPI TextOutA(HDC hdc, int x, int y, LPCSTR lpString, int c);

WIN32_IMPORT("SetTextColor")
COLORREF WINAPI SetTextColor(HDC hdc, COLORREF color);

WIN32_IMPORT("CreateSolidBrush")
HBRUSH WINAPI CreateSolidBrush(COLORREF color);

WIN32_IMPORT("CreatePen")
HPEN WINAPI CreatePen(int iStyle, int cWidth, COLORREF color);

WIN32_IMPORT("SelectObject")
HGDIOBJ WINAPI SelectObject(HDC hdc, HGDIOBJ h);

WIN32_IMPORT("DeleteObject")
BOOL WINAPI DeleteObject(HGDIOBJ ho);

#define TextOut TextOutA

#ifdef __cplusplus
}
#endif

#endif // _WINGDI_H
