/*
 * math.h - Minimal Freestanding Math Header for WebAssembly (WASM32)
 */

#ifndef _MATH_H
#define _MATH_H

#ifdef __cplusplus
extern "C" {
#endif

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

#define sin(x)  __builtin_sin(x)
#define cos(x)  __builtin_cos(x)
#define tan(x)  __builtin_tan(x)
#define sqrt(x) __builtin_sqrt(x)
#define atan(x) __builtin_atan(x)
#define exp(x)  __builtin_exp(x)
#define log(x)  __builtin_log(x)
#define log10(x) __builtin_log10(x)
#define pow(x, y) __builtin_pow(x, y)

static inline double wasm_hypot(double x, double y) {
    return __builtin_sqrt(x * x + y * y);
}
#define hypot(x, y)  wasm_hypot(x, y)
#define _hypot(x, y) wasm_hypot(x, y)
#define fabs(x) __builtin_fabs(x)
#define floor(x) __builtin_floor(x)
#define ceil(x) __builtin_ceil(x)

#ifdef __cplusplus
}
#endif

#endif // _MATH_H
