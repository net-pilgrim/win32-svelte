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
