/*
 * process.h - Process and Thread Control for WebAssembly (WASM32)
 */

#ifndef _PROCESS_H
#define _PROCESS_H

#include "windef.h"

#ifdef __cplusplus
extern "C" {
#endif

typedef void (*_beginthread_proc_type)(void *);

uintptr_t _beginthread(
    void (*start_address)(void *),
    unsigned stack_size,
    void *arglist
);

void _endthread(void);

// Cooperative thread control in WASM
int _wasm_thread_step(void);

#ifdef __cplusplus
}
#endif

#endif // _PROCESS_H
