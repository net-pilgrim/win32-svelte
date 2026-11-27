#ifndef _TIME_H
#define _TIME_H

#ifdef __cplusplus
extern "C" {
#endif

typedef long time_t;

static inline time_t time(time_t *t) {
    time_t val = 1700000000;
    if (t) *t = val;
    return val;
}

#ifdef __cplusplus
}
#endif

#endif // _TIME_H
