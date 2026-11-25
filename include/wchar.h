/*
 * wchar.h - Wide Character Support for WebAssembly (WASM32)
 */

#ifndef _WCHAR_H
#define _WCHAR_H

#include "windef.h"

#ifdef __cplusplus
extern "C" {
#endif

static inline size_t wasm_wcslen(const wchar_t *s) {
    size_t len = 0;
    while (s && s[len]) len++;
    return len;
}

static inline wchar_t *wasm_wcscpy(wchar_t *dest, const wchar_t *src) {
    wchar_t *d = dest;
    while ((*d++ = *src++));
    return dest;
}

static inline int wasm_wcscmp(const wchar_t *s1, const wchar_t *s2) {
    while (*s1 && (*s1 == *s2)) {
        s1++;
        s2++;
    }
    return (int)*s1 - (int)*s2;
}

static inline wchar_t *wasm_wcsupr(wchar_t *s) {
    wchar_t *p = s;
    while (*p) {
        if (*p >= 'a' && *p <= 'z') *p -= 32;
        p++;
    }
    return s;
}

static inline int wasm_wcsicmp(const wchar_t *s1, const wchar_t *s2) {
    while (*s1 && *s2) {
        wchar_t c1 = (*s1 >= 'a' && *s1 <= 'z') ? (*s1 - 32) : *s1;
        wchar_t c2 = (*s2 >= 'a' && *s2 <= 'z') ? (*s2 - 32) : *s2;
        if (c1 != c2) return (int)c1 - (int)c2;
        s1++;
        s2++;
    }
    return (int)*s1 - (int)*s2;
}

#ifndef wcslen
#define wcslen wasm_wcslen
#endif
#ifndef wcscpy
#define wcscpy wasm_wcscpy
#endif
#ifndef wcscmp
#define wcscmp wasm_wcscmp
#endif
#ifndef _wcsupr
#define _wcsupr wasm_wcsupr
#endif
#ifndef _wcsicmp
#define _wcsicmp wasm_wcsicmp
#endif

#ifdef __cplusplus
}
#endif

#endif // _WCHAR_H
