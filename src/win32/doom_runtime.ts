/**
 * DOOM (1993) WebAssembly Runtime for win32-svelte
 * 
 * Drives id Software's classic DOOM engine compiled to WebAssembly (doomgeneric).
 * Renders at 640x400x4 RGBA to HTML5 Canvas.
 */

export interface DoomRuntimeOptions {
  canvas?: HTMLCanvasElement | null;
  wasmURL?: string;
  wasmBytes?: Uint8Array | ArrayBuffer;
  onFrame?: (screen: Uint8ClampedArray) => void;
  enableLogs?: boolean;
}

export class DoomRuntime {
  public readonly doomWidth = 640;
  public readonly doomHeight = 400;

  private wasmURL: string;
  private wasmBytes?: Uint8Array | ArrayBuffer;
  private memory = new WebAssembly.Memory({ initial: 108 });
  private instance: WebAssembly.Instance | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private startTime = 0;
  private animFrameId: number | null = null;
  private running = false;
  private enableLogs = false;
  private onFrame?: (screen: Uint8ClampedArray) => void;

  public frameCount = 0;
  public fps = 0;
  private lastFpsTime = 0;
  private framesThisSecond = 0;

  constructor(options: DoomRuntimeOptions = {}) {
    this.canvas = options.canvas ?? null;
    this.wasmURL = options.wasmURL ?? "/wasm/doom.wasm";
    this.wasmBytes = options.wasmBytes;
    this.onFrame = options.onFrame;
    this.enableLogs = options.enableLogs ?? false;
  }

  public setCanvas(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.canvas.width = this.doomWidth;
    this.canvas.height = this.doomHeight;
    this.ctx = canvas.getContext("2d");
  }

  public isRunning(): boolean {
    return this.running;
  }

  public async init(): Promise<void> {
    if (this.instance) return;

    this.startTime = performance.now();
    this.lastFpsTime = performance.now();

    const readString = (ptr: number, len: number): string => {
      const bytes = new Uint8Array(this.memory.buffer, ptr, len);
      return new TextDecoder("utf-8").decode(bytes);
    };

    const importObj = {
      js: {
        js_milliseconds_since_start: () => performance.now() - this.startTime,
        js_console_log: (ptr: number, len: number) => {
          if (this.enableLogs) console.log("[DOOM]", readString(ptr, len));
        },
        js_stdout: (ptr: number, len: number) => {
          if (this.enableLogs) console.log("[DOOM stdout]", readString(ptr, len));
        },
        js_stderr: (ptr: number, len: number) => {
          if (this.enableLogs) console.error("[DOOM stderr]", readString(ptr, len));
        },
        js_draw_screen: (ptr: number) => {
          this.renderFrame(ptr);
        },
      },
      env: {
        memory: this.memory,
      },
    };

    // 1. Fetch bytes if not provided directly
    let binary = this.wasmBytes;
    if (!binary) {
      try {
        const res = await fetch(this.wasmURL);
        if (res.ok) {
          binary = await res.arrayBuffer();
        } else {
          throw new Error(`Failed to load ${this.wasmURL} (status: ${res.status})`);
        }
      } catch (err) {
        console.warn(`Local doom.wasm not found at ${this.wasmURL}, falling back to CDN...`, err);
        const cdnUrl = "https://cdn.jsdelivr.net/npm/wasm-doom@1.2.0/wasm/doom.wasm";
        const cdnRes = await fetch(cdnUrl);
        binary = await cdnRes.arrayBuffer();
      }
    }

    const result: any = await WebAssembly.instantiate(binary as any, importObj);
    this.instance = result.instance || result;

    // Call DOOM's main() to initialize game state and load doom1.wad
    if (this.instance && typeof (this.instance.exports as any).main === "function") {
      (this.instance.exports as any).main();
    }
  }

  private renderFrame(ptr: number) {
    this.frameCount++;
    this.framesThisSecond++;

    const now = performance.now();
    if (now - this.lastFpsTime >= 1000) {
      this.fps = this.framesThisSecond;
      this.framesThisSecond = 0;
      this.lastFpsTime = now;
    }

    const screen = new Uint8ClampedArray(this.memory.buffer, ptr, this.doomWidth * this.doomHeight * 4);

    if (this.ctx) {
      const imgData = new ImageData(screen, this.doomWidth, this.doomHeight);
      this.ctx.putImageData(imgData, 0, 0);
    }

    if (this.onFrame) {
      this.onFrame(screen);
    }
  }

  public step() {
    if (!this.instance) return;
    try {
      (this.instance.exports as any).doom_loop_step();
    } catch (err) {
      console.error("[DOOM] Step error:", err);
    }
  }

  public start(canvas?: HTMLCanvasElement) {
    if (canvas) {
      this.setCanvas(canvas);
    }
    if (this.running) return;
    this.running = true;

    const loop = () => {
      if (!this.running) return;
      this.step();
      if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
        this.animFrameId = window.requestAnimationFrame(loop);
      }
    };

    if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
      this.animFrameId = window.requestAnimationFrame(loop);
    } else {
      // In headless environments, tick via setTimeout
      this.step();
    }
  }

  public pause() {
    this.running = false;
    if (this.animFrameId !== null && typeof window !== "undefined") {
      window.cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  public resume() {
    if (!this.running) {
      this.start();
    }
  }

  public stop() {
    this.pause();
  }

  /**
   * Map standard web / Win32 key codes to DOOM engine keys
   */
  public mapKeyCode(keyCode: number): number {
    switch (keyCode) {
      case 8: return 127;    // Backspace
      case 9: return 9;      // Tab (Automap)
      case 13: return 13;    // Enter
      case 16: return 182;   // Shift (Speed/Run)
      case 17: return 157;   // Ctrl (Fire)
      case 18: return 184;   // Alt (Strafe)
      case 27: return 27;    // Esc (Menu)
      case 32: return 32;    // Space (Open / Use)
      case 37: return 172;   // Left arrow (Turn left)
      case 38: return 173;   // Up arrow (Move forward)
      case 39: return 174;   // Right arrow (Turn right)
      case 40: return 175;   // Down arrow (Move backward)
      // WASD / Modern controls mapping
      case 87: return 173;   // W -> Forward
      case 83: return 175;   // S -> Backward
      case 65: return 172;   // A -> Turn Left
      case 68: return 174;   // D -> Turn Right
      case 69: return 32;    // E -> Use / Open
      case 89: return 121;   // Y (confirm)
      case 78: return 110;   // N (cancel)
      default:
        if (keyCode >= 65 && keyCode <= 90) return keyCode + 32; // a-z
        if (keyCode >= 48 && keyCode <= 57) return keyCode;      // 0-9 (weapons 1-7)
        if (keyCode >= 112 && keyCode <= 123) return keyCode + 75; // F1-F12
        return keyCode;
    }
  }

  /**
   * Send key event to DOOM (type: 0 = keydown, 1 = keyup)
   */
  public sendKey(type: 0 | 1, keyCode: number) {
    if (!this.instance) return;
    const mapped = this.mapKeyCode(keyCode);
    const addBrowserEvent = (this.instance.exports as any).add_browser_event;
    if (typeof addBrowserEvent === "function") {
      addBrowserEvent(type, mapped);
    }
  }
}
