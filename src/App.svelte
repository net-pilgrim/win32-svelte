<script lang="ts">
  import { onMount } from "svelte";
  import Desktop from "./win32/ui/Desktop.svelte";
  import { StartCalculator } from "./samples/calculator";
  import { StartNotepad } from "./samples/notepad";
  import { StartCounter } from "./samples/counter";
  import { StartMinesweeper } from "./samples/minesweeper";
  import { StartControlGallery } from "./samples/control_gallery";
  import { StartPaintDemo } from "./samples/paint_demo";
  import { kernel, audio } from "./win32/kernel.svelte";

  let showInspector = $state(false);
  let soundEnabled = $state(true);

  function toggleSound() {
    soundEnabled = !soundEnabled;
    audio.enabled = soundEnabled;
  }

  onMount(() => {
    // Launch default windows on startup
    StartMinesweeper(110, 40);
    StartPaintDemo(350, 40);
  });
</script>

<main class="main-root">
  <Desktop />

  <!-- Top-right Debug / Launcher HUD -->
  <div class="hud-panel">
    <button onclick={() => StartPaintDemo(Math.floor(Math.random() * 200 + 40), Math.floor(Math.random() * 200 + 40))}>
      + GDI Paint
    </button>
    <button onclick={() => StartControlGallery(Math.floor(Math.random() * 200 + 40), Math.floor(Math.random() * 200 + 40))}>
      + Controls
    </button>
    <button onclick={() => StartMinesweeper(Math.floor(Math.random() * 200 + 40), Math.floor(Math.random() * 200 + 40))}>
      + Minesweeper
    </button>
    <button onclick={() => StartCalculator(Math.floor(Math.random() * 200 + 40), Math.floor(Math.random() * 200 + 40))}>
      + Calculator
    </button>
    <button onclick={() => StartNotepad(Math.floor(Math.random() * 200 + 60), Math.floor(Math.random() * 200 + 60))}>
      + Notepad
    </button>
    <button onclick={toggleSound}>
      {soundEnabled ? "🔊 Sound: ON" : "🔇 Sound: OFF"}
    </button>
    <button onclick={() => showInspector = !showInspector}>
      {showInspector ? "Hide HWND Tree" : "Inspect HWNDs"}
    </button>
  </div>

  {#if showInspector}
    <div class="inspector-window window">
      <div class="title-bar">
        <div class="title-bar-text">Kernel HWND Table ({kernel.windows.length} handles)</div>
        <div class="title-bar-controls">
          <button aria-label="Close" onclick={() => showInspector = false}></button>
        </div>
      </div>
      <div class="window-body inspector-body">
        <table class="hwnd-table">
          <thead>
            <tr>
              <th>HWND</th>
              <th>Parent</th>
              <th>Class</th>
              <th>Title/Text</th>
              <th>Visible</th>
            </tr>
          </thead>
          <tbody>
            {#each kernel.windows as win}
              <tr class={kernel.activeHwnd === win.hwnd ? "active-row" : ""}>
                <td>{win.hwnd}</td>
                <td>{win.parentHwnd ?? "ROOT"}</td>
                <td>{win.className}</td>
                <td class="cell-text">{win.title || win.controlState?.value || ""}</td>
                <td>{win.visible ? "✓" : "✗"}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}
</main>

<style>
  .main-root {
    position: relative;
    width: 100vw;
    height: 100vh;
    overflow: hidden;
  }

  .hud-panel {
    position: absolute;
    top: 8px;
    right: 8px;
    display: flex;
    gap: 6px;
    z-index: 100000;
  }

  .hud-panel button {
    font-size: 11px;
    height: 24px;
    padding: 0 8px;
  }

  .inspector-window {
    position: absolute;
    top: 40px;
    right: 8px;
    width: 380px;
    max-height: 400px;
    z-index: 100000;
    box-shadow: 2px 2px 8px rgba(0, 0, 0, 0.4);
    display: flex;
    flex-direction: column;
  }

  .inspector-body {
    flex: 1;
    overflow-y: auto;
    background: #fff;
    padding: 4px;
  }

  .hwnd-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
    font-family: monospace;
  }

  .hwnd-table th,
  .hwnd-table td {
    border: 1px solid #ccc;
    padding: 2px 4px;
    text-align: left;
  }

  .hwnd-table th {
    background: #eee;
  }

  .active-row {
    background: #ffffcc;
    font-weight: bold;
  }

  .cell-text {
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
