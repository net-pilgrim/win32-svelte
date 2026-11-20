/*
 * stdio.h - Freestanding Formatted String I/O for WebAssembly (WASM32)
 */

#ifndef _STDIO_H
#define _STDIO_H

#include <stdarg.h>

#ifndef size_t
typedef unsigned long size_t;
#endif

#ifndef NULL
#define NULL ((void *)0)
#endif

#ifdef __cplusplus
extern "C" {
#endif

// Lightweight freestanding vsnprintf for formatted Win32 string construction
static inline int vsnprintf(char *buf, size_t size, const char *fmt, va_list ap) {
    if (!buf || size == 0) return 0;
    size_t out = 0;
    while (*fmt && out + 1 < size) {
        if (*fmt != '%') {
            buf[out++] = *fmt++;
            continue;
        }
        fmt++; // skip '%'
        if (*fmt == '%') {
            buf[out++] = '%';
            fmt++;
            continue;
        }
        if (*fmt == 's') {
            const char *s = va_arg(ap, const char *);
            if (!s) s = "(null)";
            while (*s && out + 1 < size) {
                buf[out++] = *s++;
            }
            fmt++;
            continue;
        }
        if (*fmt == 'c') {
            char c = (char)va_arg(ap, int);
            buf[out++] = c;
            fmt++;
            continue;
        }
        if (*fmt == 'd' || *fmt == 'i') {
            long val = va_arg(ap, int);
            if (val < 0) {
                buf[out++] = '-';
                val = -val;
            }
            char tmp[24];
            int ti = 0;
            if (val == 0) {
                tmp[ti++] = '0';
            } else {
                while (val > 0 && ti < 23) {
                    tmp[ti++] = (char)('0' + (val % 10));
                    val /= 10;
                }
            }
            while (ti > 0 && out + 1 < size) {
                buf[out++] = tmp[--ti];
            }
            fmt++;
            continue;
        }
        if (*fmt == 'u') {
            unsigned long val = va_arg(ap, unsigned int);
            char tmp[24];
            int ti = 0;
            if (val == 0) {
                tmp[ti++] = '0';
            } else {
                while (val > 0 && ti < 23) {
                    tmp[ti++] = (char)('0' + (val % 10));
                    val /= 10;
                }
            }
            while (ti > 0 && out + 1 < size) {
                buf[out++] = tmp[--ti];
            }
            fmt++;
            continue;
        }
        if (*fmt == 'x' || *fmt == 'X') {
            unsigned long val = va_arg(ap, unsigned int);
            char tmp[24];
            int ti = 0;
            const char *hex = (*fmt == 'X') ? "0123456789ABCDEF" : "0123456789abcdef";
            if (val == 0) {
                tmp[ti++] = '0';
            } else {
                while (val > 0 && ti < 23) {
                    tmp[ti++] = hex[val % 16];
                    val /= 16;
                }
            }
            while (ti > 0 && out + 1 < size) {
                buf[out++] = tmp[--ti];
            }
            fmt++;
            continue;
        }
        // Fallback for unrecognized format specifier
        buf[out++] = '%';
        if (out + 1 < size) {
            buf[out++] = *fmt;
        }
        fmt++;
    }
    buf[out] = '\0';
    return (int)out;
}

static inline int snprintf(char *buf, size_t size, const char *fmt, ...) {
    va_list ap;
    va_start(ap, fmt);
    int res = vsnprintf(buf, size, fmt, ap);
    va_end(ap);
    return res;
}

static inline int sprintf(char *buf, const char *fmt, ...) {
    va_list ap;
    va_start(ap, fmt);
    int res = vsnprintf(buf, 65536, fmt, ap);
    va_end(ap);
    return res;
}

#ifdef __cplusplus
}
#endif

#endif // _STDIO_H
