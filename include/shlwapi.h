#ifndef _SHLWAPI_H
#define _SHLWAPI_H

#include "windef.h"
#include "_wasm_platform.h"
#include <stdarg.h>

#ifdef __cplusplus
extern "C" {
#endif

static inline LPCWSTR PathFindFileNameW(LPCWSTR pPath) {
    LPCWSTR p = pPath;
    if (!pPath) return NULL;
    while (*p) {
        if ((*p == L'\\' || *p == L'/') && *(p + 1))
            pPath = p + 1;
        p++;
    }
    return pPath;
}

static inline int StrCmpNW(LPCWSTR lpStr1, LPCWSTR lpStr2, int nChar) {
    if (!lpStr1 || !lpStr2 || nChar <= 0) return 0;
    for (int i = 0; i < nChar; i++) {
        if (!lpStr1[i] || !lpStr2[i] || lpStr1[i] != lpStr2[i])
            return (int)lpStr1[i] - (int)lpStr2[i];
    }
    return 0;
}

static inline int StrCmpNIW(LPCWSTR lpStr1, LPCWSTR lpStr2, int nChar) {
    if (!lpStr1 || !lpStr2 || nChar <= 0) return 0;
    for (int i = 0; i < nChar; i++) {
        WCHAR c1 = (lpStr1[i] >= L'a' && lpStr1[i] <= L'z') ? (lpStr1[i] - 32) : lpStr1[i];
        WCHAR c2 = (lpStr2[i] >= L'a' && lpStr2[i] <= L'z') ? (lpStr2[i] - 32) : lpStr2[i];
        if (!c1 || !c2 || c1 != c2) return (int)c1 - (int)c2;
    }
    return 0;
}

static inline LPWSTR StrStrW(LPCWSTR lpFirst, LPCWSTR lpSrch) {
    if (!lpFirst || !lpSrch) return NULL;
    if (!*lpSrch) return (LPWSTR)lpFirst;
    while (*lpFirst) {
        LPCWSTR h = lpFirst;
        LPCWSTR n = lpSrch;
        while (*h && *n && (*h == *n)) { h++; n++; }
        if (!*n) return (LPWSTR)lpFirst;
        lpFirst++;
    }
    return NULL;
}

static inline LPWSTR StrStrIW(LPCWSTR lpFirst, LPCWSTR lpSrch) {
    if (!lpFirst || !lpSrch) return NULL;
    if (!*lpSrch) return (LPWSTR)lpFirst;
    while (*lpFirst) {
        LPCWSTR h = lpFirst;
        LPCWSTR n = lpSrch;
        while (*h && *n) {
            WCHAR c1 = (*h >= L'a' && *h <= L'z') ? (*h - 32) : *h;
            WCHAR c2 = (*n >= L'a' && *n <= L'z') ? (*n - 32) : *n;
            if (c1 != c2) break;
            h++; n++;
        }
        if (!*n) return (LPWSTR)lpFirst;
        lpFirst++;
    }
    return NULL;
}

static inline LPWSTR StrRStrIW(LPCWSTR lpSource, LPCWSTR lpLast, LPCWSTR lpSrch) {
    if (!lpSource || !lpSrch) return NULL;
    if (!lpLast) {
        lpLast = lpSource;
        while (*lpLast) lpLast++;
    }
    int srchLen = wasm_lstrlenW(lpSrch);
    if (srchLen == 0) return (LPWSTR)lpLast;
    LPCWSTR p = lpLast;
    while (p >= lpSource) {
        LPCWSTR h = p;
        LPCWSTR n = lpSrch;
        while (*h && *n) {
            WCHAR c1 = (*h >= L'a' && *h <= L'z') ? (*h - 32) : *h;
            WCHAR c2 = (*n >= L'a' && *n <= L'z') ? (*n - 32) : *n;
            if (c1 != c2) break;
            h++; n++;
        }
        if (!*n) return (LPWSTR)p;
        p--;
    }
    return NULL;
}

static inline int wnsprintfW(LPWSTR lpOut, int cchLimitIn, LPCWSTR lpFmt, ...) {
    va_list args;
    va_start(args, lpFmt);
    int res = wasm_swprintf(lpOut, (size_t)cchLimitIn, lpFmt, args);
    va_end(args);
    return res;
}

#ifdef __cplusplus
}
#endif

#endif // _SHLWAPI_H
