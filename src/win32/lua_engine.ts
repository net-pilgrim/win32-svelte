import * as fengariWeb from "fengari-web";
const fengari: any = (fengariWeb as any).default || fengariWeb;
import {
  kernel,
  CreateWindowEx,
  RegisterClassEx,
  ShowWindow,
  DestroyWindow,
  SendMessage,
  PostMessage,
  DefWindowProc,
  SetWindowText,
  GetWindowText,
  MessageBox,
  ShellExecute,
  audio,
  vfs,
} from "./kernel.svelte";
import {
  BeginPaint,
  EndPaint,
  Rectangle,
  Ellipse,
  MoveToEx,
  LineTo,
  TextOut,
  InvalidateRect,
  GetWindowCanvas,
  RegisterWindowCanvas,
  CreateSolidBrush,
  CreatePen,
  SelectObject,
  SetTextColor,
  SetBkColor,
  HDC,
  type PAINTSTRUCT,
} from "./gdi";
import {
  WM_CREATE,
  WM_DESTROY,
  WM_COMMAND,
  WM_PAINT,
  WM_SIZE,
  WM_CLOSE,
  WM_TIMER,
  WS_OVERLAPPEDWINDOW,
  WS_VISIBLE,
  WS_CHILD,
  BS_PUSHBUTTON,
  ES_MULTILINE,
  ES_AUTOVSCROLL,
  MB_OK,
  MB_OKCANCEL,
  MB_YESNO,
  MB_ICONINFORMATION,
  MB_ICONWARNING,
  MB_ICONERROR,
  SW_HIDE,
  SW_SHOW,
  SW_MINIMIZE,
  SW_MAXIMIZE,
  SW_RESTORE,
  LOWORD,
} from "./constants";
import type { HWND, UINT, WPARAM, LPARAM, LRESULT } from "./types";
import { comRuntime } from "./com/runtime";
import { IID_IDispatch } from "./com/guid";
import { S_OK, CLSCTX_REMOTE_SERVER, DISPATCH_METHOD, DISPATCH_PROPERTYGET, DISPATCH_PROPERTYPUT } from "./com/types";

const { lua, lauxlib, lualib } = fengari;

export interface LuaLogMessage {
  type: "stdout" | "stderr" | "info";
  text: string;
  timestamp: number;
}

export class Win32LuaRuntime {
  private L: any = null;
  private registeredCallbacks: number[] = [];
  private onCommandCallbacks = new Map<number, number>(); // hwnd -> registryRef
  private wndProcCallbacks = new Map<string, number>(); // className -> registryRef
  private nextHdcHandle = 8000;
  private hdcMap = new Map<number, HDC>();
  private nextGdiHandle = 9000;
  private gdiMap = new Map<number, any>();
  public logs: LuaLogMessage[] = [];
  public onLog: ((msg: LuaLogMessage) => void) | null = null;

  constructor() {
    this.initVM();
  }

  public initVM(): void {
    if (this.L) {
      this.dispose();
    }

    this.L = lauxlib.luaL_newstate();
    lualib.luaL_openlibs(this.L);

    this.bindPrint();
    this.bindWin32Table();
  }

  public log(type: "stdout" | "stderr" | "info", text: string): void {
    const msg: LuaLogMessage = { type, text, timestamp: Date.now() };
    this.logs.push(msg);
    if (this.onLog) {
      this.onLog(msg);
    }
  }

  public clearLogs(): void {
    this.logs = [];
  }

  private bindPrint(): void {
    lua.lua_register(
      this.L,
      fengari.to_luastring("print"),
      (L: any) => {
        const n = lua.lua_gettop(L);
        const parts: string[] = [];
        for (let i = 1; i <= n; i++) {
          const strPtr = lua.lua_tolstring(L, i, null);
          if (strPtr) {
            parts.push(fengari.to_jsstring(strPtr));
          } else if (lua.lua_isboolean(L, i)) {
            parts.push(lua.lua_toboolean(L, i) ? "true" : "false");
          } else if (lua.lua_isnil(L, i)) {
            parts.push("nil");
          } else {
            parts.push(`[${fengari.to_jsstring(lua.luaL_typename(L, i))}]`);
          }
        }
        this.log("stdout", parts.join("\t"));
        return 0;
      }
    );
  }

  private bindWin32Table(): void {
    const L = this.L;

    // Create the global 'win32' table
    lua.lua_newtable(L);

    // Register Win32 Constants
    const setConstant = (name: string, val: number) => {
      lua.lua_pushstring(L, fengari.to_luastring(name));
      lua.lua_pushinteger(L, val);
      lua.lua_settable(L, -3);
    };

    setConstant("WM_CREATE", WM_CREATE);
    setConstant("WM_DESTROY", WM_DESTROY);
    setConstant("WM_COMMAND", WM_COMMAND);
    setConstant("WM_PAINT", WM_PAINT);
    setConstant("WM_SIZE", WM_SIZE);
    setConstant("WM_CLOSE", WM_CLOSE);
    setConstant("WM_TIMER", WM_TIMER);

    setConstant("WS_OVERLAPPEDWINDOW", WS_OVERLAPPEDWINDOW);
    setConstant("WS_VISIBLE", WS_VISIBLE);
    setConstant("WS_CHILD", WS_CHILD);
    setConstant("BS_PUSHBUTTON", BS_PUSHBUTTON);
    setConstant("ES_MULTILINE", ES_MULTILINE);
    setConstant("ES_AUTOVSCROLL", ES_AUTOVSCROLL);

    setConstant("MB_OK", MB_OK);
    setConstant("MB_OKCANCEL", MB_OKCANCEL);
    setConstant("MB_YESNO", MB_YESNO);
    setConstant("MB_ICONINFORMATION", MB_ICONINFORMATION);
    setConstant("MB_ICONWARNING", MB_ICONWARNING);
    setConstant("MB_ICONERROR", MB_ICONERROR);

    setConstant("SW_HIDE", SW_HIDE);
    setConstant("SW_SHOW", SW_SHOW);
    setConstant("SW_MINIMIZE", SW_MINIMIZE);
    setConstant("SW_MAXIMIZE", SW_MAXIMIZE);
    setConstant("SW_RESTORE", SW_RESTORE);

    // Register C helper functions inside 'win32'
    const setFunction = (name: string, fn: (L: any) => number) => {
      lua.lua_pushstring(L, fengari.to_luastring(name));
      lua.lua_pushcfunction(L, fn);
      lua.lua_settable(L, -3);
    };

    // win32.MessageBox(hwnd, text, caption, uType)
    setFunction("MessageBox", (L: any) => {
      let hwnd: HWND | null = null;
      let text = "";
      let caption = "Lua Script";
      let uType = MB_OK;

      const top = lua.lua_gettop(L);
      if (top >= 1 && lua.lua_isstring(L, 1)) {
        // win32.MessageBox(text, caption, uType)
        text = fengari.to_jsstring(lua.lua_tolstring(L, 1, null));
        if (top >= 2 && lua.lua_isstring(L, 2)) {
          caption = fengari.to_jsstring(lua.lua_tolstring(L, 2, null));
        }
        if (top >= 3 && lua.lua_isnumber(L, 3)) {
          uType = lua.lua_tointeger(L, 3);
        }
      } else if (top >= 2) {
        // win32.MessageBox(hwnd, text, caption, uType)
        hwnd = lua.lua_tointeger(L, 1);
        text = fengari.to_jsstring(lua.lua_tolstring(L, 2, null));
        if (top >= 3 && lua.lua_isstring(L, 3)) {
          caption = fengari.to_jsstring(lua.lua_tolstring(L, 3, null));
        }
        if (top >= 4 && lua.lua_isnumber(L, 4)) {
          uType = lua.lua_tointeger(L, 4);
        }
      }

      MessageBox(hwnd, text, caption, uType);
      lua.lua_pushinteger(L, 1); // IDOK
      return 1;
    });

    const pushComObjectToLua = (subL: any, comObj: any) => {
      lua.lua_newtable(subL);
      const objTableIdx = lua.lua_gettop(subL);

      lua.lua_newtable(subL);
      const mtIdx = lua.lua_gettop(subL);

      lua.lua_pushstring(subL, fengari.to_luastring("__index"));
      lua.lua_pushcfunction(subL, (idxL: any) => {
        const key = fengari.to_jsstring(lua.lua_tolstring(idxL, 2, null));

        lua.lua_pushcfunction(idxL, (callL: any) => {
          const top = lua.lua_gettop(callL);
          const args: any[] = [];
          let callbackRef: number | null = null;

          for (let i = 2; i <= top; i++) {
            if (i === top && lua.lua_isfunction(callL, i)) {
              lua.lua_pushvalue(callL, i);
              callbackRef = lauxlib.luaL_ref(callL, lua.LUA_REGISTRYINDEX);
              this.registeredCallbacks.push(callbackRef);
            } else if (lua.lua_isnumber(callL, i)) {
              args.push(lua.lua_tonumber(callL, i));
            } else if (lua.lua_isstring(callL, i)) {
              args.push(fengari.to_jsstring(lua.lua_tolstring(callL, i, null)));
            } else if (lua.lua_isboolean(callL, i)) {
              args.push(!!lua.lua_toboolean(callL, i));
            } else if (lua.lua_isnil(callL, i)) {
              args.push(null);
            }
          }

          try {
            let result: any;
            if (typeof comObj.Invoke === "function") {
              const invRes = comObj.Invoke(key, null, 0, DISPATCH_METHOD | DISPATCH_PROPERTYGET, args);
              if (invRes && invRes.hr === S_OK) {
                result = invRes.pVarResult;
              } else if (typeof comObj[key] === "function") {
                result = comObj[key](...args);
              } else {
                result = comObj[key];
              }
            } else if (typeof comObj[key] === "function") {
              result = comObj[key](...args);
            } else {
              result = comObj[key];
            }

            // Handle Promise results from async COM / DCOM methods
            if (result && typeof result.then === "function") {
              if (callbackRef !== null) {
                const cb = callbackRef;
                result
                  .then((asyncVal: any) => {
                    if (!this.L) return;
                    lua.lua_rawgeti(this.L, lua.LUA_REGISTRYINDEX, cb);
                    if (typeof asyncVal === "number") {
                      if (Number.isInteger(asyncVal)) {
                        lua.lua_pushinteger(this.L, asyncVal);
                      } else {
                        lua.lua_pushnumber(this.L, asyncVal);
                      }
                    } else if (typeof asyncVal === "string") {
                      lua.lua_pushstring(this.L, fengari.to_luastring(asyncVal));
                    } else if (typeof asyncVal === "boolean") {
                      lua.lua_pushboolean(this.L, asyncVal ? 1 : 0);
                    } else if (asyncVal === null || asyncVal === undefined) {
                      lua.lua_pushnil(this.L);
                    } else if (Array.isArray(asyncVal)) {
                      lua.lua_createtable(this.L, asyncVal.length, 0);
                      asyncVal.forEach((item, idx) => {
                        lua.lua_pushstring(this.L, fengari.to_luastring(String(item)));
                        lua.lua_rawseti(this.L, -2, idx + 1);
                      });
                    } else {
                      pushComObjectToLua(this.L, asyncVal);
                    }
                    const callRes = lua.lua_pcall(this.L, 1, 0, 0);
                    if (callRes !== 0) {
                      const err = fengari.to_jsstring(lua.lua_tolstring(this.L, -1, null));
                      this.log("stderr", `Async callback error: ${err}`);
                    }
                    lauxlib.luaL_unref(this.L, lua.LUA_REGISTRYINDEX, cb);
                  })
                  .catch((err: any) => {
                    this.log("stderr", `Async method error: ${err?.message || err}`);
                    lauxlib.luaL_unref(this.L, lua.LUA_REGISTRYINDEX, cb);
                  });
              }
              lua.lua_pushnil(callL);
              return 1;
            }

            if (callbackRef !== null) {
              lauxlib.luaL_unref(callL, lua.LUA_REGISTRYINDEX, callbackRef);
            }

            if (typeof result === "number") {
              if (Number.isInteger(result)) {
                lua.lua_pushinteger(callL, result);
              } else {
                lua.lua_pushnumber(callL, result);
              }
            } else if (typeof result === "string") {
              lua.lua_pushstring(callL, fengari.to_luastring(result));
            } else if (typeof result === "boolean") {
              lua.lua_pushboolean(callL, result ? 1 : 0);
            } else if (result === null || result === undefined) {
              lua.lua_pushnil(callL);
            } else if (typeof result === "object") {
              pushComObjectToLua(callL, result);
            } else {
              lua.lua_pushnil(callL);
            }
            return 1;
          } catch (err: any) {
            if (callbackRef !== null) {
              lauxlib.luaL_unref(callL, lua.LUA_REGISTRYINDEX, callbackRef);
            }
            lua.lua_pushnil(callL);
            lua.lua_pushstring(callL, fengari.to_luastring(err?.message || String(err)));
            return 2;
          }
        });

        return 1;
      });
      lua.lua_settable(subL, mtIdx);

      lua.lua_setmetatable(subL, objTableIdx);
    };

    // win32.CreateObject(progId)
    setFunction("CreateObject", (L: any) => {
      const progId = fengari.to_jsstring(lua.lua_tolstring(L, 1, null));
      const res = comRuntime.CoCreateInstance(progId, null, 0x17, IID_IDispatch);
      if (res.hr !== S_OK || !res.ppv) {
        lua.lua_pushnil(L);
        lua.lua_pushstring(L, fengari.to_luastring(`Failed to create COM object '${progId}' (HRESULT 0x${(res.hr >>> 0).toString(16)})`));
        return 2;
      }
      pushComObjectToLua(L, res.ppv);
      return 1;
    });

    // win32.CreateRemoteObject(progId, [serverName], callback)
    setFunction("CreateRemoteObject", (L: any) => {
      const progId = fengari.to_jsstring(lua.lua_tolstring(L, 1, null));
      let serverName = "broadcast://win32-dcom-bus";
      let cbIdx = 2;

      if (lua.lua_isstring(L, 2)) {
        serverName = fengari.to_jsstring(lua.lua_tolstring(L, 2, null));
        if (!serverName.includes("://")) {
          serverName = `broadcast://${serverName}`;
        }
        cbIdx = 3;
      }

      let cbRef = -1;
      if (lua.lua_isfunction(L, cbIdx)) {
        lua.lua_pushvalue(L, cbIdx);
        cbRef = lauxlib.luaL_ref(L, lua.LUA_REGISTRYINDEX);
        this.registeredCallbacks.push(cbRef);
      }

      const pResults = [{ pIID: IID_IDispatch, pItf: null, hr: -1 }];
      comRuntime
        .CoCreateInstanceEx(progId, null, CLSCTX_REMOTE_SERVER, { pwszName: serverName }, 1, pResults)
        .then((res) => {
          const proxy = pResults[0].pItf || res.ppv;
          if (cbRef !== -1) {
            if (res.hr === S_OK && proxy) {
              lua.lua_rawgeti(this.L, lua.LUA_REGISTRYINDEX, cbRef);
              pushComObjectToLua(this.L, proxy);
              lua.lua_pushnil(this.L);
              const pcallRes = lua.lua_pcall(this.L, 2, 0, 0);
              if (pcallRes !== 0) {
                const err = fengari.to_jsstring(lua.lua_tolstring(this.L, -1, null));
                this.log("stderr", `CreateRemoteObject callback error: ${err}`);
              }
            } else {
              lua.lua_rawgeti(this.L, lua.LUA_REGISTRYINDEX, cbRef);
              lua.lua_pushnil(this.L);
              lua.lua_pushstring(this.L, fengari.to_luastring(`DCOM activation failed (hr=0x${(res.hr >>> 0).toString(16)})`));
              lua.lua_pcall(this.L, 2, 0, 0);
            }
            lauxlib.luaL_unref(this.L, lua.LUA_REGISTRYINDEX, cbRef);
          }
        })
        .catch((err) => {
          if (cbRef !== -1) {
            lua.lua_rawgeti(this.L, lua.LUA_REGISTRYINDEX, cbRef);
            lua.lua_pushnil(this.L);
            lua.lua_pushstring(this.L, fengari.to_luastring(err?.message || String(err)));
            lua.lua_pcall(this.L, 2, 0, 0);
            lauxlib.luaL_unref(this.L, lua.LUA_REGISTRYINDEX, cbRef);
          }
        });

      return 0;
    });

    // win32.PlaySound(name)
    setFunction("PlaySound", (L: any) => {
      const name = fengari.to_jsstring(lua.lua_tolstring(L, 1, null)).toLowerCase();
      if (name.includes("chord") || name.includes("error")) audio.playChord();
      else if (name.includes("ding") || name.includes("warn")) audio.playDing();
      else if (name.includes("chime") || name.includes("info")) audio.playChime();
      else if (name.includes("tada") || name.includes("win")) audio.playTada();
      else audio.playClick();
      return 0;
    });

    // win32.CreateWindow(className, title, x, y, width, height, style, parentHwnd)
    setFunction("CreateWindow", (L: any) => {
      const className = fengari.to_jsstring(lua.lua_tolstring(L, 1, null));
      const title = fengari.to_jsstring(lua.lua_tolstring(L, 2, null));
      const x = lua.lua_tointeger(L, 3) || 100;
      const y = lua.lua_tointeger(L, 4) || 100;
      const w = lua.lua_tointeger(L, 5) || 300;
      const h = lua.lua_tointeger(L, 6) || 200;
      const style = lua.lua_isnumber(L, 7)
        ? lua.lua_tointeger(L, 7)
        : WS_OVERLAPPEDWINDOW | WS_VISIBLE;
      const parent = lua.lua_isnumber(L, 8) ? lua.lua_tointeger(L, 8) : null;

      const resolvedClass = className || "LuaWindowClass";
      if (!kernel.getClassWndProc(resolvedClass)) {
        RegisterClassEx({
          className: resolvedClass,
          lpfnWndProc: (h, msg, wp, lp) => DefWindowProc(h, msg, wp, lp),
        });
      }

      const hwnd = CreateWindowEx(
        0,
        resolvedClass,
        title,
        style,
        x,
        y,
        w,
        h,
        parent,
        null,
        null,
        !parent ? { hasCanvas: true } : null
      );

      const win = kernel.getWindow(hwnd);
      if (win && !parent) {
        win.customProps = {
          ...(win.customProps ?? {}),
          hasCanvas: true,
        };
      }

      lua.lua_pushinteger(L, hwnd);
      return 1;
    });

    // win32.CreateButton(title, x, y, width, height, parentHwnd, onClickCallback)
    setFunction("CreateButton", (L: any) => {
      const title = fengari.to_jsstring(lua.lua_tolstring(L, 1, null));
      const x = lua.lua_tointeger(L, 2);
      const y = lua.lua_tointeger(L, 3);
      const w = lua.lua_tointeger(L, 4);
      const h = lua.lua_tointeger(L, 5);
      const parentHwnd = lua.lua_isnumber(L, 6) ? lua.lua_tointeger(L, 6) : null;

      const btnHwnd = CreateWindowEx(
        0,
        "BUTTON",
        title,
        WS_CHILD | WS_VISIBLE | BS_PUSHBUTTON,
        x,
        y,
        w,
        h,
        parentHwnd,
        null,
        null,
        null
      );

      // If a callback was passed
      if (lua.lua_isfunction(L, 7)) {
        lua.lua_pushvalue(L, 7);
        const ref = lauxlib.luaL_ref(L, lua.LUA_REGISTRYINDEX);
        this.registeredCallbacks.push(ref);
        this.onCommandCallbacks.set(btnHwnd, ref);

        // Subclass parent window procedure to route button clicks
        if (parentHwnd) {
          const parentWin = kernel.getWindow(parentHwnd);
          if (parentWin) {
            const oldProc = parentWin.wndProc;
            parentWin.wndProc = (h, msg, wp, lp) => {
              if (msg === WM_COMMAND && wp === btnHwnd) {
                const cbRef = this.onCommandCallbacks.get(btnHwnd);
                if (cbRef !== undefined) {
                  this.invokeLuaCallback(cbRef, [btnHwnd]);
                  return 0;
                }
              }
              return oldProc ? oldProc(h, msg, wp, lp) : DefWindowProc(h, msg, wp, lp);
            };
          }
        }
      }

      lua.lua_pushinteger(L, btnHwnd);
      return 1;
    });

    // win32.CreateEdit(text, x, y, width, height, parentHwnd)
    setFunction("CreateEdit", (L: any) => {
      const text = fengari.to_jsstring(lua.lua_tolstring(L, 1, null));
      const x = lua.lua_tointeger(L, 2);
      const y = lua.lua_tointeger(L, 3);
      const w = lua.lua_tointeger(L, 4);
      const h = lua.lua_tointeger(L, 5);
      const parent = lua.lua_isnumber(L, 6) ? lua.lua_tointeger(L, 6) : null;

      const hwnd = CreateWindowEx(
        0,
        "EDIT",
        text,
        WS_CHILD | WS_VISIBLE | ES_MULTILINE | ES_AUTOVSCROLL,
        x,
        y,
        w,
        h,
        parent,
        null,
        null,
        null
      );
      lua.lua_pushinteger(L, hwnd);
      return 1;
    });

    // win32.CreateStatic(text, x, y, width, height, parentHwnd)
    setFunction("CreateStatic", (L: any) => {
      const text = fengari.to_jsstring(lua.lua_tolstring(L, 1, null));
      const x = lua.lua_tointeger(L, 2);
      const y = lua.lua_tointeger(L, 3);
      const w = lua.lua_tointeger(L, 4);
      const h = lua.lua_tointeger(L, 5);
      const parent = lua.lua_isnumber(L, 6) ? lua.lua_tointeger(L, 6) : null;

      const hwnd = CreateWindowEx(
        0,
        "STATIC",
        text,
        WS_CHILD | WS_VISIBLE,
        x,
        y,
        w,
        h,
        parent,
        null,
        null,
        null
      );
      lua.lua_pushinteger(L, hwnd);
      return 1;
    });

    // win32.SetWindowText(hwnd, text)
    setFunction("SetWindowText", (L: any) => {
      const hwnd = lua.lua_tointeger(L, 1);
      const text = fengari.to_jsstring(lua.lua_tolstring(L, 2, null));
      SetWindowText(hwnd, text);
      return 0;
    });

    // win32.GetWindowText(hwnd)
    setFunction("GetWindowText", (L: any) => {
      const hwnd = lua.lua_tointeger(L, 1);
      const text = GetWindowText(hwnd);
      lua.lua_pushstring(L, fengari.to_luastring(text));
      return 1;
    });

    // win32.ShowWindow(hwnd, nCmdShow)
    setFunction("ShowWindow", (L: any) => {
      const hwnd = lua.lua_tointeger(L, 1);
      const cmd = lua.lua_tointeger(L, 2) || SW_SHOW;
      ShowWindow(hwnd, cmd);
      return 0;
    });

    // win32.DestroyWindow(hwnd)
    setFunction("DestroyWindow", (L: any) => {
      const hwnd = lua.lua_tointeger(L, 1);
      DestroyWindow(hwnd);
      return 0;
    });

    // win32.InvalidateRect(hwnd)
    setFunction("InvalidateRect", (L: any) => {
      const hwnd = lua.lua_tointeger(L, 1);
      InvalidateRect(hwnd);
      return 0;
    });

    // win32.SendMessage(hwnd, msg, wParam, lParam)
    setFunction("SendMessage", (L: any) => {
      const hwnd = lua.lua_tointeger(L, 1);
      const msg = lua.lua_tointeger(L, 2);
      const wp = lua.lua_tointeger(L, 3);
      const lp = lua.lua_tointeger(L, 4);
      const result = SendMessage(hwnd, msg, wp, lp);
      lua.lua_pushinteger(L, typeof result === "number" ? result : 0);
      return 1;
    });

    // win32.PostMessage(hwnd, msg, wParam, lParam)
    setFunction("PostMessage", (L: any) => {
      const hwnd = lua.lua_tointeger(L, 1);
      const msg = lua.lua_tointeger(L, 2);
      const wp = lua.lua_tointeger(L, 3);
      const lp = lua.lua_tointeger(L, 4);
      const ok = PostMessage(hwnd, msg, wp, lp);
      lua.lua_pushboolean(L, ok ? 1 : 0);
      return 1;
    });

    // win32.DefWindowProc(hwnd, msg, wParam, lParam)
    setFunction("DefWindowProc", (L: any) => {
      const hwnd = lua.lua_tointeger(L, 1);
      const msg = lua.lua_tointeger(L, 2);
      const wp = lua.lua_tointeger(L, 3);
      const lp = lua.lua_tointeger(L, 4);
      const res = DefWindowProc(hwnd, msg, wp, lp);
      lua.lua_pushinteger(L, typeof res === "number" ? res : 0);
      return 1;
    });

    // win32.RegisterClass(className, wndProcCallback)
    setFunction("RegisterClass", (L: any) => {
      const className = fengari.to_jsstring(lua.lua_tolstring(L, 1, null));
      if (!lua.lua_isfunction(L, 2)) {
        lua.lua_pushboolean(L, 0);
        return 1;
      }

      lua.lua_pushvalue(L, 2);
      const ref = lauxlib.luaL_ref(L, lua.LUA_REGISTRYINDEX);
      this.registeredCallbacks.push(ref);
      const upper = className.toUpperCase();
      this.wndProcCallbacks.set(upper, ref);

      RegisterClassEx({
        className,
        lpfnWndProc: (h, msg, wp, lp) => {
          const cbRef = this.wndProcCallbacks.get(upper);
          if (cbRef !== undefined) {
            const res = this.invokeLuaCallback(cbRef, [h, msg, wp, lp]);
            if (typeof res === "number") return res;
          }
          return DefWindowProc(h, msg, wp, lp);
        },
      });

      lua.lua_pushboolean(L, 1);
      return 1;
    });

    // win32.ShellExecute(op, file)
    setFunction("ShellExecute", (L: any) => {
      const op = fengari.to_jsstring(lua.lua_tolstring(L, 1, null));
      const file = fengari.to_jsstring(lua.lua_tolstring(L, 2, null));
      ShellExecute(null, op, file);
      return 0;
    });

    // win32.ReadFile(path, callback)
    setFunction("ReadFile", (L: any) => {
      const path = fengari.to_jsstring(lua.lua_tolstring(L, 1, null));
      if (lua.lua_isfunction(L, 2)) {
        lua.lua_pushvalue(L, 2);
        const ref = lauxlib.luaL_ref(L, lua.LUA_REGISTRYINDEX);
        vfs.readTextFile(path).then(
          (text) => {
            this.invokeLuaCallback(ref, [text]);
            lauxlib.luaL_unref(L, lua.LUA_REGISTRYINDEX, ref);
          },
          (err) => {
            this.log("stderr", `ReadFile failed: ${err?.message || err}`);
            lauxlib.luaL_unref(L, lua.LUA_REGISTRYINDEX, ref);
          }
        );
      }
      return 0;
    });

    // win32.WriteFile(path, content, callback)
    setFunction("WriteFile", (L: any) => {
      const path = fengari.to_jsstring(lua.lua_tolstring(L, 1, null));
      const content = fengari.to_jsstring(lua.lua_tolstring(L, 2, null));
      let cbRef = -1;
      if (lua.lua_isfunction(L, 3)) {
        lua.lua_pushvalue(L, 3);
        cbRef = lauxlib.luaL_ref(L, lua.LUA_REGISTRYINDEX);
      }
      vfs.writeTextFile(path, content).then((ok) => {
        if (cbRef !== -1) {
          this.invokeLuaCallback(cbRef, [ok]);
          lauxlib.luaL_unref(L, lua.LUA_REGISTRYINDEX, cbRef);
        }
      });
      return 0;
    });

    // GDI Drawing APIs
    setFunction("BeginPaint", (L: any) => {
      const hwnd = lua.lua_tointeger(L, 1);
      const ps: PAINTSTRUCT = {} as any;
      try {
        let hdc: HDC;
        const canvas = GetWindowCanvas(hwnd);
        if (canvas) {
          hdc = BeginPaint(hwnd, ps);
        } else if (typeof document !== "undefined") {
          const fallbackCanvas = document.createElement("canvas");
          const win = kernel.getWindow(hwnd);
          fallbackCanvas.width = win?.width ?? 300;
          fallbackCanvas.height = win?.height ?? 200;
          RegisterWindowCanvas(hwnd, fallbackCanvas);
          hdc = BeginPaint(hwnd, ps);
        } else {
          // Headless / mock environment
          const dummyCanvas: any = {
            width: 300,
            height: 200,
            getContext: () => ({
              save: () => {},
              restore: () => {},
              strokeRect: () => {},
              fillRect: () => {},
              beginPath: () => {},
              stroke: () => {},
              fill: () => {},
              arc: () => {},
              ellipse: () => {},
              moveTo: () => {},
              lineTo: () => {},
              fillText: () => {},
            }),
          };
          hdc = new HDC(hwnd, dummyCanvas, dummyCanvas.getContext("2d"));
        }
        const handle = ++this.nextHdcHandle;
        this.hdcMap.set(handle, hdc);
        lua.lua_pushinteger(L, handle);
        return 1;
      } catch (err: any) {
        this.log("stderr", `BeginPaint failed for HWND ${hwnd}: ${err?.message || err}`);
        lua.lua_pushinteger(L, 0);
        return 1;
      }
    });

    setFunction("EndPaint", (L: any) => {
      const hwnd = lua.lua_tointeger(L, 1);
      const ps: PAINTSTRUCT = {} as any;
      try {
        EndPaint(hwnd, ps);
      } catch {}
      for (const [handle, hdc] of this.hdcMap.entries()) {
        if (hdc.hwnd === hwnd) {
          this.hdcMap.delete(handle);
        }
      }
      return 0;
    });

    setFunction("Rectangle", (L: any) => {
      const hdcHandle = lua.lua_tointeger(L, 1);
      const left = lua.lua_tointeger(L, 2);
      const top = lua.lua_tointeger(L, 3);
      const right = lua.lua_tointeger(L, 4);
      const bottom = lua.lua_tointeger(L, 5);
      const hdc = this.hdcMap.get(hdcHandle);
      if (hdc) {
        Rectangle(hdc, left, top, right, bottom);
      }
      return 0;
    });

    setFunction("Ellipse", (L: any) => {
      const hdcHandle = lua.lua_tointeger(L, 1);
      const left = lua.lua_tointeger(L, 2);
      const top = lua.lua_tointeger(L, 3);
      const right = lua.lua_tointeger(L, 4);
      const bottom = lua.lua_tointeger(L, 5);
      const hdc = this.hdcMap.get(hdcHandle);
      if (hdc) {
        Ellipse(hdc, left, top, right, bottom);
      }
      return 0;
    });

    setFunction("Line", (L: any) => {
      const hdcHandle = lua.lua_tointeger(L, 1);
      const x1 = lua.lua_tointeger(L, 2);
      const y1 = lua.lua_tointeger(L, 3);
      const x2 = lua.lua_tointeger(L, 4);
      const y2 = lua.lua_tointeger(L, 5);
      const hdc = this.hdcMap.get(hdcHandle);
      if (hdc) {
        MoveToEx(hdc, x1, y1);
        LineTo(hdc, x2, y2);
      }
      return 0;
    });

    setFunction("TextOut", (L: any) => {
      const hdcHandle = lua.lua_tointeger(L, 1);
      const x = lua.lua_tointeger(L, 2);
      const y = lua.lua_tointeger(L, 3);
      const text = fengari.to_jsstring(lua.lua_tolstring(L, 4, null));
      const hdc = this.hdcMap.get(hdcHandle);
      if (hdc) {
        TextOut(hdc, x, y, text);
      }
      return 0;
    });

    setFunction("SetTextColor", (L: any) => {
      const hdcHandle = lua.lua_tointeger(L, 1);
      const color = fengari.to_jsstring(lua.lua_tolstring(L, 2, null));
      const hdc = this.hdcMap.get(hdcHandle);
      if (hdc && color) {
        SetTextColor(hdc, color);
      }
      return 0;
    });

    setFunction("SetBkColor", (L: any) => {
      const hdcHandle = lua.lua_tointeger(L, 1);
      const color = fengari.to_jsstring(lua.lua_tolstring(L, 2, null));
      const hdc = this.hdcMap.get(hdcHandle);
      if (hdc && color) {
        SetBkColor(hdc, color);
      }
      return 0;
    });

    setFunction("CreateSolidBrush", (L: any) => {
      const color = fengari.to_jsstring(lua.lua_tolstring(L, 1, null));
      const brush = CreateSolidBrush(color || "#ffffff");
      const handle = ++this.nextGdiHandle;
      this.gdiMap.set(handle, brush);
      lua.lua_pushinteger(L, handle);
      return 1;
    });

    setFunction("CreatePen", (L: any) => {
      const style = lua.lua_tointeger(L, 1);
      const width = lua.lua_tointeger(L, 2) || 1;
      const color = fengari.to_jsstring(lua.lua_tolstring(L, 3, null));
      const pen = CreatePen(style, width, color || "#000000");
      const handle = ++this.nextGdiHandle;
      this.gdiMap.set(handle, pen);
      lua.lua_pushinteger(L, handle);
      return 1;
    });

    setFunction("SelectObject", (L: any) => {
      const hdcHandle = lua.lua_tointeger(L, 1);
      const objHandle = lua.lua_tointeger(L, 2);
      const hdc = this.hdcMap.get(hdcHandle);
      const obj = this.gdiMap.get(objHandle);
      if (hdc && obj) {
        SelectObject(hdc, obj);
      }
      return 0;
    });

    setFunction("DeleteObject", (L: any) => {
      const objHandle = lua.lua_tointeger(L, 1);
      this.gdiMap.delete(objHandle);
      return 0;
    });

    // Set 'win32' in global environment
    lua.lua_setglobal(L, fengari.to_luastring("win32"));
  }

  public invokeLuaCallback(registryRef: number, args: any[] = []): any {
    const L = this.L;
    if (!L) return null;

    lua.lua_rawgeti(L, lua.LUA_REGISTRYINDEX, registryRef);
    for (const arg of args) {
      if (typeof arg === "number") {
        lua.lua_pushinteger(L, arg);
      } else if (typeof arg === "string") {
        lua.lua_pushstring(L, fengari.to_luastring(arg));
      } else if (typeof arg === "boolean") {
        lua.lua_pushboolean(L, arg ? 1 : 0);
      } else {
        lua.lua_pushnil(L);
      }
    }

    const pcallRes = lua.lua_pcall(L, args.length, 1, 0);
    if (pcallRes !== 0) {
      const err = fengari.to_jsstring(lua.lua_tolstring(L, -1, null));
      this.log("stderr", `Callback error: ${err}`);
      lua.lua_pop(L, 1);
      return null;
    }

    let retVal: any = null;
    if (lua.lua_isnumber(L, -1)) {
      retVal = lua.lua_tointeger(L, -1);
    } else if (lua.lua_isstring(L, -1)) {
      retVal = fengari.to_jsstring(lua.lua_tolstring(L, -1, null));
    } else if (lua.lua_isboolean(L, -1)) {
      retVal = !!lua.lua_toboolean(L, -1);
    }

    lua.lua_pop(L, 1);
    return retVal;
  }

  public execute(code: string): { success: boolean; error?: string } {
    if (!this.L) this.initVM();
    const L = this.L;

    this.log("info", `> Running Lua script (${code.trim().split("\n").length} lines)...`);

    const status = lauxlib.luaL_dostring(L, fengari.to_luastring(code));
    if (status !== 0) {
      const err = lua.lua_tojsstring(L, -1) || "Unknown Lua error";
      lua.lua_pop(L, 1);
      this.log("stderr", `Error: ${err}`);
      return { success: false, error: err };
    }

    this.log("info", "✓ Execution finished successfully.");
    return { success: true };
  }

  public dispose(): void {
    if (this.L) {
      for (const ref of this.registeredCallbacks) {
        lauxlib.luaL_unref(this.L, lua.LUA_REGISTRYINDEX, ref);
      }
      this.registeredCallbacks = [];
      this.onCommandCallbacks.clear();
      this.wndProcCallbacks.clear();
      this.hdcMap.clear();
      this.gdiMap.clear();
      lua.lua_close(this.L);
      this.L = null;
    }
  }
}
