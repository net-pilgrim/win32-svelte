<script lang="ts">
  import { onMount } from "svelte";
  import Desktop from "./win32/ui/Desktop.svelte";
  import { StartCalculator } from "./samples/calculator";
  import { StartNotepad } from "./samples/notepad";
  import { StartCounter } from "./samples/counter";
  import { StartMinesweeper } from "./samples/minesweeper";
  import { StartControlGallery } from "./samples/control_gallery";
  import { StartPaintDemo } from "./samples/paint_demo";
  import { StartExplorer } from "./samples/explorer";
  import { StartMfcDemo } from "./samples/mfc_demo";
  import { StartRcDemo } from "./samples/rc_demo.ts";
  import { StartOdbcAdmin } from "./samples/odbc_admin";
  import { StartISQL } from "./samples/isql";
  import { StartWasmApp } from "./samples/wasm_app";
  import { kernel, audio } from "./win32/kernel.svelte";

  import { StartHwndInspector } from "./samples/hwnd_inspector";

  let soundEnabled = $state(true);

  function toggleSound() {
    soundEnabled = !soundEnabled;
    audio.enabled = soundEnabled;
  }

  onMount(() => {
    // Launch default windows on startup
    StartMinesweeper(110, 40);
    StartPaintDemo(350, 40);
    StartWasmApp(260, 90);
  });
</script>

<main class="main-root">
  <Desktop />

  <!-- Top-right Debug / Launcher HUD -->
  <div class="hud-panel">
    <button onclick={() => StartPaintDemo(Math.floor(Math.random() * 200 + 40), Math.floor(Math.random() * 200 + 40))}>
      + GDI Paint
    </button>
    <button onclick={() => StartExplorer(Math.floor(Math.random() * 200 + 40), Math.floor(Math.random() * 200 + 40))}>
      + Explorer
    </button>
    <button onclick={() => StartMfcDemo(Math.floor(Math.random() * 200 + 50), Math.floor(Math.random() * 200 + 50))}>
      + MFC App
    </button>
    <button onclick={() => StartRcDemo(Math.floor(Math.random() * 200 + 40), Math.floor(Math.random() * 200 + 40))}>
      + RC Demo
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
    <button onclick={() => StartOdbcAdmin(Math.floor(Math.random() * 150 + 100), Math.floor(Math.random() * 150 + 60))}>
      + ODBC Admin
    </button>
    <button onclick={() => StartISQL(Math.floor(Math.random() * 150 + 120), Math.floor(Math.random() * 150 + 80))}>
      + ISQL Query
    </button>
    <button onclick={() => StartWasmApp(Math.floor(Math.random() * 150 + 80), Math.floor(Math.random() * 150 + 60))}>
      + WASM App
    </button>
    <button onclick={() => StartNotepad(360, 80, "C:\\wasm_application\\sample_app.c")}>
      + sample_app.c
    </button>
    <button onclick={() => StartNotepad(420, 110, "C:\\wasm_application\\windows.h")}>
      + windows.h
    </button>

    <button onclick={toggleSound}>
      {soundEnabled ? "🔊 Sound: ON" : "🔇 Sound: OFF"}
    </button>
    <button onclick={() => StartHwndInspector()}>
      + HWND Tree
    </button>
  </div>
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

</style>
