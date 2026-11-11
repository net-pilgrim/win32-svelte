<script lang="ts">
  import { audio } from "../audio";

  interface Props {
    id: string;
    title: string;
    icon: string;
    x: number;
    y: number;
    isSelected: boolean;
    onSelect: () => void;
    onMove: (x: number, y: number) => void;
    onLaunch: () => void;
    onDropFiles?: (data: any) => void;
  }

  let {
    id,
    title,
    icon,
    x,
    y,
    isSelected,
    onSelect,
    onMove,
    onLaunch,
    onDropFiles,
  }: Props = $props();

  let isDragging = $state(false);
  let isDragOver = $state(false);
  let dragOffset = { x: 0, y: 0 };
  let hasMoved = false;

  function onPointerDown(e: PointerEvent) {
    e.stopPropagation();
    onSelect();
    isDragging = true;
    hasMoved = false;
    dragOffset = {
      x: e.clientX - x,
      y: e.clientY - y,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: PointerEvent) {
    if (!isDragging) return;
    hasMoved = true;
    const newX = Math.max(0, e.clientX - dragOffset.x);
    const newY = Math.max(0, e.clientY - dragOffset.y);
    onMove(newX, newY);
  }

  function onPointerUp(e: PointerEvent) {
    if (isDragging) {
      isDragging = false;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
    }
  }

  function onDblClick(e: MouseEvent) {
    e.stopPropagation();
    audio.playClick();
    onLaunch();
  }

  function onDragOver(e: DragEvent) {
    if (!onDropFiles) return;
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "copy";
    }
    isDragOver = true;
  }

  function onDragLeave(e: DragEvent) {
    if (!onDropFiles) return;
    isDragOver = false;
  }

  function onDrop(e: DragEvent) {
    if (!onDropFiles) return;
    e.preventDefault();
    isDragOver = false;

    const win32Data = e.dataTransfer?.getData("application/win32-file");
    if (win32Data) {
      try {
        const parsed = JSON.parse(win32Data);
        onDropFiles(parsed);
        return;
      } catch {}
    }

    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      onDropFiles({ name: e.dataTransfer.files[0].name });
    }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="desktop-icon {isSelected ? 'selected' : ''} {isDragOver ? 'drag-over' : ''}"
  style="left: {x}px; top: {y}px;"
  onpointerdown={onPointerDown}
  onpointermove={onPointerMove}
  onpointerup={onPointerUp}
  ondblclick={onDblClick}
  ondragover={onDragOver}
  ondragleave={onDragLeave}
  ondrop={onDrop}
>
  <div class="icon-graphic">{icon}</div>
  <div class="icon-label">{title}</div>
</div>

<style>
  .desktop-icon {
    position: absolute;
    width: 76px;
    display: flex;
    flex-direction: column;
    align-items: center;
    cursor: default;
    user-select: none;
    padding: 4px;
    box-sizing: border-box;
    z-index: 5;
  }

  .icon-graphic {
    font-size: 32px;
    line-height: 1;
    filter: drop-shadow(1px 1px 1px rgba(0, 0, 0, 0.5));
  }

  .icon-label {
    margin-top: 4px;
    font-size: 11px;
    color: #ffffff;
    text-shadow: 1px 1px 1px #000000;
    text-align: center;
    word-break: break-word;
    padding: 1px 4px;
    border-radius: 1px;
    line-height: 1.2;
  }

  .desktop-icon.selected .icon-graphic {
    filter: drop-shadow(1px 1px 1px #000080);
    opacity: 0.85;
  }

  .desktop-icon.selected .icon-label {
    background: #000080;
    color: #ffffff;
    outline: 1px dotted #ffff80;
    text-shadow: none;
  }

  .desktop-icon.drag-over {
    background: rgba(0, 0, 128, 0.4);
    outline: 2px dashed #ffff00;
  }
</style>
