#ifndef _WINTERNL_H
#define _WINTERNL_H

#include "windef.h"

#ifdef __cplusplus
extern "C" {
#endif

static inline USHORT RtlUshortByteSwap(USHORT Source) {
    return (USHORT)((Source >> 8) | (Source << 8));
}

#ifdef __cplusplus
}
#endif

#endif // _WINTERNL_H
