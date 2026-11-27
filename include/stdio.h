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

static inline void wasm_dtoa(char *buf, size_t buf_size, double val, int prec, char spec, int alt_form) {
    if (buf_size == 0 || !buf) return;
    if (prec < 0) prec = 6;
    if (prec > 32) prec = 32;

    // Check for NaN or Inf
    if (val != val) {
        size_t i = 0;
        const char *s = (spec >= 'A' && spec <= 'Z') ? "NAN" : "nan";
        while (*s && i + 1 < buf_size) buf[i++] = *s++;
        buf[i] = '\0';
        return;
    }
    if (val - val != 0.0) {
        size_t i = 0;
        if (val < 0.0) { buf[i++] = '-'; }
        const char *s = (spec >= 'A' && spec <= 'Z') ? "INF" : "inf";
        while (*s && i + 1 < buf_size) buf[i++] = *s++;
        buf[i] = '\0';
        return;
    }

    int neg = 0;
    if (val < 0.0) {
        neg = 1;
        val = -val;
    }

    int exp_mode = 0;
    if (spec == 'e' || spec == 'E') {
        exp_mode = 1;
    } else if (spec == 'g' || spec == 'G') {
        if (prec == 0) prec = 1;
        int e = 0;
        if (val > 0.0) {
            double temp = val;
            while (temp >= 10.0) { temp /= 10.0; e++; }
            while (temp < 1.0) { temp *= 10.0; e--; }
        }
        if (e < -4 || e >= prec) {
            exp_mode = 1;
            prec = prec - 1;
        } else {
            exp_mode = 0;
            prec = prec - 1 - e;
        }
        if (prec < 0) prec = 0;
    }

    size_t out = 0;
    if (neg && out + 1 < buf_size) buf[out++] = '-';

    int exp_val = 0;
    if (exp_mode) {
        if (val > 0.0) {
            while (val >= 10.0) { val /= 10.0; exp_val++; }
            while (val < 1.0) { val *= 10.0; exp_val--; }
        }
    }

    // Rounding
    double round_adder = 0.5;
    for (int i = 0; i < prec; i++) round_adder /= 10.0;
    val += round_adder;

    if (exp_mode && val >= 10.0) {
        val /= 10.0;
        exp_val++;
    }

    unsigned long long int_part = (unsigned long long)val;
    double frac_part = val - (double)int_part;

    char int_buf[32];
    int int_len = 0;
    if (int_part == 0) {
        int_buf[int_len++] = '0';
    } else {
        while (int_part > 0 && int_len < 31) {
            int_buf[int_len++] = (char)('0' + (int_part % 10));
            int_part /= 10;
        }
    }
    while (int_len > 0 && out + 1 < buf_size) {
        buf[out++] = int_buf[--int_len];
    }

    if (prec > 0 || alt_form) {
        size_t dot_pos = out;
        if (out + 1 < buf_size) buf[out++] = '.';
        size_t frac_start = out;
        for (int i = 0; i < prec && out + 1 < buf_size; i++) {
            frac_part *= 10.0;
            int digit = (int)frac_part;
            if (digit > 9) digit = 9;
            if (digit < 0) digit = 0;
            buf[out++] = (char)('0' + digit);
            frac_part -= digit;
        }
        if ((spec == 'g' || spec == 'G') && !alt_form) {
            while (out > frac_start && buf[out - 1] == '0') {
                out--;
            }
            if (out == dot_pos) {
                out--;
            }
        }
    }

    if (exp_mode && out + 4 < buf_size) {
        buf[out++] = (spec == 'E' || spec == 'G') ? 'E' : 'e';
        if (exp_val >= 0) {
            buf[out++] = '+';
        } else {
            buf[out++] = '-';
            exp_val = -exp_val;
        }
        if (exp_val < 10) {
            buf[out++] = '0';
            buf[out++] = (char)('0' + exp_val);
        } else {
            char exp_buf[10];
            int ei = 0;
            while (exp_val > 0 && ei < 9) {
                exp_buf[ei++] = (char)('0' + (exp_val % 10));
                exp_val /= 10;
            }
            while (ei > 0 && out + 1 < buf_size) {
                buf[out++] = exp_buf[--ei];
            }
        }
    }

    buf[out] = '\0';
}

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

        // 1. Flags
        int flag_left = 0, flag_plus = 0, flag_space = 0, flag_zero = 0, flag_alt = 0;
        int parsing_flags = 1;
        while (parsing_flags && *fmt) {
            switch (*fmt) {
                case '-': flag_left = 1; fmt++; break;
                case '+': flag_plus = 1; fmt++; break;
                case ' ': flag_space = 1; fmt++; break;
                case '0': flag_zero = 1; fmt++; break;
                case '#': flag_alt = 1; fmt++; break;
                default: parsing_flags = 0; break;
            }
        }

        // 2. Field Width
        int width = -1;
        if (*fmt == '*') {
            width = va_arg(ap, int);
            if (width < 0) { flag_left = 1; width = -width; }
            fmt++;
        } else if (*fmt >= '0' && *fmt <= '9') {
            width = 0;
            while (*fmt >= '0' && *fmt <= '9') {
                width = width * 10 + (*fmt++ - '0');
            }
        }

        // 3. Precision
        int prec = -1;
        if (*fmt == '.') {
            fmt++;
            if (*fmt == '*') {
                prec = va_arg(ap, int);
                fmt++;
            } else {
                prec = 0;
                while (*fmt >= '0' && *fmt <= '9') {
                    prec = prec * 10 + (*fmt++ - '0');
                }
            }
        }

        // 4. Length modifiers
        int is_long = 0;
        if (*fmt == 'l') {
            is_long = 1;
            fmt++;
            if (*fmt == 'l') fmt++;
        } else if (*fmt == 'h' || *fmt == 'z') {
            fmt++;
        }

        // 5. Specifiers
        if (*fmt == 's') {
            const char *s = va_arg(ap, const char *);
            if (!s) s = "(null)";
            int slen = 0;
            while (s[slen]) slen++;
            if (prec >= 0 && slen > prec) slen = prec;
            int pad = (width > slen) ? (width - slen) : 0;
            if (!flag_left) {
                while (pad-- > 0 && out + 1 < size) buf[out++] = ' ';
            }
            for (int si = 0; si < slen && out + 1 < size; si++) {
                buf[out++] = s[si];
            }
            if (flag_left) {
                while (pad-- > 0 && out + 1 < size) buf[out++] = ' ';
            }
            fmt++;
            continue;
        }

        if (*fmt == 'c') {
            char c = (char)va_arg(ap, int);
            int pad = (width > 1) ? (width - 1) : 0;
            if (!flag_left) {
                while (pad-- > 0 && out + 1 < size) buf[out++] = ' ';
            }
            if (out + 1 < size) buf[out++] = c;
            if (flag_left) {
                while (pad-- > 0 && out + 1 < size) buf[out++] = ' ';
            }
            fmt++;
            continue;
        }

        if (*fmt == 'd' || *fmt == 'i') {
            long long val = is_long ? va_arg(ap, long) : va_arg(ap, int);
            int neg = 0;
            if (val < 0) {
                neg = 1;
                val = -val;
            }
            char tmp[32];
            int ti = 0;
            if (val == 0) {
                tmp[ti++] = '0';
            } else {
                while (val > 0 && ti < 31) {
                    tmp[ti++] = (char)('0' + (val % 10));
                    val /= 10;
                }
            }
            int total_len = ti + (neg || flag_plus || flag_space ? 1 : 0);
            int pad = (width > total_len) ? (width - total_len) : 0;
            if (!flag_left && !flag_zero) {
                while (pad-- > 0 && out + 1 < size) buf[out++] = ' ';
            }
            if (neg) {
                if (out + 1 < size) buf[out++] = '-';
            } else if (flag_plus) {
                if (out + 1 < size) buf[out++] = '+';
            } else if (flag_space) {
                if (out + 1 < size) buf[out++] = ' ';
            }
            if (!flag_left && flag_zero) {
                while (pad-- > 0 && out + 1 < size) buf[out++] = '0';
            }
            while (ti > 0 && out + 1 < size) {
                buf[out++] = tmp[--ti];
            }
            if (flag_left) {
                while (pad-- > 0 && out + 1 < size) buf[out++] = ' ';
            }
            fmt++;
            continue;
        }

        if (*fmt == 'u' || *fmt == 'o' || *fmt == 'x' || *fmt == 'X' || *fmt == 'p') {
            unsigned long long val;
            if (*fmt == 'p') {
                val = (unsigned long long)(size_t)va_arg(ap, void *);
            } else {
                val = is_long ? va_arg(ap, unsigned long) : va_arg(ap, unsigned int);
            }
            int base = (*fmt == 'o') ? 8 : ((*fmt == 'x' || *fmt == 'X' || *fmt == 'p') ? 16 : 10);
            const char *digits = (*fmt == 'X') ? "0123456789ABCDEF" : "0123456789abcdef";
            char tmp[32];
            int ti = 0;
            if (val == 0) {
                tmp[ti++] = '0';
            } else {
                while (val > 0 && ti < 31) {
                    tmp[ti++] = digits[val % base];
                    val /= base;
                }
            }
            int pad = (width > ti) ? (width - ti) : 0;
            if (!flag_left && !flag_zero) {
                while (pad-- > 0 && out + 1 < size) buf[out++] = ' ';
            }
            if (!flag_left && flag_zero) {
                while (pad-- > 0 && out + 1 < size) buf[out++] = '0';
            }
            while (ti > 0 && out + 1 < size) {
                buf[out++] = tmp[--ti];
            }
            if (flag_left) {
                while (pad-- > 0 && out + 1 < size) buf[out++] = ' ';
            }
            fmt++;
            continue;
        }

        if (*fmt == 'f' || *fmt == 'F' || *fmt == 'e' || *fmt == 'E' || *fmt == 'g' || *fmt == 'G') {
            double val = va_arg(ap, double);
            char num_buf[64];
            wasm_dtoa(num_buf, sizeof(num_buf), val, prec, *fmt, flag_alt);
            int nlen = 0;
            while (num_buf[nlen]) nlen++;
            int pad = (width > nlen) ? (width - nlen) : 0;
            if (!flag_left) {
                char pad_char = flag_zero ? '0' : ' ';
                while (pad-- > 0 && out + 1 < size) buf[out++] = pad_char;
            }
            for (int ni = 0; ni < nlen && out + 1 < size; ni++) {
                buf[out++] = num_buf[ni];
            }
            if (flag_left) {
                while (pad-- > 0 && out + 1 < size) buf[out++] = ' ';
            }
            fmt++;
            continue;
        }

        // Unrecognized format specifier fallback
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
