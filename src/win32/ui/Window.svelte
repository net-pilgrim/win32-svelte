<script lang="ts">
  import {
    kernel,
    SendMessage,
    MoveWindow,
  } from "../kernel.svelte";
  import {
    WM_CLOSE,
    WM_PAINT,
    WM_LBUTTONDOWN,
    WM_LBUTTONUP,
    WM_MOUSEMOVE,
    WM_DROPFILES,
    WS_THICKFRAME,
    WS_MINIMIZEBOX,
    WS_MAXIMIZEBOX,
    WS_EX_ACCEPTFILES,
    MAKELPARAM,
  } from "../constants";
  import type { WindowRecord, HDROP, DropFileInfo } from "../types";
  import Control from "./Control.svelte";
  import MenuBar from "./MenuBar.svelte";
  import { RegisterWindowCanvas, UnregisterWindowCanvas } from "../gdi";

  interface Props {
    window: WindowRecord;
  }

  let { window: win }: Props = $props();

  let canvasRef = $state<HTMLCanvasElement | null>(null);

  let clientCanvasWidth = $derived(Math.max(10, (win.maximized ? window.innerWidth : win.width) - 16));
  let clientCanvasHeight = $derived(
    Math.max(10, (win.maximized ? window.innerHeight - 30 : win.height) - (win.hMenu ? 64 : 44))
  );

  $effect(() => {
    if (canvasRef && win.customProps?.hasCanvas) {
      RegisterWindowCanvas(win.hwnd, canvasRef);
      SendMessage(win.hwnd, WM_PAINT, 0, 0);
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

  let isActive = $derived(kernel.activeHwnd === win.hwnd);
  let children = $derived(kernel.windows.filter((w) => w.parentHwnd === win.hwnd));

  // Dragging state
  let isDragging = $state(false);
  let dragOffset = { x: 0, y: 0 };

  // Resizing state
  let isResizing = $state(false);
  let resizeStart = { x: 0, y: 0, width: 0, height: 0 };

  function onFocusWindow() {
    kernel.BringToFront(win.hwnd);
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
    if (!acceptsDrops) return;
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
    if (!acceptsDrops) return;
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
        let content = "";
        try {
          content = await file.text();
        } catch {
          content = `[Binary file: ${file.name}, size: ${file.size} bytes]`;
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

{#if win.visible && !win.minimized}
  <div
    class="window win32-window {isActive ? 'active' : 'inactive'} {isDragOver ? 'drop-target-active' : ''}"
    style={win.maximized
      ? "left: 0; top: 0; width: 100vw; height: calc(100vh - 30px); z-index: " + win.zIndex
      : `left: ${win.x}px; top: ${win.y}px; width: ${win.width}px; height: ${win.height}px; z-index: ${win.zIndex}`}
    onpointerdown={onFocusWindow}
    ondragover={onDragOver}
    ondragleave={onDragLeave}
    ondrop={onDrop}
    role="dialog"
    tabindex="-1"
  >
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="title-bar"
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

    <div class="window-body client-area">
      {#if win.customProps?.hasCanvas}
        <canvas
          bind:this={canvasRef}
          class="win32-client-canvas"
          width={clientCanvasWidth}
          height={clientCanvasHeight}
          onpointerdown={onCanvasPointerDown}
          onpointermove={onCanvasPointerMove}
          onpointerup={onCanvasPointerUp}
        ></canvas>
      {/if}
      {#each children as child (child.hwnd)}
        <Control window={child} />
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
    box-shadow: 2px 2px 6px rgba(0, 0, 0, 0.4);
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
    display: block;
    width: 100%;
    height: 100%;
    background: #ffffff;
    cursor: crosshair;
  }

  .inactive .title-bar {
    background: #808080 !important;
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
