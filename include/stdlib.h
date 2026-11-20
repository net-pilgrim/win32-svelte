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

#ifdef __cplusplus
}
#endif

#endif // _STDLIB_H
