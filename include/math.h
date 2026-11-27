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
#define exp(x)  __builtin_exp(x)
#define log(x)  __builtin_log(x)
#define log10(x) __builtin_log10(x)

static inline double wasm_atan(double x) {
    int sign = 0;
    if (x < 0) { sign = 1; x = -x; }
    int inv = 0;
    if (x > 1.0) { inv = 1; x = 1.0 / x; }
    double x2 = x * x;
    double res = x * (1.0 + x2 * (-0.3333314528 + x2 * (0.1999355085 + x2 * (-0.1420889944 + x2 * (0.1065626393 - x2 * 0.0752896400)))));
    if (inv) res = (M_PI / 2.0) - res;
    if (sign) res = -res;
    return res;
}
#define atan(x) wasm_atan(x)

static inline double wasm_asin(double x) {
    if (x <= -1.0) return -M_PI / 2.0;
    if (x >= 1.0) return M_PI / 2.0;
    return wasm_atan(x / __builtin_sqrt(1.0 - x * x));
}
#define asin(x) wasm_asin(x)

static inline double wasm_acos(double x) {
    return (M_PI / 2.0) - wasm_asin(x);
}
#define acos(x) wasm_acos(x)

static inline double wasm_sinh(double x) {
    double ex = __builtin_exp(x);
    return (ex - 1.0 / ex) * 0.5;
}
#define sinh(x) wasm_sinh(x)

static inline double wasm_cosh(double x) {
    double ex = __builtin_exp(x);
    return (ex + 1.0 / ex) * 0.5;
}
#define cosh(x) wasm_cosh(x)

static inline double wasm_tanh(double x) {
    double e2x = __builtin_exp(2.0 * x);
    return (e2x - 1.0) / (e2x + 1.0);
}
#define tanh(x) wasm_tanh(x)

static inline double wasm_asinh(double x) {
    return __builtin_log(x + __builtin_sqrt(x * x + 1.0));
}
#define asinh(x) wasm_asinh(x)

static inline double wasm_acosh(double x) {
    if (x < 1.0) return 0.0;
    return __builtin_log(x + __builtin_sqrt(x * x - 1.0));
}
#define acosh(x) wasm_acosh(x)

static inline double wasm_atanh(double x) {
    if (x <= -1.0 || x >= 1.0) return 0.0;
    return 0.5 * __builtin_log((1.0 + x) / (1.0 - x));
}
#define atanh(x) wasm_atanh(x)
static inline double wasm_pow(double x, double y) {
    if (x <= 0) return 0.0;
    if (y == 0.0) return 1.0;
    return __builtin_exp(__builtin_log(x) * y);
}
#define pow(x, y) wasm_pow(x, y)

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
