import {
  type IUnknown,
  type IDispatch,
  type HRESULT,
  type GUID,
  S_OK,
  E_NOINTERFACE,
  E_POINTER,
  DISP_E_MEMBERNOTFOUND,
  DISP_E_UNKNOWNNAME,
  DISP_E_TYPEMISMATCH,
  DISP_E_BADPARAMCOUNT,
  DISPATCH_METHOD,
  DISPATCH_PROPERTYGET,
  DISPATCH_PROPERTYPUT,
} from "./types";
import { IID_IUnknown, IID_IDispatch, guidEquals } from "./guid";

/**
 * Base implementation of IDispatch for TypeScript classes.
 * Inspects public methods and properties automatically.
 */
export class DispatchObject implements IDispatch {
  protected refCount = 1;
  private nameToDispId = new Map<string, number>();
  private dispIdToName = new Map<number, string>();
  private nextDispId = 100;

  constructor() {
    this.registerMethodsAndProperties();
  }

  private registerMethodsAndProperties(): void {
    const proto = Object.getPrototypeOf(this);
    const propNames = new Set<string>();

    // Current object own properties
    for (const key of Object.getOwnPropertyNames(this)) {
      if (!key.startsWith("_") && key !== "refCount" && key !== "nameToDispId" && key !== "dispIdToName") {
        propNames.add(key);
      }
    }

    // Prototype methods and getters/setters
    let currentProto = proto;
    while (currentProto && currentProto !== Object.prototype) {
      for (const name of Object.getOwnPropertyNames(currentProto)) {
        if (
          name !== "constructor" &&
          name !== "QueryInterface" &&
          name !== "AddRef" &&
          name !== "Release" &&
          name !== "GetTypeInfoCount" &&
          name !== "GetIDsOfNames" &&
          name !== "Invoke" &&
          !name.startsWith("_")
        ) {
          propNames.add(name);
        }
      }
      currentProto = Object.getPrototypeOf(currentProto);
    }

    for (const name of propNames) {
      const lower = name.toLowerCase();
      if (!this.nameToDispId.has(lower)) {
        const id = this.nextDispId++;
        this.nameToDispId.set(lower, id);
        this.dispIdToName.set(id, name);
      }
    }
  }

  public registerMember(name: string, dispId?: number): number {
    const lower = name.toLowerCase();
    if (this.nameToDispId.has(lower)) {
      return this.nameToDispId.get(lower)!;
    }
    const id = dispId !== undefined ? dispId : this.nextDispId++;
    this.nameToDispId.set(lower, id);
    this.dispIdToName.set(id, name);
    return id;
  }

  public QueryInterface(riid: string | GUID): { hr: HRESULT; ppv: any } {
    if (guidEquals(riid, IID_IUnknown) || guidEquals(riid, IID_IDispatch)) {
      this.AddRef();
      return { hr: S_OK, ppv: this };
    }
    return { hr: E_NOINTERFACE, ppv: null };
  }

  public AddRef(): number {
    return ++this.refCount;
  }

  public Release(): number {
    const count = --this.refCount;
    if (count <= 0) {
      this.onDestroy();
    }
    return count;
  }

  protected onDestroy(): void {
    // Cleanup hook
  }

  public GetTypeInfoCount(): number {
    return 1;
  }

  public GetIDsOfNames(rgszNames: string[]): { hr: HRESULT; rgDispId: number[] } {
    const ids: number[] = [];
    let allFound = true;

    for (const name of rgszNames) {
      const lower = name.toLowerCase();
      if (this.nameToDispId.has(lower)) {
        ids.push(this.nameToDispId.get(lower)!);
      } else {
        ids.push(DISP_E_UNKNOWNNAME);
        allFound = false;
      }
    }

    return {
      hr: allFound ? S_OK : DISP_E_UNKNOWNNAME,
      rgDispId: ids,
    };
  }

  public Invoke(
    dispIdMember: number | string,
    _riid: string | GUID | null,
    _lcid: number,
    wFlags: number,
    pDispParams: any[] | { rgvarg: any[]; rgdispidNamedArgs?: number[] }
  ): { hr: HRESULT; pVarResult?: any } {
    let memberName: string | undefined;

    if (typeof dispIdMember === "string") {
      const lower = dispIdMember.toLowerCase();
      if (this.nameToDispId.has(lower)) {
        const id = this.nameToDispId.get(lower)!;
        memberName = this.dispIdToName.get(id);
      } else if (dispIdMember in this) {
        memberName = dispIdMember;
      }
    } else {
      memberName = this.dispIdToName.get(dispIdMember);
    }

    if (!memberName || !(memberName in this)) {
      return { hr: DISP_E_MEMBERNOTFOUND };
    }

    const args = Array.isArray(pDispParams)
      ? pDispParams
      : pDispParams?.rgvarg || [];

    const target: any = this;
    const val = target[memberName];

    try {
      if (typeof val === "function") {
        if (wFlags & (DISPATCH_METHOD | DISPATCH_PROPERTYGET)) {
          const result = val.apply(this, args);
          return { hr: S_OK, pVarResult: result };
        }
      } else {
        if (wFlags & DISPATCH_PROPERTYGET) {
          return { hr: S_OK, pVarResult: val };
        } else if (wFlags & DISPATCH_PROPERTYPUT) {
          target[memberName] = args[0];
          return { hr: S_OK };
        }
      }
      return { hr: S_OK, pVarResult: val };
    } catch (err: any) {
      return { hr: DISP_E_TYPEMISMATCH, pVarResult: err?.message };
    }
  }
}

/**
 * Creates an ergonomic JavaScript ES6 Proxy around an IDispatch object,
 * allowing natural JS syntax: obj.Method(arg1, arg2) or obj.Property.
 */
export function createDispatchProxy<T = any>(dispatch: IDispatch): T {
  return new Proxy(dispatch as any, {
    get(target, prop, receiver) {
      if (typeof prop === "symbol" || prop in target) {
        return Reflect.get(target, prop, receiver);
      }

      const propName = String(prop);

      // Return a callable function that resolves via GetIDsOfNames & Invoke
      return (...args: any[]) => {
        const nameRes = target.GetIDsOfNames([propName]);
        if (nameRes.hr === S_OK && nameRes.rgDispId.length > 0) {
          const dispId = nameRes.rgDispId[0];
          const invokeRes = target.Invoke(dispId, null, 0, DISPATCH_METHOD | DISPATCH_PROPERTYGET, args);
          return invokeRes.pVarResult;
        }

        // Direct invoke fallback by name
        const directRes = target.Invoke(propName, null, 0, DISPATCH_METHOD | DISPATCH_PROPERTYGET, args);
        if (directRes.hr === S_OK) {
          return directRes.pVarResult;
        }

        throw new Error(`COM IDispatch property or method '${propName}' not found (HRESULT 0x${(directRes.hr >>> 0).toString(16)})`);
      };
    },

    set(target, prop, value, _receiver) {
      if (typeof prop === "symbol" || prop in target) {
        (target as any)[prop] = value;
        return true;
      }

      const propName = String(prop);
      const nameRes = target.GetIDsOfNames([propName]);
      const dispId = nameRes.hr === S_OK ? nameRes.rgDispId[0] : propName;
      const res = target.Invoke(dispId, null, 0, DISPATCH_PROPERTYPUT, [value]);
      return res.hr === S_OK;
    },
  });
}
