/*
 * wininet.h - Internet Extensions for WebAssembly (WASM32)
 */

#ifndef _WININET_H
#define _WININET_H

#include "windef.h"
#include "winbase.h"

#ifdef __cplusplus
extern "C" {
#endif

DECLARE_HANDLE(HINTERNET);
typedef HINTERNET *LPHINTERNET;
typedef WORD INTERNET_PORT;

#define INTERNET_OPEN_TYPE_PRECONFIG                    0
#define INTERNET_OPEN_TYPE_DIRECT                       1
#define INTERNET_OPEN_TYPE_PROXY                        3
#define INTERNET_OPEN_TYPE_PRECONFIG_WITH_NO_AUTOPROXY  4

#define INTERNET_DEFAULT_FTP_PORT                       21
#define INTERNET_DEFAULT_GOPHER_PORT                    70
#define INTERNET_DEFAULT_HTTP_PORT                      80
#define INTERNET_DEFAULT_HTTPS_PORT                     443
#define INTERNET_DEFAULT_SOCKS_PORT                     1080

#define INTERNET_SERVICE_FTP                            1
#define INTERNET_SERVICE_GOPHER                         2
#define INTERNET_SERVICE_HTTP                           3

#define INTERNET_FLAG_RELOAD            0x80000000
#define INTERNET_FLAG_RAW_DATA          0x40000000
#define INTERNET_FLAG_EXISTING_CONNECT  0x20000000
#define INTERNET_FLAG_ASYNC             0x10000000
#define INTERNET_FLAG_PASSIVE           0x08000000
#define INTERNET_FLAG_NO_CACHE_WRITE    0x04000000
#define INTERNET_FLAG_DONT_CACHE        INTERNET_FLAG_NO_CACHE_WRITE

#define FTP_TRANSFER_TYPE_UNKNOWN       0x00000000
#define FTP_TRANSFER_TYPE_ASCII         0x00000001
#define FTP_TRANSFER_TYPE_BINARY        0x00000002

WIN32_IMPORT("InternetOpenA")
HINTERNET WINAPI InternetOpenA(
    LPCSTR lpszAgent,
    DWORD dwAccessType,
    LPCSTR lpszProxy,
    LPCSTR lpszProxyBypass,
    DWORD dwFlags
);

WIN32_IMPORT("InternetConnectA")
HINTERNET WINAPI InternetConnectA(
    HINTERNET hInternet,
    LPCSTR lpszServerName,
    INTERNET_PORT nServerPort,
    LPCSTR lpszUserName,
    LPCSTR lpszPassword,
    DWORD dwService,
    DWORD dwFlags,
    DWORD_PTR dwContext
);

WIN32_IMPORT("FtpSetCurrentDirectoryA")
BOOL WINAPI FtpSetCurrentDirectoryA(HINTERNET hConnect, LPCSTR lpszDirectory);

WIN32_IMPORT("FtpFindFirstFileA")
HINTERNET WINAPI FtpFindFirstFileA(
    HINTERNET hConnect,
    LPCSTR lpszSearchFile,
    LPWIN32_FIND_DATAA lpFindFileData,
    DWORD dwFlags,
    DWORD_PTR dwContext
);

WIN32_IMPORT("InternetFindNextFileA")
BOOL WINAPI InternetFindNextFileA(HINTERNET hFind, LPVOID lpvFindData);

WIN32_IMPORT("FtpOpenFileA")
HINTERNET WINAPI FtpOpenFileA(
    HINTERNET hConnect,
    LPCSTR lpszFileName,
    DWORD dwAccess,
    DWORD dwFlags,
    DWORD_PTR dwContext
);

WIN32_IMPORT("InternetReadFile")
BOOL WINAPI InternetReadFile(
    HINTERNET hFile,
    LPVOID lpBuffer,
    DWORD dwNumberOfBytesToRead,
    LPDWORD lpdwNumberOfBytesRead
);

WIN32_IMPORT("InternetCloseHandle")
BOOL WINAPI InternetCloseHandle(HINTERNET hInternet);

WIN32_IMPORT("FtpGetFileA")
BOOL WINAPI FtpGetFileA(
    HINTERNET hConnect,
    LPCSTR lpszRemoteFile,
    LPCSTR lpszNewFile,
    BOOL fFailIfExists,
    DWORD dwFlagsAndAttributes,
    DWORD dwFlags,
    DWORD_PTR dwContext
);

#define InternetOpen            InternetOpenA
#define InternetConnect         InternetConnectA
#define FtpSetCurrentDirectory  FtpSetCurrentDirectoryA
#define FtpFindFirstFile        FtpFindFirstFileA
#define InternetFindNextFile    InternetFindNextFileA
#define FtpOpenFile             FtpOpenFileA
#define FtpGetFile              FtpGetFileA

#ifdef __cplusplus
}
#endif

#endif // _WININET_H
