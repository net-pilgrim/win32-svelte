#ifndef _STRING_H
#define _STRING_H

#include "stddef.h"

#ifdef __cplusplus
extern "C" {
#endif

#ifndef _WASM_STRING_OPS_DEFINED
#define _WASM_STRING_OPS_DEFINED

static inline size_t wasm_strlen(const char *s) {
    size_t len = 0;
    while (s && s[len]) len++;
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
    return *(const unsigned char*)s1 - *(const unsigned char*)s2;
}

static inline void *wasm_memset(void *s, int c, size_t n) {
    unsigned char *p = (unsigned char *)s;
    while (n--) *p++ = (unsigned char)c;
    return s;
}

static inline void *wasm_memcpy(void *dest, const void *src, size_t n) {
    unsigned char *d = (unsigned char *)dest;
    const unsigned char *s = (const unsigned char *)src;
    while (n--) *d++ = *s++;
    return dest;
}

static inline char *wasm_strstr(const char *haystack, const char *needle) {
    if (!haystack || !needle) return NULL;
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
    return NULL;
}

#endif // _WASM_STRING_OPS_DEFINED

static inline void *wasm_memmove(void *dest, const void *src, size_t n) {
    unsigned char *d = (unsigned char *)dest;
    const unsigned char *s = (const unsigned char *)src;
    if (d < s) {
        while (n--) *d++ = *s++;
    } else {
        d += n;
        s += n;
        while (n--) *--d = *--s;
    }
    return dest;
}

static inline int wasm_memcmp(const void *s1, const void *s2, size_t n) {
    const unsigned char *p1 = (const unsigned char *)s1;
    const unsigned char *p2 = (const unsigned char *)s2;
    for (size_t i = 0; i < n; i++) {
        if (p1[i] != p2[i]) return p1[i] - p2[i];
    }
    return 0;
}

#ifndef strlen
#define strlen wasm_strlen
#endif
#ifndef strcpy
#define strcpy wasm_strcpy
#endif
#ifndef strncpy
#define strncpy wasm_strncpy
#endif
#ifndef strcat
#define strcat wasm_strcat
#endif
#ifndef strncat
#define strncat wasm_strncat
#endif
#ifndef strcmp
#define strcmp wasm_strcmp
#endif
#ifndef strncmp
#define strncmp wasm_strncmp
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
#ifndef memmove
#define memmove wasm_memmove
#endif
static inline char *wasm_strtok(char *str, const char *delim) {
    static char *saved_str = NULL;
    if (str != NULL) {
        saved_str = str;
    }
    if (saved_str == NULL) {
        return NULL;
    }
    while (*saved_str) {
        const char *d = delim;
        int is_delim = 0;
        while (*d) {
            if (*saved_str == *d) {
                is_delim = 1;
                break;
            }
            d++;
        }
        if (!is_delim) break;
        saved_str++;
    }
    if (*saved_str == '\0') {
        saved_str = NULL;
        return NULL;
    }
    char *token = saved_str;
    while (*saved_str) {
        const char *d = delim;
        int is_delim = 0;
        while (*d) {
            if (*saved_str == *d) {
                is_delim = 1;
                break;
            }
            d++;
        }
        if (is_delim) {
            *saved_str = '\0';
            saved_str++;
            return token;
        }
        saved_str++;
    }
    saved_str = NULL;
    return token;
}

#ifndef memcmp
#define memcmp wasm_memcmp
#endif
#ifndef strtok
#define strtok wasm_strtok
#endif

static inline char *wasm_strrev(char *str) {
    if (!str) return 0;
    int i = 0;
    int j = (int)wasm_strlen(str) - 1;
    while (i < j) {
        char c = str[i];
        str[i] = str[j];
        str[j] = c;
        i++;
        j--;
    }
    return str;
}
#ifndef strrev
#define strrev wasm_strrev
#endif

#ifdef __cplusplus
}
#endif

#endif // _STRING_H
