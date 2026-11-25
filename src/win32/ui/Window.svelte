<script lang="ts">
  import { untrack } from "svelte";
  import {
    kernel,
    SendMessage,
    MoveWindow,
  } from "../kernel.svelte";
  import {
    WM_CLOSE,
    WM_PAINT,
    WM_SIZE,
    WM_LBUTTONDOWN,
    WM_LBUTTONUP,
    WM_MOUSEMOVE,
    WM_DROPFILES,
    WM_KEYDOWN,
    WM_KEYUP,
    WS_THICKFRAME,
    WS_MINIMIZEBOX,
    WS_MAXIMIZEBOX,
    WS_EX_ACCEPTFILES,
    MAKELPARAM,
  } from "../constants";
  import type { WindowRecord, HDROP, DropFileInfo } from "../types";
  import Control from "./Control.svelte";
  import MenuBar from "./MenuBar.svelte";
  import Self from "./Window.svelte";
  import { RegisterWindowCanvas, UnregisterWindowCanvas } from "../gdi";

  interface Props {
    window: WindowRecord;
    isMdiChild?: boolean;
  }

  let { window: win, isMdiChild = false }: Props = $props();

  let canvasRef = $state<HTMLCanvasElement | null>(null);

  let clientCanvasWidth = $derived(
    Math.max(
      10,
      (win.maximized
        ? (isMdiChild
            ? (kernel.getWindow(win.parentHwnd ?? 0)?.width ?? 600)
            : (typeof window !== "undefined" ? window.innerWidth : 800))
        : win.width) - 16
    )
  );
  let clientCanvasHeight = $derived(
    Math.max(
      10,
      (win.maximized
        ? (isMdiChild
            ? (kernel.getWindow(win.parentHwnd ?? 0)?.height ?? 400)
            : (typeof window !== "undefined" ? window.innerHeight - 30 : 600))
        : win.height) - (win.hMenu ? 64 : 44)
    )
  );

  $effect(() => {
    const w = clientCanvasWidth;
    const h = clientCanvasHeight;
    const c = canvasRef;
    if (c && win.customProps?.hasCanvas) {
      untrack(() => {
        RegisterWindowCanvas(win.hwnd, c);
        SendMessage(win.hwnd, WM_SIZE, 0, MAKELPARAM(w, h));
        SendMessage(win.hwnd, WM_PAINT, 0, 0);
      });
    }
    return () => {
      UnregisterWindowCanvas(win.hwnd);
    };
  });

  function onCanvasPointerDown(e: PointerEvent) {
    SendMessage(win.hwnd, WM_LBUTTONDOWN, 1, MAKELPARAM(Math.round(e.offsetX), Math.round(e.offsetY)));
  }

  function onCanvasPointerMove(e: PointerEvent) {
    SendMessage(
      win.hwnd,
      WM_MOUSEMOVE,
      e.buttons === 1 ? 1 : 0,
      MAKELPARAM(Math.round(e.offsetX), Math.round(e.offsetY))
    );
  }

  function onCanvasPointerUp(e: PointerEvent) {
    SendMessage(win.hwnd, WM_LBUTTONUP, 0, MAKELPARAM(Math.round(e.offsetX), Math.round(e.offsetY)));
  }

  function onWindowKeyDown(e: KeyboardEvent) {
    if (isMdiChild || !isActive) return;
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Tab"].includes(e.code)) {
      e.preventDefault();
    }
    SendMessage(win.hwnd, WM_KEYDOWN, e.keyCode, 0);
  }

  function onWindowKeyUp(e: KeyboardEvent) {
    if (isMdiChild || !isActive) return;
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }
    SendMessage(win.hwnd, WM_KEYUP, e.keyCode, 0);
  }

  let isActive = $derived(
    kernel.activeHwnd === win.hwnd ||
      (!isMdiChild &&
        kernel.windows.some(
          (w) =>
            w.hwnd === kernel.activeHwnd &&
            (w.parentHwnd === win.hwnd ||
              kernel.getWindow(w.parentHwnd ?? 0)?.parentHwnd === win.hwnd)
        ))
  );
  let children = $derived(kernel.windows.filter((w) => w.parentHwnd === win.hwnd));

  // Dragging state
  let isDragging = $state(false);
  let dragOffset = { x: 0, y: 0 };

  // Resizing state
  let isResizing = $state(false);
  let resizeStart = { x: 0, y: 0, width: 0, height: 0 };

  function onFocusWindow() {
    kernel.BringToFront(win.hwnd);
    if (isMdiChild && win.parentHwnd) {
      SendMessage(win.parentHwnd, 0x0222 /* WM_MDIACTIVATE */, win.hwnd, 0);
    }
  }

  function onCloseClick(e: MouseEvent) {
    e.stopPropagation();
    SendMessage(win.hwnd, WM_CLOSE, 0, 0);
  }

  function onMinimizeClick(e: MouseEvent) {
    e.stopPropagation();
    win.minimized = true;
  }

  function onMaximizeClick(e: MouseEvent) {
    e.stopPropagation();
    win.maximized = !win.maximized;
    const w = clientCanvasWidth;
    const h = clientCanvasHeight;
    SendMessage(win.hwnd, WM_SIZE, win.maximized ? 2 /* SIZE_MAXIMIZED */ : 0, MAKELPARAM(w, h));
    SendMessage(win.hwnd, WM_PAINT, 0, 0);
  }

  function onTitleBarPointerDown(e: PointerEvent) {
    if (win.maximized) return;
    onFocusWindow();
    isDragging = true;
    dragOffset = {
      x: e.clientX - win.x,
      y: e.clientY - win.y,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onTitleBarPointerMove(e: PointerEvent) {
    if (!isDragging) return;
    const newX = Math.max(0, e.clientX - dragOffset.x);
    const newY = Math.max(0, e.clientY - dragOffset.y);
    MoveWindow(win.hwnd, newX, newY, win.width, win.height);
  }

  function onTitleBarPointerUp(e: PointerEvent) {
    if (isDragging) {
      isDragging = false;
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
    }
  }

  // Resizing
  function onResizePointerDown(e: PointerEvent) {
    e.stopPropagation();
    if (win.maximized) return;
    onFocusWindow();
    isResizing = true;
    resizeStart = {
      x: e.clientX,
      y: e.clientY,
      width: win.width,
      height: win.height,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onResizePointerMove(e: PointerEvent) {
    if (!isResizing) return;
    const deltaX = e.clientX - resizeStart.x;
    const deltaY = e.clientY - resizeStart.y;
    const newWidth = Math.max(160, resizeStart.width + deltaX);
    const newHeight = Math.max(80, resizeStart.height + deltaY);
    MoveWindow(win.hwnd, win.x, win.y, newWidth, newHeight);
  }

  function onResizePointerUp(e: PointerEvent) {
    if (isResizing) {
      isResizing = false;
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
    }
  }

  let acceptsDrops = $derived(
    (win.exStyle & WS_EX_ACCEPTFILES) !== 0 || !!win.customProps?.acceptDropFiles
  );
  let isDragOver = $state(false);

  function onDragOver(e: DragEvent) {
    if (!acceptsDrops || !e.dataTransfer?.types.some((type) => type === "Files" || type === "application/win32-file")) return;
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "copy";
    }
    isDragOver = true;
  }

  function onDragLeave(e: DragEvent) {
    if (!acceptsDrops) return;
    isDragOver = false;
  }

  async function onDrop(e: DragEvent) {
    if (!acceptsDrops || !e.dataTransfer?.types.some((type) => type === "Files" || type === "application/win32-file")) return;
    e.preventDefault();
    isDragOver = false;

    const clientRect = (e.currentTarget as HTMLElement)
      .querySelector(".client-area")!
      .getBoundingClientRect();
    const dropPoint = {
      x: Math.round(e.clientX - clientRect.left),
      y: Math.round(e.clientY - clientRect.top),
    };
    const files: DropFileInfo[] = [];

    // 1. Check if internal Win32 drag payload (e.g. from Explorer or another window)
    const win32Data = e.dataTransfer?.getData("application/win32-file");
    if (win32Data) {
      try {
        const parsed = JSON.parse(win32Data);
        files.push({
          name: parsed.name,
          size: parsed.size,
          type: parsed.type,
          content: parsed.content ?? `[Content of ${parsed.name}]`,
          isInternal: true,
          data: parsed,
        });
      } catch {}
    }

    // 2. Check if host OS files were dropped via HTML5 File API
    const droppedFiles = Array.from(e.dataTransfer?.files ?? []);
    if (droppedFiles.length > 0) {
      for (const file of droppedFiles) {
        const ext = file.name.split(".").pop()?.toUpperCase() ?? "";
        const isBinary = ["WASM", "WAD", "EXE", "DLL", "BIN", "PNG", "JPG", "JPEG", "BMP", "ICO", "DAT", "EMF", "WMF"].includes(ext);
        let content: string | Uint8Array = "";
        if (isBinary) {
          const buf = await file.arrayBuffer();
          content = new Uint8Array(buf);
        } else {
          try {
            content = await file.text();
          } catch {
            const buf = await file.arrayBuffer();
            content = new Uint8Array(buf);
          }
        }
        files.push({
          name: file.name,
          size: file.size,
          type: file.type,
          content,
          isInternal: false,
        });
      }
    }

    if (files.length > 0) {
      const hDrop: HDROP = {
        files,
        pt: dropPoint,
        hwndTarget: win.hwnd,
      };
      SendMessage(win.hwnd, WM_DROPFILES, hDrop as any, 0);
    }
  }
</script>

<svelte:window onkeydown={onWindowKeyDown} onkeyup={onWindowKeyUp} />

{#if win.visible && !win.minimized}
  <div
    class="window win32-window {isActive ? 'active' : 'inactive'} {win.maximized ? 'maximized' : ''} {isMdiChild ? 'is-mdi-child' : ''} {isDragOver ? 'drop-target-active' : ''}"
    style={win.maximized
      ? (isMdiChild
          ? `left: 0; top: 0; width: 100%; height: 100%; z-index: ${win.zIndex};`
          : `left: 0; top: 0; width: 100vw; height: calc(100vh - 30px); z-index: ${win.zIndex};`)
      : `left: ${win.x}px; top: ${win.y}px; width: ${win.width}px; height: ${win.height}px; z-index: ${win.zIndex};`}
    style:pointer-events={win.enabled ? "auto" : "none"}
    onpointerdown={onFocusWindow}
    ondragover={onDragOver}
    ondragleave={onDragLeave}
    ondrop={onDrop}
    role="dialog"
    tabindex="-1"
  >
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="title-bar {isActive ? '' : 'inactive'}"
      onpointerdown={onTitleBarPointerDown}
      onpointermove={onTitleBarPointerMove}
      onpointerup={onTitleBarPointerUp}
      ondblclick={onMaximizeClick}
    >
      <div class="title-bar-text">
        {win.title || "Window"}
      </div>
      <div class="title-bar-controls">
        {#if win.style & WS_MINIMIZEBOX}
          <button aria-label="Minimize" onclick={onMinimizeClick}></button>
        {/if}
        {#if win.style & WS_MAXIMIZEBOX}
          <button
            aria-label={win.maximized ? "Restore" : "Maximize"}
            onclick={onMaximizeClick}
          ></button>
        {/if}
        <button aria-label="Close" onclick={onCloseClick}></button>
      </div>
    </div>

    {#if win.hMenu}
      <MenuBar hwnd={win.hwnd} hMenu={win.hMenu} />
    {/if}

    <div
      class="window-body client-area"
      style={children.some((c) => c.className.toUpperCase() === "MDICLIENT")
        ? "margin: 0; padding: 0; display: flex; flex-direction: column; overflow: hidden;"
        : ""}
    >
      {#if win.customProps?.hasCanvas}
        <canvas
          bind:this={canvasRef}
          class="win32-client-canvas"
          style={win.customProps?.canvasStyle ?? ""}
          width={win.customProps?.canvasWidth ?? clientCanvasWidth}
          height={win.customProps?.canvasHeight ?? clientCanvasHeight}
          onpointerdown={onCanvasPointerDown}
          onpointermove={onCanvasPointerMove}
          onpointerup={onCanvasPointerUp}
        ></canvas>
      {/if}
      {#each children as child (child.hwnd)}
        {#if child.className.toUpperCase() === "MDICLIENT"}
          <div
            class="win32-control win32-mdiclient-viewport sunken-panel"
            style="width: 100%; height: 100%; position: relative; overflow: hidden; background: #808080; flex: 1;"
          >
            {#each kernel.windows.filter((w) => w.parentHwnd === child.hwnd) as mdiChild (mdiChild.hwnd)}
              <Self window={mdiChild} isMdiChild={true} />
            {/each}
          </div>
        {:else}
          <Control window={child} />
        {/if}
      {/each}
    </div>

    {#if !win.maximized && (win.style & WS_THICKFRAME)}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="resize-handle"
        onpointerdown={onResizePointerDown}
        onpointermove={onResizePointerMove}
        onpointerup={onResizePointerUp}
      ></div>
    {/if}
  </div>
{/if}

<style>
  .win32-window {
    position: absolute;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    user-select: none;
    padding: 3px;
    background: silver;
    box-shadow:
      inset -1px -1px #0a0a0a,
      inset 1px 1px #dfdfdf,
      inset -2px -2px grey,
      inset 2px 2px #fff,
      2px 2px 6px rgba(0, 0, 0, 0.4);
  }

  .win32-window.maximized {
    box-shadow:
      inset -1px -1px #0a0a0a,
      inset 1px 1px #dfdfdf,
      inset -2px -2px grey,
      inset 2px 2px #fff;
  }

  .win32-window.is-mdi-child {
    box-shadow:
      inset -1px -1px #0a0a0a,
      inset 1px 1px #dfdfdf,
      inset -2px -2px grey,
      inset 2px 2px #fff;
  }

  .title-bar {
    cursor: default;
    user-select: none;
  }

  .client-area {
    position: relative;
    flex: 1;
    overflow: hidden;
    margin: 4px;
    background: #c0c0c0;
  }

  .win32-client-canvas {
    position: absolute;
    top: 0;
    left: 0;
    display: block;
    width: 100%;
    height: 100%;
    background: #ffffff;
    cursor: crosshair;
  }

  .inactive .title-bar,
  .title-bar.inactive {
    background: linear-gradient(90deg, grey, #b5b5b5) !important;
  }

  .inactive .title-bar .title-bar-text,
  .title-bar.inactive .title-bar-text {
    color: #c0c0c0 !important;
  }

  .resize-handle {
    position: absolute;
    right: 0;
    bottom: 0;
    width: 14px;
    height: 14px;
    cursor: se-resize;
    z-index: 99;
  }

  .drop-target-active {
    box-shadow: 0 0 0 2px #000080, 2px 2px 8px rgba(0, 0, 128, 0.5) !important;
  }
</style>
