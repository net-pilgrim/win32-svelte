/*
 * commdlg.h - Common Dialog Box Definitions for WebAssembly
 */

#ifndef _COMMDLG_H
#define _COMMDLG_H

#ifdef __cplusplus
extern "C" {
#endif

#include "windef.h"
#include "_wasm_platform.h"

// ==============================================================================
// Choose Color Dialog
// ==============================================================================

#define CC_RGBINIT               0x00000001
#define CC_FULLOPEN              0x00000002
#define CC_PREVENTFULLOPEN       0x00000004
#define CC_SHOWHELP              0x00000008
#define CC_ENABLEHOOK            0x00000010
#define CC_ENABLETEMPLATE        0x00000020
#define CC_ENABLETEMPLATEHANDLE  0x00000040
#define CC_SOLIDCOLOR            0x00000080
#define CC_ANYCOLOR              0x00000100

typedef UINT_PTR (CALLBACK *LPCCHOOKPROC)(HWND, UINT, WPARAM, LPARAM);

typedef struct tagCHOOSECOLORA {
    DWORD        lStructSize;
    HWND         hwndOwner;
    HWND         hInstance;
    COLORREF     rgbResult;
    COLORREF*    lpCustColors;
    DWORD        Flags;
    LPARAM       lCustData;
    LPCCHOOKPROC lpfnHook;
    LPCSTR       lpTemplateName;
} CHOOSECOLORA, *LPCHOOSECOLORA;

typedef CHOOSECOLORA CHOOSECOLOR;
typedef LPCHOOSECOLORA LPCHOOSECOLOR;

WIN32_IMPORT("ChooseColorA")
BOOL WINAPI ChooseColorA(LPCHOOSECOLORA lpcc);
#ifndef ChooseColor
#define ChooseColor ChooseColorA
#endif

// ==============================================================================
// Choose Font Dialog
// ==============================================================================

#define CF_SCREENFONTS             0x00000001
#define CF_PRINTERFONTS            0x00000002
#define CF_BOTH                    (CF_SCREENFONTS | CF_PRINTERFONTS)
#define CF_SHOWHELP                0x00000004
#define CF_ENABLEHOOK              0x00000008
#define CF_ENABLETEMPLATE          0x00000010
#define CF_ENABLETEMPLATEHANDLE    0x00000020
#define CF_INITTOLOGFONTSTRUCT     0x00000040
#define CF_USESTYLE                0x00000080
#define CF_EFFECTS                 0x00000100
#define CF_APPLY                   0x00000200
#define CF_ANSIONLY                0x00000400
#define CF_NOVECTORFONTS           0x00000800
#define CF_NOOEMFONTS              CF_NOVECTORFONTS
#define CF_NOSIMULATIONS           0x00001000
#define CF_LIMITSIZE               0x00002000
#define CF_FIXEDPITCHONLY          0x00004000
#define CF_WYSIWYG                 0x00008000
#define CF_FORCEFONTEXIST          0x00010000
#define CF_SCALABLEONLY            0x00020000
#define CF_TTONLY                  0x00040000
#define CF_NOFACESEL               0x00080000
#define CF_NOSTYLESEL              0x00100000
#define CF_NOSIZESEL               0x00200000

typedef UINT_PTR (CALLBACK *LPCFHOOKPROC)(HWND, UINT, WPARAM, LPARAM);

typedef struct tagCHOOSEFONTA {
    DWORD           lStructSize;
    HWND            hwndOwner;
    HDC             hDC;
    LPLOGFONT       lpLogFont;
    INT             iPointSize;
    DWORD           Flags;
    COLORREF        rgbColors;
    LPARAM          lCustData;
    LPCFHOOKPROC    lpfnHook;
    LPCSTR          lpTemplateName;
    HINSTANCE       hInstance;
    LPSTR           lpszStyle;
    WORD            nFontType;
    WORD            ___MISSING_ALIGNMENT__;
    INT             nSizeMin;
    INT             nSizeMax;
} CHOOSEFONTA, *LPCHOOSEFONTA;

typedef CHOOSEFONTA CHOOSEFONT;
typedef LPCHOOSEFONTA LPCHOOSEFONT;

WIN32_IMPORT("ChooseFontA")
BOOL WINAPI ChooseFontA(LPCHOOSEFONTA lpcf);
#ifndef ChooseFont
#define ChooseFont ChooseFontA
#endif

// ==============================================================================
// Open / Save File Dialog
// ==============================================================================

#define OFN_READONLY                 0x00000001
#define OFN_OVERWRITEPROMPT          0x00000002
#define OFN_HIDEREADONLY             0x00000004
#define OFN_NOCHANGEDIR              0x00000008
#define OFN_SHOWHELP                 0x00000010
#define OFN_ENABLEHOOK               0x00000020
#define OFN_ENABLETEMPLATE           0x00000040
#define OFN_ENABLETEMPLATEHANDLE     0x00000080
#define OFN_NOVALIDATE               0x00000100
#define OFN_ALLOWMULTISELECT         0x00000200
#define OFN_EXTENSIONDIFFERENT       0x00000400
#define OFN_PATHMUSTEXIST            0x00000800
#define OFN_FILEMUSTEXIST            0x00001000
#define OFN_CREATEPROMPT             0x00002000
#define OFN_SHAREAWARE               0x00004000
#define OFN_NOREADONLYRETURN         0x00008000
#define OFN_NOTESTFILECREATE         0x00010000
#define OFN_NONETWORKBUTTON          0x00020000
#define OFN_NOLONGNAMES              0x00040000
#define OFN_EXPLORER                 0x00080000
#define OFN_NODEREFERENCELINKS       0x00100000
#define OFN_LONGNAMES                0x00200000

typedef UINT_PTR (CALLBACK *LPOFNHOOKPROC)(HWND, UINT, WPARAM, LPARAM);

typedef struct tagOFNA {
    DWORD         lStructSize;
    HWND          hwndOwner;
    HINSTANCE     hInstance;
    LPCSTR        lpstrFilter;
    LPSTR         lpstrCustomFilter;
    DWORD         nMaxCustFilter;
    DWORD         nFilterIndex;
    LPSTR         lpstrFile;
    DWORD         nMaxFile;
    LPSTR         lpstrFileTitle;
    DWORD         nMaxFileTitle;
    LPCSTR        lpstrInitialDir;
    LPCSTR        lpstrTitle;
    DWORD         Flags;
    WORD          nFileOffset;
    WORD          nFileExtension;
    LPCSTR        lpstrDefExt;
    LPARAM        lCustData;
    LPOFNHOOKPROC lpfnHook;
    LPCSTR        lpTemplateName;
} OPENFILENAMEA, *LPOPENFILENAMEA;

typedef OPENFILENAMEA OPENFILENAME;
typedef LPOPENFILENAMEA LPOPENFILENAME;

WIN32_IMPORT("GetOpenFileNameA")
BOOL WINAPI GetOpenFileNameA(LPOPENFILENAMEA lpofn);
#ifndef GetOpenFileName
#define GetOpenFileName GetOpenFileNameA
#endif

WIN32_IMPORT("GetSaveFileNameA")
BOOL WINAPI GetSaveFileNameA(LPOPENFILENAMEA lpofn);
#ifndef GetSaveFileName
#define GetSaveFileName GetSaveFileNameA
#endif

// ==============================================================================
// Find & Replace Dialog
// ==============================================================================

#define FR_DOWN                      0x00000001
#define FR_WHOLEWORD                 0x00000002
#define FR_MATCHCASE                 0x00000004
#define FR_FINDNEXT                  0x00000008
#define FR_REPLACE                   0x00000010
#define FR_REPLACEALL                0x00000020
#define FR_DIALOGTERM                0x00000040
#define FR_SHOWHELP                  0x00000080
#define FR_ENABLEHOOK                0x00000100
#define FR_ENABLETEMPLATE            0x00000200
#define FR_NOUPDOWN                  0x00000400
#define FR_NOMATCHCASE               0x00000800
#define FR_NOWHOLEWORD               0x00001000
#define FR_ENABLETEMPLATEHANDLE      0x00002000
#define FR_HIDEUPDOWN                0x00004000
#define FR_HIDEMATCHCASE             0x00008000
#define FR_HIDEWHOLEWORD             0x00010000

#define FINDMSGSTRING                "commdlg_FindReplace"

// PrintDlg Flags
#define PD_ALLPAGES                   0x00000000
#define PD_SELECTION                  0x00000001
#define PD_PAGENUMS                   0x00000002
#define PD_NOSELECTION                0x00000004
#define PD_NOPAGENUMS                 0x00000008
#define PD_COLLATE                    0x00000010
#define PD_PRINTTOFILE                0x00000020
#define PD_PRINTSETUP                 0x00000040
#define PD_NOWARNING                  0x00000080
#define PD_RETURNDC                   0x00000100
#define PD_RETURNIC                   0x00000200
#define PD_RETURNDEFAULT              0x00000400
#define PD_SHOWHELP                   0x00000800
#define PD_ENABLEPRINTHOOK            0x00001000
#define PD_ENABLESETUPHOOK            0x00002000
#define PD_ENABLEPRINTTEMPLATE        0x00004000
#define PD_ENABLESETUPTEMPLATE        0x00008000
#define PD_ENABLEPRINTTEMPLATEHANDLE  0x00010000
#define PD_ENABLESETUPTEMPLATEHANDLE  0x00020000
#define PD_USEDEVMODECOPIES           0x00040000
#define PD_USEDEVMODECOPIESANDCOLLATE 0x00040000
#define PD_DISABLEPRINTTOFILE         0x00080000
#define PD_HIDEPRINTTOFILE            0x00100000
#define PD_NONETWORKBUTTON            0x00200000

typedef UINT_PTR (CALLBACK *LPFRHOOKPROC)(HWND, UINT, WPARAM, LPARAM);

typedef struct tagFINDREPLACEA {
    DWORD        lStructSize;
    HWND         hwndOwner;
    HINSTANCE    hInstance;
    DWORD        Flags;
    LPSTR        lpstrFindWhat;
    LPSTR        lpstrReplaceWith;
    WORD         wFindWhatLen;
    WORD         wReplaceWithLen;
    LPARAM       lCustData;
    LPFRHOOKPROC lpfnHook;
    LPCSTR       lpTemplateName;
} FINDREPLACEA, *LPFINDREPLACEA;

typedef FINDREPLACEA FINDREPLACE;
typedef LPFINDREPLACEA LPFINDREPLACE;

WIN32_IMPORT("FindTextA")
HWND WINAPI FindTextA(LPFINDREPLACEA lpfr);
#ifndef FindText
#define FindText FindTextA
#endif

WIN32_IMPORT("ReplaceTextA")
HWND WINAPI ReplaceTextA(LPFINDREPLACEA lpfr);
#ifndef ReplaceText
#define ReplaceText ReplaceTextA
#endif

typedef UINT_PTR (CALLBACK *LPPRINTHOOKPROC)(HWND, UINT, WPARAM, LPARAM);
typedef UINT_PTR (CALLBACK *LPSETUPHOOKPROC)(HWND, UINT, WPARAM, LPARAM);

typedef struct tagPDA {
    DWORD            lStructSize;
    HWND             hwndOwner;
    HGLOBAL          hDevMode;
    HGLOBAL          hDevNames;
    HDC              hDC;
    DWORD            Flags;
    WORD             nFromPage;
    WORD             nToPage;
    WORD             nMinPage;
    WORD             nMaxPage;
    WORD             nCopies;
    HINSTANCE        hInstance;
    LPARAM           lCustData;
    LPPRINTHOOKPROC  lpfnPrintHook;
    LPSETUPHOOKPROC  lpfnSetupHook;
    LPCSTR           lpPrintTemplateName;
    LPCSTR           lpSetupTemplateName;
    HGLOBAL          hPrintTemplate;
    HGLOBAL          hSetupTemplate;
} PRINTDLGA, *LPPRINTDLGA;

typedef PRINTDLGA PRINTDLG;
typedef LPPRINTDLGA LPPRINTDLG;

WIN32_IMPORT("PrintDlgA")
BOOL WINAPI PrintDlgA(LPPRINTDLGA lppd);
#ifndef PrintDlg
#define PrintDlg PrintDlgA
#endif

#ifdef __cplusplus
}
#endif

#endif // _COMMDLG_H
