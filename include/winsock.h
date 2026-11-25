/*
 * winsock.h - Windows Sockets definitions for WebAssembly (WASM32)
 */

#ifndef _WINSOCK_H
#define _WINSOCK_H

#include "windef.h"

#ifdef __cplusplus
extern "C" {
#endif

typedef UINT_PTR        SOCKET;
typedef unsigned short  u_short;
typedef unsigned int    u_int;
typedef unsigned long   u_long;
typedef unsigned char   u_char;

#define INVALID_SOCKET  (SOCKET)(~0)
#define SOCKET_ERROR            (-1)

#define AF_UNSPEC       0
#define AF_INET         2
#define SOCK_STREAM     1
#define SOCK_DGRAM      2
#define IPPROTO_TCP     6
#define IPPROTO_UDP     17

#define INADDR_ANY              (ULONG)0x00000000
#define INADDR_LOOPBACK         0x7f000001
#define INADDR_BROADCAST        (ULONG)0xffffffff
#define INADDR_NONE             0xffffffff

#define IPPORT_TIMESERVER       37

#define FD_READ_BIT      0
#define FD_READ          (1 << FD_READ_BIT)
#define FD_WRITE_BIT     1
#define FD_WRITE         (1 << FD_WRITE_BIT)
#define FD_OOB_BIT       2
#define FD_OOB           (1 << FD_OOB_BIT)
#define FD_ACCEPT_BIT    3
#define FD_ACCEPT        (1 << FD_ACCEPT_BIT)
#define FD_CONNECT_BIT   4
#define FD_CONNECT       (1 << FD_CONNECT_BIT)
#define FD_CLOSE_BIT     5
#define FD_CLOSE         (1 << FD_CLOSE_BIT)

#define MSG_OOB          0x1
#define MSG_PEEK         0x2
#define MSG_DONTROUTE    0x4

#define WSAEWOULDBLOCK   10035

#define WSAGETSELECTEVENT(lParam)   LOWORD(lParam)
#define WSAGETSELECTERROR(lParam)   HIWORD(lParam)

typedef struct in_addr {
    union {
        struct { UCHAR s_b1,s_b2,s_b3,s_b4; } S_un_b;
        struct { USHORT s_w1,s_w2; } S_un_w;
        ULONG S_addr;
    } S_un;
#define s_addr  S_un.S_addr
} IN_ADDR, *PIN_ADDR, *LPIN_ADDR;

typedef struct sockaddr_in {
    short   sin_family;
    USHORT  sin_port;
    IN_ADDR sin_addr;
    char    sin_zero[8];
} SOCKADDR_IN, *PSOCKADDR_IN, *LPSOCKADDR_IN;

typedef struct sockaddr {
    u_short sa_family;
    char    sa_data[14];
} SOCKADDR, *PSOCKADDR, *LPSOCKADDR;

typedef struct hostent {
    char    *h_name;
    char    **h_aliases;
    short   h_addrtype;
    short   h_length;
    char    **h_addr_list;
#define h_addr h_addr_list[0]
} HOSTENT, *PHOSTENT, *LPHOSTENT;

#define WSADESCRIPTION_LEN      256
#define WSASYS_STATUS_LEN       128

typedef struct WSAData {
    WORD                    wVersion;
    WORD                    wHighVersion;
    char                    szDescription[WSADESCRIPTION_LEN+1];
    char                    szSystemStatus[WSASYS_STATUS_LEN+1];
    unsigned short          iMaxSockets;
    unsigned short          iMaxUdpDg;
    char                   *lpVendorInfo;
} WSADATA, *LPWSADATA;

WIN32_IMPORT("WSAStartup")
int WINAPI WSAStartup(WORD wVersionRequired, LPWSADATA lpWSAData);

WIN32_IMPORT("WSACleanup")
int WINAPI WSACleanup(void);

WIN32_IMPORT("WSAGetLastError")
int WINAPI WSAGetLastError(void);

WIN32_IMPORT("socket")
SOCKET WINAPI socket(int af, int type, int protocol);

WIN32_IMPORT("closesocket")
int WINAPI closesocket(SOCKET s);

WIN32_IMPORT("connect")
int WINAPI connect(SOCKET s, const struct sockaddr *name, int namelen);

WIN32_IMPORT("send")
int WINAPI send(SOCKET s, const char *buf, int len, int flags);

WIN32_IMPORT("recv")
int WINAPI recv(SOCKET s, char *buf, int len, int flags);

WIN32_IMPORT("WSAAsyncSelect")
int WINAPI WSAAsyncSelect(SOCKET s, HWND hWnd, u_int wMsg, long lEvent);

WIN32_IMPORT("inet_addr")
unsigned long WINAPI inet_addr(const char *cp);

WIN32_IMPORT("htons")
u_short WINAPI htons(u_short hostshort);

WIN32_IMPORT("htonl")
u_long WINAPI htonl(u_long hostlong);

WIN32_IMPORT("ntohs")
u_short WINAPI ntohs(u_short netshort);

WIN32_IMPORT("ntohl")
u_long WINAPI ntohl(u_long netlong);

WIN32_IMPORT("gethostbyname")
struct hostent * WINAPI gethostbyname(const char *name);

#ifdef __cplusplus
}
#endif

#endif // _WINSOCK_H
