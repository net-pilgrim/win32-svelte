/**
 * Win32 TypeScript Library Entry Point
 *
 * Complete TypeScript implementations of classic Win32 APIs
 * that can be consumed directly by TypeScript/JavaScript applications
 * without needing WebAssembly compilation.
 */

// Types & Handles
export * from "./types";

// Win32 Constants (Messages, Window Styles, Colors, Virtual Keys, etc.)
export * from "./constants";

// Kernel & Window Management (User32 / Kernel32)
export {
  kernel,
  Win32Kernel,
  RegisterClass,
  RegisterClassEx,
  CreateWindow,
  CreateWindowEx,
  ShowWindow,
  UpdateWindow,
  DestroyWindow,
  EnableWindow,
  IsWindow,
  GetParent,
  GetDesktopWindow,
  GetClientRect,
  GetWindowRect,
  AdjustWindowRect,
  AdjustWindowRectEx,
  SetWindowPos,
  GetSystemMetrics,
  SendMessage,
  PostMessage,
  GetMessage,
  TranslateMessage,
  DispatchMessage,
  PostQuitMessage,
  DefWindowProc,
  SetWindowText,
  GetWindowText,
  MoveWindow,
  SetTimer,
  KillTimer,
  MessageBox,
  CreateMenu,
  CreatePopupMenu,
  DestroyMenu,
  AppendMenu,
  SetMenu,
  GetMenu,
  CheckMenuItem,
  EnableMenuItem,
  InitCommonControlsEx,
  DragAcceptFiles,
  DragQueryFile,
  DragQueryPoint,
  DragFinish,
  ShellExecute,
  RunMessageLoop,
  CreateFile,
  ReadFile,
  WriteFile,
  SetFilePointer,
  GetFileSize,
  CloseHandle,
  DeleteFile,
  MoveFile,
  CopyFile,
  CreateDirectory,
  RemoveDirectory,
  GetFileAttributes,
  FindFirstFile,
  FindNextFile,
  FindClose,
  GetLogicalDrives,
} from "./kernel.svelte";

// GDI (Graphics Device Interface - GDI32)
export {
  HDC,
  BeginPaint,
  EndPaint,
  RegisterWindowCanvas,
  UnregisterWindowCanvas,
  GetWindowCanvas,
  MoveToEx,
  LineTo,
  Rectangle,
  Ellipse,
  RoundRect,
  Polyline,
  Polygon,
  TextOut,
  SetTextColor,
  SetBkColor,
  CreateSolidBrush,
  CreatePen,
  SelectObject,
  DeleteObject,
  GetStockObject,
  GetDeviceCaps,
  FillRect,
  InvalidateRect,
} from "./gdi";
export type { HBRUSH, HPEN, HGDIOBJ, PAINTSTRUCT } from "./gdi";

// Audio & Sound (WinMM)
export { audio, MessageBeep } from "./audio";

// Dialogs & Resources (User32 Dialogs)
export {
  CreateDialog,
  CreateDialogParam,
  DialogBox,
  DialogBoxParam,
  EndDialog,
  GetDlgItem,
  SetDlgItemText,
  GetDlgItemText,
  SetDlgItemInt,
  GetDlgItemInt,
  SendDlgItemMessage,
  CheckDlgButton,
  IsDlgButtonChecked,
  GetDlgCtrlID,
  LoadMenu,
  LoadString,
  MapDialogRect,
  RegisterResourceBundle,
} from "./dialog";

// Virtual File System (Origin Private File System)
export { vfs, Win32VFS } from "./vfs";

// Registry (Advapi32)
export {
  registry,
  Win32Registry,
  RegOpenKeyEx,
  RegCreateKeyEx,
  RegCloseKey,
  RegQueryValueEx,
  RegSetValueEx,
  RegDeleteKey,
  RegDeleteValue,
} from "./registry";

// Printing (Winspool / GDI Print)
export {
  PrinterHDC,
  CreateDC,
  DeleteDC,
  StartDoc,
  StartPage,
  EndPage,
  EndDoc,
  AbortDoc,
  PrintDlg,
  StartPrintPreview,
  PrintTextDocument,
  PrintCanvasGraphics,
  TriggerBrowserPrint,
} from "./print";

// ODBC Database (ODBC32)
export {
  odbc,
  odbcManager,
  ODBCDataSourceManager,
  Win32ODBCEngine,
  SQLAllocHandle,
  SQLSetEnvAttr,
  SQLFreeHandle,
  SQLConnect,
  SQLDriverConnect,
  SQLDisconnect,
  SQLExecDirect,
  SQLFetch,
  SQLGetData,
  SQLNumResultCols,
  SQLDescribeCol,
  SQLRowCount,
  SQLGetDiagRec,
} from "./odbc";

// Vector Metafiles (EMF / SVG)
export {
  SvgMetafile,
  MetafileSvgRecorder,
  parseEmfToSvg,
  parseWmfToSvg,
} from "./metafile_svg";

// WebAssembly Runtime (for executing compiled C/C++ WASM modules)
export { Win32WasmRuntime } from "./wasm_bridge";
