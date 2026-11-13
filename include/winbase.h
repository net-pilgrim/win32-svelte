#ifndef _WINBASE_H
#define _WINBASE_H

#include "windef.h"

#ifdef __cplusplus
extern "C" {
#endif

#define WIN32_IMPORT(name) __attribute__((import_module("win32"), import_name(name)))

#ifdef __cplusplus
}
#endif

#endif // _WINBASE_H
