/*
 * mmsystem.h - Multimedia API Definitions for WebAssembly (WASM32)
 */

#ifndef _MMSYSTEM_H
#define _MMSYSTEM_H

#include "windef.h"

#ifdef __cplusplus
extern "C" {
#endif

// MMResult error codes
typedef UINT MMRESULT;
#define MMSYSERR_NOERROR      0
#define MMSYSERR_ERROR        1
#define MMSYSERR_BADDEVICEID  2
#define MMSYSERR_NOTENABLED   3
#define MMSYSERR_ALLOCATED    4
#define MMSYSERR_INVALHANDLE  5
#define MMSYSERR_NODRIVER     6
#define MMSYSERR_NOMEM        7
#define MMSYSERR_NOTSUPPORTED 8
#define MMSYSERR_BADERRNUM    9
#define MMSYSERR_INVALFLAG    10
#define MMSYSERR_INVALPARAM   11

// Waveform Audio Types & Constants
DECLARE_HANDLE(HWAVEIN);
DECLARE_HANDLE(HWAVEOUT);
typedef HWAVEIN *LPHWAVEIN;
typedef HWAVEOUT *LPHWAVEOUT;

#define WAVE_MAPPER           ((UINT)-1)
#define WAVE_FORMAT_PCM       1

#define MM_WOM_OPEN           0x03BB
#define MM_WOM_CLOSE          0x03BC
#define MM_WOM_DONE           0x03BD
#define MM_WIM_OPEN           0x03BE
#define MM_WIM_CLOSE          0x03BF
#define MM_WIM_DATA           0x03C0

#define WHDR_DONE             0x00000001
#define WHDR_PREPARED         0x00000002
#define WHDR_BEGINLOOP        0x00000004
#define WHDR_ENDLOOP          0x00000008
#define WHDR_INQUEUE          0x00000010

typedef struct wavehdr_tag {
    LPSTR      lpData;
    DWORD      dwBufferLength;
    DWORD      dwBytesRecorded;
    DWORD_PTR  dwUser;
    DWORD      dwFlags;
    DWORD      dwLoops;
    struct wavehdr_tag *lpNext;
    DWORD_PTR  reserved;
} WAVEHDR, *PWAVEHDR, *LPWAVEHDR;

typedef struct waveformat_tag {
    WORD    wFormatTag;
    WORD    nChannels;
    DWORD   nSamplesPerSec;
    DWORD   nAvgBytesPerSec;
    WORD    nBlockAlign;
} WAVEFORMAT, *PWAVEFORMAT, *LPWAVEFORMAT;

typedef struct pcmwaveformat_tag {
    WAVEFORMAT  wf;
    WORD        wBitsPerSample;
} PCMWAVEFORMAT, *PPCMWAVEFORMAT, *LPPCMWAVEFORMAT;

typedef struct tWAVEFORMATEX {
    WORD        wFormatTag;
    WORD        nChannels;
    DWORD       nSamplesPerSec;
    DWORD       nAvgBytesPerSec;
    WORD        nBlockAlign;
    WORD        wBitsPerSample;
    WORD        cbSize;
} WAVEFORMATEX, *PWAVEFORMATEX, *LPWAVEFORMATEX;

#define CALLBACK_NULL         0x00000000
#define CALLBACK_WINDOW       0x00010000
#define CALLBACK_TASK         0x00020000
#define CALLBACK_FUNCTION     0x00030000
#define CALLBACK_THREAD       (CALLBACK_TASK)
#define CALLBACK_EVENT        0x00050000

// MIDI Audio Types & Constants
DECLARE_HANDLE(HMIDIIN);
DECLARE_HANDLE(HMIDIOUT);
typedef HMIDIIN *LPHMIDIIN;
typedef HMIDIOUT *LPHMIDIOUT;

#define MIDIMAPPER            ((UINT)-1)

typedef struct tagMIDIOUTCAPSA {
    WORD      wMid;
    WORD      wPid;
    UINT      vDriverVersion;
    CHAR      szPname[32];
    WORD      wTechnology;
    WORD      wVoices;
    WORD      wNotes;
    WORD      wChannelMask;
    DWORD     dwSupport;
} MIDIOUTCAPSA, *PMIDIOUTCAPSA, *LPMIDIOUTCAPSA;

typedef struct tagMIDIOUTCAPSW {
    WORD      wMid;
    WORD      wPid;
    UINT      vDriverVersion;
    WCHAR     szPname[32];
    WORD      wTechnology;
    WORD      wVoices;
    WORD      wNotes;
    WORD      wChannelMask;
    DWORD     dwSupport;
} MIDIOUTCAPSW, *PMIDIOUTCAPSW, *LPMIDIOUTCAPSW;

#ifdef UNICODE
typedef MIDIOUTCAPSW MIDIOUTCAPS;
typedef LPMIDIOUTCAPSW LPMIDIOUTCAPS;
#else
typedef MIDIOUTCAPSA MIDIOUTCAPS;
typedef LPMIDIOUTCAPSA LPMIDIOUTCAPS;
#endif

// Multimedia Timer
typedef struct timecaps_tag {
    UINT    wPeriodMin;
    UINT    wPeriodMax;
} TIMECAPS, *PTIMECAPS, *LPTIMECAPS;

#define TIME_ONESHOT    0x0000
#define TIME_PERIODIC   0x0001

typedef void (CALLBACK *LPTIMECALLBACK)(UINT uTimerID, UINT uMsg, DWORD_PTR dwUser, DWORD_PTR dw1, DWORD_PTR dw2);

// MMIO (Multimedia File I/O)
DECLARE_HANDLE(HMMIO);
typedef DWORD           FOURCC;
#define mmioFOURCC(ch0, ch1, ch2, ch3) \
    ((DWORD)(BYTE)(ch0) | ((DWORD)(BYTE)(ch1) << 8) | \
    ((DWORD)(BYTE)(ch2) << 16) | ((DWORD)(BYTE)(ch3) << 24))

typedef struct _MMCKINFO {
    FOURCC          ckid;
    DWORD           cksize;
    FOURCC          fccType;
    DWORD           dwDataOffset;
    DWORD           dwFlags;
} MMCKINFO, *PMMCKINFO, *LPMMCKINFO;

#define MMIO_READ       0x00000000
#define MMIO_WRITE      0x00000001
#define MMIO_READWRITE  0x00000002
#define MMIO_CREATE     0x00001000
#define MMIO_ALLOCBUF   0x00010000
#define MMIO_CREATERIFF 0x00000020
#define MMIO_CREATELIST 0x00000040
#define MMIO_FINDCHUNK  0x00000010
#define MMIO_FINDRIFF   0x00000020
#define MMIO_FINDLIST   0x00000040
#define MMIO_DELETE     0x00000200

// MCI (Media Control Interface)
typedef DWORD       MCIERROR;
typedef UINT        MCIDEVICEID;

#define MM_MCINOTIFY            0x03B9
#define MCI_NOTIFY_SUCCESSFUL   0x0001
#define MCI_NOTIFY_SUPERSEDED   0x0002
#define MCI_NOTIFY_ABORTED      0x0004
#define MCI_NOTIFY_FAILURE      0x0008

#define MCI_OPEN                0x0803
#define MCI_CLOSE               0x0804
#define MCI_PLAY                0x0806
#define MCI_RECORD              0x080F
#define MCI_STOP                0x0808
#define MCI_PAUSE               0x0809
#define MCI_SAVE                0x0813

#define MCI_NOTIFY              0x00000001
#define MCI_WAIT                0x00000002
#define MCI_OPEN_TYPE           0x00002000
#define MCI_OPEN_ELEMENT        0x00000200
#define MCI_SAVE_FILE           0x00000100

typedef struct tagMCI_GENERIC_PARMS {
    DWORD_PTR dwCallback;
} MCI_GENERIC_PARMS, *PMCI_GENERIC_PARMS, *LPMCI_GENERIC_PARMS;

typedef struct tagMCI_OPEN_PARMSA {
    DWORD_PTR   dwCallback;
    MCIDEVICEID wDeviceID;
    LPCSTR      lpstrDeviceType;
    LPCSTR      lpstrElementName;
    LPCSTR      lpstrAlias;
} MCI_OPEN_PARMSA, *PMCI_OPEN_PARMSA, *LPMCI_OPEN_PARMSA;
typedef MCI_OPEN_PARMSA MCI_OPEN_PARMS;
typedef LPMCI_OPEN_PARMSA LPMCI_OPEN_PARMS;

typedef struct tagMCI_PLAY_PARMS {
    DWORD_PTR dwCallback;
    DWORD     dwFrom;
    DWORD     dwTo;
} MCI_PLAY_PARMS, *PMCI_PLAY_PARMS, *LPMCI_PLAY_PARMS;

typedef struct tagMCI_RECORD_PARMS {
    DWORD_PTR dwCallback;
    DWORD     dwFrom;
    DWORD     dwTo;
} MCI_RECORD_PARMS, *PMCI_RECORD_PARMS, *LPMCI_RECORD_PARMS;

typedef struct tagMCI_SAVE_PARMSA {
    DWORD_PTR dwCallback;
    LPCSTR    lpfilename;
} MCI_SAVE_PARMSA, *PMCI_SAVE_PARMSA, *LPMCI_SAVE_PARMSA;
typedef MCI_SAVE_PARMSA MCI_SAVE_PARMS;
typedef LPMCI_SAVE_PARMSA LPMCI_SAVE_PARMS;

// Function prototypes with WIN32_IMPORT
WIN32_IMPORT("waveOutOpen")
MMRESULT WINAPI waveOutOpen(LPHWAVEOUT phwo, UINT uDeviceID, const WAVEFORMATEX *pwfx, DWORD_PTR dwCallback, DWORD_PTR dwInstance, DWORD fdwOpen);

WIN32_IMPORT("waveOutClose")
MMRESULT WINAPI waveOutClose(HWAVEOUT hwo);

WIN32_IMPORT("waveOutPrepareHeader")
MMRESULT WINAPI waveOutPrepareHeader(HWAVEOUT hwo, LPWAVEHDR pwh, UINT cbwh);

WIN32_IMPORT("waveOutUnprepareHeader")
MMRESULT WINAPI waveOutUnprepareHeader(HWAVEOUT hwo, LPWAVEHDR pwh, UINT cbwh);

WIN32_IMPORT("waveOutWrite")
MMRESULT WINAPI waveOutWrite(HWAVEOUT hwo, LPWAVEHDR pwh, UINT cbwh);

WIN32_IMPORT("waveOutPause")
MMRESULT WINAPI waveOutPause(HWAVEOUT hwo);

WIN32_IMPORT("waveOutRestart")
MMRESULT WINAPI waveOutRestart(HWAVEOUT hwo);

WIN32_IMPORT("waveOutReset")
MMRESULT WINAPI waveOutReset(HWAVEOUT hwo);

WIN32_IMPORT("waveInOpen")
MMRESULT WINAPI waveInOpen(LPHWAVEIN phwi, UINT uDeviceID, const WAVEFORMATEX *pwfx, DWORD_PTR dwCallback, DWORD_PTR dwInstance, DWORD fdwOpen);

WIN32_IMPORT("waveInClose")
MMRESULT WINAPI waveInClose(HWAVEIN hwi);

WIN32_IMPORT("waveInPrepareHeader")
MMRESULT WINAPI waveInPrepareHeader(HWAVEIN hwi, LPWAVEHDR pwh, UINT cbwh);

WIN32_IMPORT("waveInUnprepareHeader")
MMRESULT WINAPI waveInUnprepareHeader(HWAVEIN hwi, LPWAVEHDR pwh, UINT cbwh);

WIN32_IMPORT("waveInAddBuffer")
MMRESULT WINAPI waveInAddBuffer(HWAVEIN hwi, LPWAVEHDR pwh, UINT cbwh);

WIN32_IMPORT("waveInStart")
MMRESULT WINAPI waveInStart(HWAVEIN hwi);

WIN32_IMPORT("waveInStop")
MMRESULT WINAPI waveInStop(HWAVEIN hwi);

WIN32_IMPORT("waveInReset")
MMRESULT WINAPI waveInReset(HWAVEIN hwi);

WIN32_IMPORT("midiOutOpen")
MMRESULT WINAPI midiOutOpen(LPHMIDIOUT phmo, UINT uDeviceID, DWORD_PTR dwCallback, DWORD_PTR dwInstance, DWORD fdwOpen);

WIN32_IMPORT("midiOutClose")
MMRESULT WINAPI midiOutClose(HMIDIOUT hmo);

WIN32_IMPORT("midiOutReset")
MMRESULT WINAPI midiOutReset(HMIDIOUT hmo);

WIN32_IMPORT("midiOutShortMsg")
MMRESULT WINAPI midiOutShortMsg(HMIDIOUT hmo, DWORD dwMsg);

WIN32_IMPORT("midiOutGetNumDevs")
UINT WINAPI midiOutGetNumDevs(void);

WIN32_IMPORT("timeGetTime")
DWORD WINAPI timeGetTime(void);

WIN32_IMPORT("mmioDescend")
MMRESULT WINAPI mmioDescend(HMMIO hmmio, LPMMCKINFO pmmcki, const MMCKINFO *pmmckiParent, UINT fuDescend);

WIN32_IMPORT("mmioRead")
LONG WINAPI mmioRead(HMMIO hmmio, char *pch, LONG cch);

WIN32_IMPORT("midiOutGetDevCapsA")
MMRESULT WINAPI midiOutGetDevCapsA(UINT_PTR uDeviceID, LPMIDIOUTCAPSA pmoc, UINT cbmoc);

WIN32_IMPORT("midiOutGetDevCapsW")
MMRESULT WINAPI midiOutGetDevCapsW(UINT_PTR uDeviceID, LPMIDIOUTCAPSW pmoc, UINT cbmoc);

#ifdef UNICODE
#define midiOutGetDevCaps midiOutGetDevCapsW
#else
#define midiOutGetDevCaps midiOutGetDevCapsA
#endif

WIN32_IMPORT("timeGetDevCaps")
MMRESULT WINAPI timeGetDevCaps(LPTIMECAPS ptc, UINT cbtc);

WIN32_IMPORT("timeBeginPeriod")
MMRESULT WINAPI timeBeginPeriod(UINT uPeriod);

WIN32_IMPORT("timeEndPeriod")
MMRESULT WINAPI timeEndPeriod(UINT uPeriod);

WIN32_IMPORT("timeSetEvent")
MMRESULT WINAPI timeSetEvent(UINT uDelay, UINT uResolution, LPTIMECALLBACK lpTimeProc, DWORD_PTR dwUser, UINT fuEvent);

WIN32_IMPORT("timeKillEvent")
MMRESULT WINAPI timeKillEvent(UINT uTimerID);

WIN32_IMPORT("mmioOpenA")
HMMIO WINAPI mmioOpenA(LPSTR szFilename, LPVOID lpmmioinfo, DWORD fdwOpen);

WIN32_IMPORT("mmioClose")
MMRESULT WINAPI mmioClose(HMMIO hmmio, UINT fuClose);

WIN32_IMPORT("mmioCreateChunk")
MMRESULT WINAPI mmioCreateChunk(HMMIO hmmio, LPMMCKINFO pmmcki, UINT fuCreate);

WIN32_IMPORT("mmioAscend")
MMRESULT WINAPI mmioAscend(HMMIO hmmio, LPMMCKINFO pmmcki, UINT fuAscend);

WIN32_IMPORT("mmioWrite")
LONG WINAPI mmioWrite(HMMIO hmmio, const char *pch, LONG cch);

WIN32_IMPORT("mmioStringToFOURCCA")
FOURCC WINAPI mmioStringToFOURCCA(LPCSTR sz, UINT uFlags);

#define mmioOpen mmioOpenA
#define mmioStringToFOURCC mmioStringToFOURCCA

WIN32_IMPORT("mciSendStringA")
MCIERROR WINAPI mciSendStringA(LPCSTR lpstrCommand, LPSTR lpstrReturnString, UINT uReturnLength, HWND hwndCallback);

WIN32_IMPORT("mciGetErrorStringA")
BOOL WINAPI mciGetErrorStringA(MCIERROR mcierr, LPSTR pszText, UINT cchText);

#define mciSendString mciSendStringA
#define mciGetErrorString mciGetErrorStringA

WIN32_IMPORT("mciSendCommandA")
MCIERROR WINAPI mciSendCommandA(MCIDEVICEID mciId, UINT uMsg, DWORD_PTR dwParam1, DWORD_PTR dwParam2);
#define mciSendCommand mciSendCommandA

#ifdef __cplusplus
}
#endif

#endif // _MMSYSTEM_H
