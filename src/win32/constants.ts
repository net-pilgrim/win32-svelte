// Win32 Messages
export const WM_NULL = 0x0000;
export const WM_CREATE = 0x0001;
export const WM_DESTROY = 0x0002;
export const WM_MOVE = 0x0003;
export const WM_SIZE = 0x0005;
export const WM_ACTIVATE = 0x0006;
export const WM_SETFOCUS = 0x0007;
export const WM_KILLFOCUS = 0x0008;
export const WM_ENABLE = 0x000a;
export const WM_SETTEXT = 0x000c;
export const WM_GETTEXT = 0x000d;
export const WM_GETTEXTLENGTH = 0x000e;
export const WM_PAINT = 0x000f;
export const WM_CLOSE = 0x0010;
export const WM_QUIT = 0x0012;
export const WM_SHOWWINDOW = 0x0018;

// Non-client messages
export const WM_NCCREATE = 0x0081;
export const WM_NCDESTROY = 0x0082;
export const WM_NCCALCSIZE = 0x0083;
export const WM_NCHITTEST = 0x0084;
export const WM_NCPAINT = 0x0085;
export const WM_NCACTIVATE = 0x0086;
export const WM_NCLBUTTONDOWN = 0x00a1;
export const WM_NCLBUTTONUP = 0x00a2;

// Keyboard & mouse
export const WM_KEYDOWN = 0x0100;
export const WM_KEYUP = 0x0101;
export const WM_CHAR = 0x0102;
export const WM_COMMAND = 0x0111;
export const WM_TIMER = 0x0113;
export const WM_MOUSEMOVE = 0x0200;
export const WM_LBUTTONDOWN = 0x0201;
export const WM_LBUTTONUP = 0x0202;
export const WM_LBUTTONDBLCLK = 0x0203;
export const WM_RBUTTONDOWN = 0x0204;
export const WM_RBUTTONUP = 0x0205;

// Hit test return codes
export const HTERROR = -2;
export const HTTRANSPARENT = -1;
export const HTNOWHERE = 0;
export const HTCLIENT = 1;
export const HTCAPTION = 2;
export const HTSYSMENU = 3;
export const HTGROWBOX = 4;
export const HTSIZE = HTGROWBOX;
export const HTMENU = 5;
export const HTHSCROLL = 6;
export const HTVSCROLL = 7;
export const HTMINBUTTON = 8;
export const HTMAXBUTTON = 9;
export const HTLEFT = 10;
export const HTRIGHT = 11;
export const HTTOP = 12;
export const HTTOPLEFT = 13;
export const HTTOPRIGHT = 14;
export const HTBOTTOM = 15;
export const HTBOTTOMLEFT = 16;
export const HTBOTTOMRIGHT = 17;
export const HTBORDER = 18;
export const HTCLOSE = 20;

// Window Styles (WS_*)
export const WS_OVERLAPPED = 0x00000000;
export const WS_POPUP = 0x80000000;
export const WS_CHILD = 0x40000000;
export const WS_MINIMIZE = 0x20000000;
export const WS_VISIBLE = 0x10000000;
export const WS_DISABLED = 0x08000000;
export const WS_CLIPSIBLINGS = 0x04000000;
export const WS_CLIPCHILDREN = 0x02000000;
export const WS_MAXIMIZE = 0x01000000;
export const WS_CAPTION = 0x00c00000;     // WS_BORDER | WS_DLGFRAME
export const WS_BORDER = 0x00800000;
export const WS_DLGFRAME = 0x00400000;
export const WS_VSCROLL = 0x00200000;
export const WS_HSCROLL = 0x00100000;
export const WS_SYSMENU = 0x00080000;
export const WS_THICKFRAME = 0x00040000;
export const WS_MINIMIZEBOX = 0x00020000;
export const WS_MAXIMIZEBOX = 0x00010000;

export const WS_OVERLAPPEDWINDOW = (
  WS_OVERLAPPED |
  WS_CAPTION |
  WS_SYSMENU |
  WS_THICKFRAME |
  WS_MINIMIZEBOX |
  WS_MAXIMIZEBOX
);

// ShowWindow commands (SW_*)
export const SW_HIDE = 0;
export const SW_SHOWNORMAL = 1;
export const SW_SHOWMINIMIZED = 2;
export const SW_SHOWMAXIMIZED = 3;
export const SW_MAXIMIZE = 3;
export const SW_SHOWNOACTIVATE = 4;
export const SW_SHOW = 5;
export const SW_MINIMIZE = 6;
export const SW_SHOWMINNOACTIVE = 7;
export const SW_SHOWNA = 8;
export const SW_RESTORE = 9;

// Button Notifications & Styles
export const BS_PUSHBUTTON = 0x00000000;
export const BS_DEFPUSHBUTTON = 0x00000001;
export const BS_CHECKBOX = 0x00000002;
export const BS_AUTOCHECKBOX = 0x00000003;
export const BS_RADIOBUTTON = 0x00000004;
export const BS_GROUPBOX = 0x00000007;
export const BS_AUTORADIOBUTTON = 0x00000009;

export const BN_CLICKED = 0;
export const BN_PAINT = 1;
export const BN_HILITE = 2;
export const BN_UNHILITE = 3;
export const BN_DISABLE = 4;
export const BN_DOUBLECLICKED = 5;
export const BN_RIGHTCLICK = 10;

// Button Messages & States
export const BM_GETCHECK = 0x00f0;
export const BM_SETCHECK = 0x00f1;
export const BST_UNCHECKED = 0;
export const BST_CHECKED = 1;
export const BST_INDETERMINATE = 2;

// Combobox Messages & Notifications
export const CB_ADDSTRING = 0x0143;
export const CB_SETCURSEL = 0x014e;
export const CB_GETCURSEL = 0x0147;
export const CB_GETLBTEXT = 0x0148;
export const CBN_SELCHANGE = 1;

// Progress Bar Messages (msctls_progress32)
export const PBM_SETRANGE = 0x0401;
export const PBM_SETPOS = 0x0402;
export const PBM_DELTAPOS = 0x0403;
export const PBM_SETSTEP = 0x0404;
export const PBM_STEPIT = 0x0405;

// Trackbar / Slider Messages (msctls_trackbar32)
export const TBM_GETPOS = 0x0400;
export const TBM_SETPOS = 0x0405;
export const TBM_SETRANGE = 0x0406;
export const TB_THUMBPOSITION = 4;
export const TB_THUMBTRACK = 5;

// Edit Notifications & Styles
export const ES_LEFT = 0x0000;
export const ES_CENTER = 0x0001;
export const ES_RIGHT = 0x0002;
export const ES_MULTILINE = 0x0004;
export const ES_UPPERCASE = 0x0008;
export const ES_LOWERCASE = 0x0010;
export const ES_PASSWORD = 0x0020;
export const ES_AUTOVSCROLL = 0x0040;
export const ES_AUTOHSCROLL = 0x0080;
export const ES_NOHIDESEL = 0x0100;
export const ES_READONLY = 0x0800;
export const EN_CHANGE = 0x0300;
export const EN_UPDATE = 0x0400;

// Static Styles
export const SS_LEFT = 0x00000000;
export const SS_CENTER = 0x00000001;
export const SS_RIGHT = 0x00000002;

// MessageBox flags
export const MB_OK = 0x00000000;
export const MB_OKCANCEL = 0x00000001;
export const MB_ABORTRETRYIGNORE = 0x00000002;
export const MB_YESNOCANCEL = 0x00000003;
export const MB_YESNO = 0x00000004;
export const MB_RETRYCANCEL = 0x00000005;

export const MB_ICONHAND = 0x00000010;
export const MB_ICONQUESTION = 0x00000020;
export const MB_ICONEXCLAMATION = 0x00000030;
export const MB_ICONASTERISK = 0x00000040;
export const MB_ICONWARNING = MB_ICONEXCLAMATION;
export const MB_ICONERROR = MB_ICONHAND;
export const MB_ICONINFORMATION = MB_ICONASTERISK;

// Dialog Box Return Values
export const IDOK = 1;
export const IDCANCEL = 2;
export const IDABORT = 3;
export const IDRETRY = 4;
export const IDIGNORE = 5;
export const IDYES = 6;
export const IDNO = 7;

// Menu Flags (MF_*)
export const MF_STRING = 0x00000000;
export const MF_POPUP = 0x00000010;
export const MF_SEPARATOR = 0x00000800;
export const MF_DISABLED = 0x00000002;
export const MF_GRAYED = 0x00000001;
export const MF_CHECKED = 0x00000008;
export const MF_UNCHECKED = 0x00000000;

// Helpers
export function LOWORD(l: number): number {
  return l & 0xffff;
}

export function HIWORD(l: number): number {
  return (l >> 16) & 0xffff;
}

export function MAKELPARAM(l: number, h: number): number {
  return ((h & 0xffff) << 16) | (l & 0xffff);
}

export function MAKEWPARAM(l: number, h: number): number {
  return ((h & 0xffff) << 16) | (l & 0xffff);
}
