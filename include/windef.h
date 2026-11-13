#ifndef _WINDEF_H
#define _WINDEF_H

#ifdef __cplusplus
extern "C" {
#endif

#ifndef WINAPI
#define WINAPI
#endif

#ifndef CALLBACK
#define CALLBACK
#endif

#ifndef CONST
#define CONST const
#endif

#ifndef VOID
#define VOID void
#endif

#ifndef NULL
#ifdef __cplusplus
#define NULL 0
#else
#define NULL ((void *)0)
#endif
#endif

#ifndef FALSE
#define FALSE 0
#endif

#ifndef TRUE
#define TRUE 1
#endif

// Base primitive types (32-bit WASM environment)
typedef unsigned long       DWORD;
typedef int                 BOOL;
typedef unsigned char       BYTE;
typedef unsigned short      WORD;
typedef float               FLOAT;
typedef int                 INT;
typedef unsigned int        UINT;
typedef long                LONG;
typedef unsigned long       ULONG;
typedef short               SHORT;
typedef unsigned short      USHORT;
typedef char                CHAR;
typedef unsigned short      WCHAR;

typedef CHAR               *LPSTR;
typedef CONST CHAR         *LPCSTR;
typedef WCHAR              *LPWSTR;
typedef CONST WCHAR        *LPCWSTR;

typedef LPSTR               LPTSTR;
typedef LPCSTR              LPCTSTR;

typedef void               *LPVOID;
typedef CONST void         *LPCVOID;

typedef unsigned int        UINT_PTR;
typedef int                 INT_PTR;
typedef long                LONG_PTR;
typedef unsigned long       ULONG_PTR;
typedef ULONG_PTR           DWORD_PTR;

typedef UINT_PTR            WPARAM;
typedef LONG_PTR            LPARAM;
typedef LONG_PTR            LRESULT;

typedef WORD                ATOM;

// Handles
typedef void*               HANDLE;
typedef HANDLE              HWND;
typedef HANDLE              HDC;
typedef HANDLE              HBRUSH;
typedef HANDLE              HPEN;
typedef HANDLE              HFONT;
typedef HANDLE              HBITMAP;
typedef HANDLE              HRGN;
typedef HANDLE              HICON;
typedef HANDLE              HCURSOR;
typedef HANDLE              HMENU;
typedef HANDLE              HINSTANCE;
typedef HANDLE              HMODULE;
typedef HANDLE              HGDIOBJ;

// Geometry structures
typedef struct tagRECT {
    LONG left;
    LONG top;
    LONG right;
    LONG bottom;
} RECT, *PRECT, *NPRECT, *LPRECT;
typedef CONST RECT *LPCRECT;

typedef struct tagPOINT {
    LONG x;
    LONG y;
} POINT, *PPOINT, *NPPOINT, *LPPOINT;

typedef struct tagSIZE {
    LONG cx;
    LONG cy;
} SIZE, *PSIZE, *LPSIZE;

// Helpers & bitfield macros
#define LOWORD(l)           ((WORD)(((DWORD_PTR)(l)) & 0xffff))
#define HIWORD(l)           ((WORD)((((DWORD_PTR)(l)) >> 16) & 0xffff))
#define LOBYTE(w)           ((BYTE)(((DWORD_PTR)(w)) & 0xff))
#define HIBYTE(w)           ((BYTE)((((DWORD_PTR)(w)) >> 8) & 0xff))
#define MAKEWPARAM(l, h)    ((WPARAM)(DWORD)MAKELONG(l, h))
#define MAKELPARAM(l, h)    ((LPARAM)(DWORD)MAKELONG(l, h))
#define MAKELRESULT(l, h)   ((LRESULT)(DWORD)MAKELONG(l, h))
#define MAKELONG(a, b)      ((LONG)(((WORD)(((DWORD_PTR)(a)) & 0xffff)) | ((DWORD)((WORD)(((DWORD_PTR)(b)) & 0xffff))) << 16))

#ifdef __cplusplus
}
#endif

#endif // _WINDEF_H
