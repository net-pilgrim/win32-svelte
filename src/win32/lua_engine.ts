import fengari from "fengari";
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
        null
      );

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
      this.wndProcCallbacks.set(className, ref);

      RegisterClassEx({
        className,
        lpfnWndProc: (h, msg, wp, lp) => {
          const cbRef = this.wndProcCallbacks.get(className);
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
      const hdc = BeginPaint(hwnd, ps);
      lua.lua_pushinteger(L, hdc);
      return 1;
    });

    setFunction("EndPaint", (L: any) => {
      const hwnd = lua.lua_tointeger(L, 1);
      const ps: PAINTSTRUCT = {} as any;
      EndPaint(hwnd, ps);
      return 0;
    });

    setFunction("Rectangle", (L: any) => {
      const hdc = lua.lua_tointeger(L, 1);
      const left = lua.lua_tointeger(L, 2);
      const top = lua.lua_tointeger(L, 3);
      const right = lua.lua_tointeger(L, 4);
      const bottom = lua.lua_tointeger(L, 5);
      Rectangle(hdc, left, top, right, bottom);
      return 0;
    });

    setFunction("Ellipse", (L: any) => {
      const hdc = lua.lua_tointeger(L, 1);
      const left = lua.lua_tointeger(L, 2);
      const top = lua.lua_tointeger(L, 3);
      const right = lua.lua_tointeger(L, 4);
      const bottom = lua.lua_tointeger(L, 5);
      Ellipse(hdc, left, top, right, bottom);
      return 0;
    });

    setFunction("Line", (L: any) => {
      const hdc = lua.lua_tointeger(L, 1);
      const x1 = lua.lua_tointeger(L, 2);
      const y1 = lua.lua_tointeger(L, 3);
      const x2 = lua.lua_tointeger(L, 4);
      const y2 = lua.lua_tointeger(L, 5);
      MoveToEx(hdc, x1, y1);
      LineTo(hdc, x2, y2);
      return 0;
    });

    setFunction("TextOut", (L: any) => {
      const hdc = lua.lua_tointeger(L, 1);
      const x = lua.lua_tointeger(L, 2);
      const y = lua.lua_tointeger(L, 3);
      const text = fengari.to_jsstring(lua.lua_tolstring(L, 4, null));
      TextOut(hdc, x, y, text);
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
      lua.lua_close(this.L);
      this.L = null;
    }
  }
}
