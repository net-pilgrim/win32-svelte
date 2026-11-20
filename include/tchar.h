/*
 * tchar.h - Generic Internationalized Character & String Mappings for WebAssembly (WASM32)
 */

#ifndef _TCHAR_H
#define _TCHAR_H

#include <windows.h>
#include <stdio.h>
#include "string.h"

#ifndef _T
#define _T(x)       TEXT(x)
#endif
#ifndef _TEXT
#define _TEXT(x)    TEXT(x)
#endif

#define _vsntprintf  vsnprintf
#define _vsnprintf   vsnprintf
#define _sntprintf   snprintf
#define _stprintf    sprintf
#define _tcslen      lstrlen
#define _tcscpy      lstrcpy
#define _tcsstr      strstr
#define _tprintf     printf

#endif // _TCHAR_H
