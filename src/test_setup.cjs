// Polyfill Svelte 5 runes for Node.js tsx CLI execution
globalThis.$state = (init) => init;
globalThis.$derived = (fn) => (typeof fn === "function" ? fn() : fn);
globalThis.$effect = () => {};
globalThis.$props = () => ({});
if (typeof globalThis.window === "undefined") {
  globalThis.window = globalThis;
}
