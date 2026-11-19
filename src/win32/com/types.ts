/**
 * Win32 COM / DCOM Types, Interfaces and Constants
 */

export type HRESULT = number;

// Standard HRESULT constants
export const S_OK: HRESULT = 0x00000000;
export const S_FALSE: HRESULT = 0x00000001;
export const E_UNEXPECTED: HRESULT = 0x8000ffff | 0;
export const E_NOTIMPL: HRESULT = 0x80004001 | 0;
export const E_OUTOFMEMORY: HRESULT = 0x8007000e | 0;
export const E_INVALIDARG: HRESULT = 0x80070057 | 0;
export const E_NOINTERFACE: HRESULT = 0x80004002 | 0;
export const E_POINTER: HRESULT = 0x80004003 | 0;
export const E_HANDLE: HRESULT = 0x80070006 | 0;
export const E_ABORT: HRESULT = 0x80004004 | 0;
export const E_FAIL: HRESULT = 0x80004005 | 0;
export const E_ACCESSDENIED: HRESULT = 0x80070005 | 0;

// COM Class Factory & Registration HRESULTs
export const CLASS_E_NOAGGREGATION: HRESULT = 0x80040110 | 0;
export const CLASS_E_CLASSNOTAVAILABLE: HRESULT = 0x80040111 | 0;
export const REGDB_E_CLASSNOTREG: HRESULT = 0x80040154 | 0;
export const CO_E_NOTINITIALIZED: HRESULT = 0x800401f0 | 0;
export const CO_E_ALREADYINITIALIZED: HRESULT = 0x800401f1 | 0;

// OLE Automation / IDispatch HRESULTs
export const DISP_E_UNKNOWNINTERFACE: HRESULT = 0x80020001 | 0;
export const DISP_E_MEMBERNOTFOUND: HRESULT = 0x80020003 | 0;
export const DISP_E_PARAMNOTFOUND: HRESULT = 0x80020004 | 0;
export const DISP_E_TYPEMISMATCH: HRESULT = 0x80020005 | 0;
export const DISP_E_UNKNOWNNAME: HRESULT = 0x80020006 | 0;
export const DISP_E_BADPARAMCOUNT: HRESULT = 0x8002000e | 0;
export const DISP_E_EXCEPTION: HRESULT = 0x80020009 | 0;

// DCOM / RPC HRESULTs
export const RPC_E_SERVERUNAVAILABLE: HRESULT = 0x80010108 | 0;
export const RPC_E_CALL_REJECTED: HRESULT = 0x80010001 | 0;
export const RPC_E_DISCONNECTED: HRESULT = 0x80010108 | 0;
export const RPC_S_OK: HRESULT = 0;

// Class Context (CLSCTX)
export const CLSCTX_INPROC_SERVER = 0x1;
export const CLSCTX_INPROC_HANDLER = 0x2;
export const CLSCTX_LOCAL_SERVER = 0x4;
export const CLSCTX_INPROC = CLSCTX_INPROC_SERVER | CLSCTX_INPROC_HANDLER;
export const CLSCTX_REMOTE_SERVER = 0x10;
export const CLSCTX_SERVER = CLSCTX_INPROC_SERVER | CLSCTX_LOCAL_SERVER | CLSCTX_REMOTE_SERVER;
export const CLSCTX_ALL = CLSCTX_INPROC_SERVER | CLSCTX_INPROC_HANDLER | CLSCTX_LOCAL_SERVER | CLSCTX_REMOTE_SERVER;

// Registration Flags (REGCLS)
export const REGCLS_SINGLEUSE = 0;
export const REGCLS_MULTIPLEUSE = 1;
export const REGCLS_MULTI_SEPARATE = 2;
export const REGCLS_SUSPENDED = 4;
export const REGCLS_SURROGATE = 8;

// CoInitialize concurrency model (COINIT)
export const COINIT_APARTMENTTHREADED = 0x2;
export const COINIT_MULTITHREADED = 0x0;
export const COINIT_DISABLE_OLE1DDE = 0x4;
export const COINIT_SPEED_OVER_MEMORY = 0x8;

// OLE Automation Dispatch Flags
export const DISPATCH_METHOD = 0x1;
export const DISPATCH_PROPERTYGET = 0x2;
export const DISPATCH_PROPERTYPUT = 0x4;
export const DISPATCH_PROPERTYPUTREF = 0x8;

// Special DISPIDs
export const DISPID_UNKNOWN = -1;
export const DISPID_VALUE = 0;
export const DISPID_PROPERTYPUT = -3;
export const DISPID_NEWENUM = -4;
export const DISPID_EVALUATE = -5;

// VARENUM / VARIANT types
export enum VARENUM {
  VT_EMPTY = 0,
  VT_NULL = 1,
  VT_I2 = 2,
  VT_I4 = 3,
  VT_R4 = 4,
  VT_R8 = 5,
  VT_CY = 6,
  VT_DATE = 7,
  VT_BSTR = 8,
  VT_DISPATCH = 9,
  VT_ERROR = 10,
  VT_BOOL = 11,
  VT_VARIANT = 12,
  VT_UNKNOWN = 13,
  VT_DECIMAL = 14,
  VT_I1 = 16,
  VT_UI1 = 17,
  VT_UI2 = 18,
  VT_UI4 = 19,
  VT_I8 = 20,
  VT_UI8 = 21,
  VT_INT = 22,
  VT_UINT = 23,
  VT_VOID = 24,
  VT_HRESULT = 25,
  VT_PTR = 26,
  VT_SAFEARRAY = 27,
  VT_CARRAY = 28,
  VT_USERDEFINED = 29,
  VT_LPSTR = 30,
  VT_LPWSTR = 31,
  VT_ARRAY = 0x2000,
  VT_BYREF = 0x4000,
}

export interface VARIANT {
  vt: VARENUM | number;
  val: any;
}

// GUID structure
export interface GUID {
  Data1: number;
  Data2: number;
  Data3: number;
  Data4: [number, number, number, number, number, number, number, number];
}

export type IID = GUID;
export type CLSID = GUID;

// IUnknown Interface
export interface IUnknown {
  QueryInterface(riid: string | GUID): { hr: HRESULT; ppv: any };
  AddRef(): number;
  Release(): number;
}

// IClassFactory Interface
export interface IClassFactory extends IUnknown {
  CreateInstance(pUnkOuter: IUnknown | null, riid: string | GUID): { hr: HRESULT; ppv: any };
  LockServer(fLock: boolean): HRESULT;
}

// IDispatch Interface
export interface IDispatch extends IUnknown {
  GetTypeInfoCount(): number;
  GetIDsOfNames(rgszNames: string[]): { hr: HRESULT; rgDispId: number[] };
  Invoke(
    dispIdMember: number | string,
    riid: string | GUID | null,
    lcid: number,
    wFlags: number,
    pDispParams: any[] | { rgvarg: any[]; rgdispidNamedArgs?: number[] }
  ): { hr: HRESULT; pVarResult?: any };
}

// COSERVERINFO for DCOM
export interface COSERVERINFO {
  dwReserved1?: number;
  pwszName: string; // e.g. "local", "tab://<tabId>", "broadcast://<channel>", "ws://<host>:<port>"
  pAuthInfo?: any;
  dwReserved2?: number;
}

// MULTI_QI for CoCreateInstanceEx
export interface MULTI_QI {
  pIID: string | GUID;
  pItf: any;
  hr: HRESULT;
}
