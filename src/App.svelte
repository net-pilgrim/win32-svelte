<script lang="ts">
  import { onMount } from "svelte";
  import Desktop from "./win32/ui/Desktop.svelte";
  import { kernel, vfs } from "./win32/kernel.svelte";
  import { Win32WasmRuntime } from "./win32/wasm_bridge";
  import { StartWasmApp } from "./samples/wasm_app";
  import { StartExplorer } from "./samples/explorer";
  import { StartMetafileViewer } from "./samples/metafile_viewer";
  import { launchStartupApps } from "./win32/startup";

  onMount(() => {
    if (typeof window !== "undefined") {
      (window as any).__WIN32__ = {
        kernel,
        vfs,
        Win32WasmRuntime,
        StartWasmApp,
        StartExplorer,
        StartMetafileViewer,
      };
    }

    // Launch applications configured in startmenu.json and Windows Registry Run keys
    launchStartupApps();
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
