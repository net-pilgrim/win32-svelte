<script lang="ts">
  import { onMount } from "svelte";
  import Desktop from "./win32/ui/Desktop.svelte";
  import { StartMinesweeper } from "./samples/minesweeper";
  import { StartPaintDemo } from "./samples/paint_demo";
  import { StartWasmApp } from "./samples/wasm_app";

  onMount(() => {
    // Launch default windows on startup
    StartMinesweeper(110, 40);
    StartPaintDemo(350, 40);
    StartWasmApp(260, 90);
  });
</script>

<main class="main-root">
  <Desktop />
</main>

<style>
  .main-root {
    position: relative;
    width: 100vw;
    height: 100vh;
    overflow: hidden;
  }
</style>
