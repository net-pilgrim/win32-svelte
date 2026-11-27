/*
 * stdlib.h - Minimal Freestanding Standard Library Header for WebAssembly (WASM32)
 */

#ifndef _STDLIB_H
#define _STDLIB_H

#ifdef __cplusplus
extern "C" {
#endif

#ifndef _SIZE_T_DEFINED
#define _SIZE_T_DEFINED
typedef unsigned long size_t;
#endif

#ifndef _RAND_DEFINED
#define _RAND_DEFINED
static unsigned long _wasm_stdlib_rand = 1;
static inline int wasm_rand(void) {
    _wasm_stdlib_rand = _wasm_stdlib_rand * 1103515245 + 12345;
    return (int)((unsigned int)(_wasm_stdlib_rand / 65536) % 32768);
}

static inline void wasm_srand(unsigned int seed) {
    _wasm_stdlib_rand = seed;
}
#ifndef rand
#define rand wasm_rand
#endif
#ifndef srand
#define srand wasm_srand
#endif
#endif

static inline int abs(int n) {
    return n < 0 ? -n : n;
}

static inline int wasm_atoi(const char *s) {
    int res = 0;
    int sign = 1;
    if (!s) return 0;
    while (*s == ' ' || *s == '\t' || *s == '\n' || *s == '\r') s++;
    if (*s == '-') { sign = -1; s++; }
    else if (*s == '+') { s++; }
    while (*s >= '0' && *s <= '9') {
        res = res * 10 + (*s - '0');
        s++;
    }
    return sign * res;
}
#ifndef atoi
#define atoi wasm_atoi
#endif

static inline void exit(int code) {
    (void)code;
}

static inline double wasm_atof(const char *s) {
    if (!s) return 0.0;
    while (*s == ' ' || *s == '\t' || *s == '\n' || *s == '\r') s++;
    double sign = 1.0;
    if (*s == '-') { sign = -1.0; s++; }
    else if (*s == '+') { s++; }
    double val = 0.0;
    while (*s >= '0' && *s <= '9') {
        val = val * 10.0 + (*s - '0');
        s++;
    }
    if (*s == '.') {
        s++;
        double frac = 0.1;
        while (*s >= '0' && *s <= '9') {
            val += (*s - '0') * frac;
            frac *= 0.1;
            s++;
        }
    }
    return sign * val;
}
#ifndef atof
#define atof wasm_atof
#endif

static inline long wasm_strtol(const char *nptr, char **endptr, int base) {
    if (!nptr) return 0;
    const char *s = nptr;
    while (*s == ' ' || *s == '\t' || *s == '\n' || *s == '\r') s++;
    int sign = 1;
    if (*s == '-') { sign = -1; s++; }
    else if (*s == '+') { s++; }
    if (base == 0) {
        if (*s == '0' && (s[1] == 'x' || s[1] == 'X')) { base = 16; s += 2; }
        else if (*s == '0') { base = 8; s++; }
        else base = 10;
    } else if (base == 16 && *s == '0' && (s[1] == 'x' || s[1] == 'X')) {
        s += 2;
    }
    long res = 0;
    while (*s) {
        int digit;
        if (*s >= '0' && *s <= '9') digit = *s - '0';
        else if (*s >= 'a' && *s <= 'z') digit = *s - 'a' + 10;
        else if (*s >= 'A' && *s <= 'Z') digit = *s - 'A' + 10;
        else break;
        if (digit >= base) break;
        res = res * base + digit;
        s++;
    }
    if (endptr) *endptr = (char *)s;
    return sign * res;
}
#ifndef strtol
#define strtol wasm_strtol
#endif

#ifndef min
#define min(a,b) (((a) < (b)) ? (a) : (b))
#endif
#ifndef max
#define max(a,b) (((a) > (b)) ? (a) : (b))
#endif

#define RAND_MAX 32767

// Freestanding Heap Allocator
static unsigned char _wasm_stdlib_heap[131072];
static size_t _wasm_stdlib_heap_idx = 0;

static inline void *malloc(size_t size) {
    if (_wasm_stdlib_heap_idx + size > sizeof(_wasm_stdlib_heap)) return (void *)0;
    void *ptr = (void *)&_wasm_stdlib_heap[_wasm_stdlib_heap_idx];
    _wasm_stdlib_heap_idx = (_wasm_stdlib_heap_idx + size + 7) & ~7;
    return ptr;
}

static inline void free(void *ptr) {
    (void)ptr;
}

static inline void *calloc(size_t num, size_t size) {
    size_t total = num * size;
    void *p = malloc(total);
    if (p) {
        unsigned char *d = (unsigned char *)p;
        for (size_t i = 0; i < total; i++) d[i] = 0;
    }
    return p;
}

static inline void *realloc(void *ptr, size_t size) {
    if (!ptr) return malloc(size);
    void *new_p = malloc(size);
    if (new_p) {
        unsigned char *dst = (unsigned char *)new_p;
        unsigned char *src = (unsigned char *)ptr;
        for (size_t i = 0; i < size; i++) dst[i] = src[i];
    }
    return new_p;
}

#ifdef __cplusplus
}
#endif

#endif // _STDLIB_H
