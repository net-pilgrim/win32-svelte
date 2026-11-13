declare module "fengari" {
  export const lua: any;
  export const lauxlib: any;
  export const lualib: any;
  export function to_luastring(str: string): Uint8Array;
  export function to_jsstring(bytes: any): string;
  const fengari: {
    lua: any;
    lauxlib: any;
    lualib: any;
    to_luastring(str: string): Uint8Array;
    to_jsstring(bytes: any): string;
  };
  export default fengari;
}
