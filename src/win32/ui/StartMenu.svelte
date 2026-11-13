<script lang="ts">
  import { onMount } from "svelte";
  import { MessageBox } from "../kernel.svelte";
  import { MB_OK } from "../constants";
  import { audio } from "../audio";
  import { StartMinesweeper } from "../../samples/minesweeper";
  import { StartCalculator } from "../../samples/calculator";
  import { StartNotepad } from "../../samples/notepad";
  import { StartControlGallery } from "../../samples/control_gallery";
  import { StartPaintDemo } from "../../samples/paint_demo";
  import { StartExplorer } from "../../samples/explorer";
  import { StartMfcDemo } from "../../samples/mfc_demo";
  import { StartRcDemo } from "../../samples/rc_demo.ts";
  import { StartWasmApp } from "../../samples/wasm_app";
  import { StartOdbcAdmin } from "../../samples/odbc_admin";
  import { StartISQL } from "../../samples/isql";
  import { StartHwndInspector } from "../../samples/hwnd_inspector";

  interface Props {
    isOpen: boolean;
    onClose: () => void;
    soundEnabled: boolean;
    onToggleSound: () => void;
  }

  let { isOpen, onClose, soundEnabled, onToggleSound }: Props = $props();

  let activeSubmenu = $state<string | null>(null);
  let menuContainerEl = $state<HTMLElement | null>(null);

  function executeAction(fn: () => void) {
    audio.playClick();
    onClose();
    activeSubmenu = null;
    fn();
  }

  function handleSubmenuHover(name: string) {
    activeSubmenu = name;
  }

  function handleSubmenuLeave() {
    activeSubmenu = null;
  }

  function handleShutDown() {
    executeAction(() => {
      audio.playTada();
      MessageBox(
        null,
        "It is now safe to turn off your computer.\n\nThank you for using win32-svelte!",
        "Shut Down Windows",
        MB_OK
      );
    });
  }

  onMount(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
        activeSubmenu = null;
      }
    };

    const handlePointerDown = (e: PointerEvent) => {
      if (isOpen && menuContainerEl && !menuContainerEl.contains(e.target as Node)) {
        // Check if click was on the start button itself (handled by parent)
        const target = e.target as HTMLElement;
        if (target.closest(".start-button")) return;
        onClose();
        activeSubmenu = null;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("pointerdown", handlePointerDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  });
</script>

{#if isOpen}
  <div class="start-menu-container" bind:this={menuContainerEl}>
    <!-- Windows 98 Sidebar Banner -->
    <div class="start-sidebar">
      <span class="sidebar-text">Win32 <strong>Svelte 98</strong></span>
    </div>

    <!-- Main Menu Column -->
    <div class="start-items">
      <!-- Programs Item with Flyout Submenu -->
      <div
        class="start-parent-item {activeSubmenu === 'programs' ? 'active' : ''}"
        onmouseenter={() => handleSubmenuHover("programs")}
        role="menuitem"
        tabindex="-1"
      >
        <span class="item-icon">📁</span>
        <span class="item-label"><u>P</u>rograms</span>
        <span class="item-arrow">▶</span>

        {#if activeSubmenu === "programs"}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div class="start-submenu" role="menu" tabindex="-1" onmouseleave={handleSubmenuLeave}>
            <button type="button" class="submenu-item" onclick={() => executeAction(() => StartExplorer(160, 70))}>
              <span class="item-icon">🗂️</span>
              <span class="item-label">Windows Explorer</span>
            </button>
            <button type="button" class="submenu-item" onclick={() => executeAction(() => StartWasmApp(260, 110))}>
              <span class="item-icon">⚡</span>
              <span class="item-label">WASM C Application</span>
            </button>
            <button type="button" class="submenu-item" onclick={() => executeAction(() => StartMinesweeper(120, 80))}>
              <span class="item-icon">💣</span>
              <span class="item-label">Minesweeper</span>
            </button>
            <button type="button" class="submenu-item" onclick={() => executeAction(() => StartPaintDemo(240, 100))}>
              <span class="item-icon">🎨</span>
              <span class="item-label">GDI Paint</span>
            </button>
            <button type="button" class="submenu-item" onclick={() => executeAction(() => StartNotepad(320, 70))}>
              <span class="item-icon">📝</span>
              <span class="item-label">Notepad</span>
            </button>
            <button type="button" class="submenu-item" onclick={() => executeAction(() => StartCalculator(380, 90))}>
              <span class="item-icon">🔢</span>
              <span class="item-label">Calculator</span>
            </button>
            <button type="button" class="submenu-item" onclick={() => executeAction(() => StartMfcDemo(220, 80))}>
              <span class="item-icon">📐</span>
              <span class="item-label">MFC Scribble</span>
            </button>
            <button type="button" class="submenu-item" onclick={() => executeAction(() => StartRcDemo(240, 90))}>
              <span class="item-icon">📦</span>
              <span class="item-label">RC Compiler Demo</span>
            </button>
            <button type="button" class="submenu-item" onclick={() => executeAction(() => StartOdbcAdmin(180, 80))}>
              <span class="item-icon">🗄️</span>
              <span class="item-label">ODBC Administrator</span>
            </button>
            <button type="button" class="submenu-item" onclick={() => executeAction(() => StartISQL(200, 90))}>
              <span class="item-icon">🔍</span>
              <span class="item-label">ISQL Query Tool</span>
            </button>
            <button type="button" class="submenu-item" onclick={() => executeAction(() => StartControlGallery(180, 50))}>
              <span class="item-icon">🎛️</span>
              <span class="item-label">Control Gallery</span>
            </button>
          </div>
        {/if}
      </div>

      <!-- Documents Item with Flyout Submenu -->
      <div
        class="start-parent-item {activeSubmenu === 'documents' ? 'active' : ''}"
        onmouseenter={() => handleSubmenuHover("documents")}
        role="menuitem"
        tabindex="-1"
      >
        <span class="item-icon">📄</span>
        <span class="item-label"><u>D</u>ocuments</span>
        <span class="item-arrow">▶</span>

        {#if activeSubmenu === "documents"}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div class="start-submenu" role="menu" tabindex="-1" onmouseleave={handleSubmenuLeave}>
            <button
              type="button"
              class="submenu-item"
              onclick={() => executeAction(() => StartNotepad(360, 80, "C:\\wasm_application\\sample_app.c"))}
            >
              <span class="item-icon">📄</span>
              <span class="item-label">sample_app.c</span>
            </button>
            <button
              type="button"
              class="submenu-item"
              onclick={() => executeAction(() => StartNotepad(420, 110, "C:\\wasm_application\\windows.h"))}
            >
              <span class="item-icon">📋</span>
              <span class="item-label">windows.h</span>
            </button>
            <button
              type="button"
              class="submenu-item"
              onclick={() => executeAction(() => StartNotepad(300, 70, "C:\\My Documents\\Welcome.txt"))}
            >
              <span class="item-icon">📝</span>
              <span class="item-label">Welcome.txt</span>
            </button>
          </div>
        {/if}
      </div>

      <!-- Settings / Tools Submenu -->
      <div
        class="start-parent-item {activeSubmenu === 'settings' ? 'active' : ''}"
        onmouseenter={() => handleSubmenuHover("settings")}
        role="menuitem"
        tabindex="-1"
      >
        <span class="item-icon">⚙️</span>
        <span class="item-label"><u>S</u>ettings</span>
        <span class="item-arrow">▶</span>

        {#if activeSubmenu === "settings"}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div class="start-submenu" role="menu" tabindex="-1" onmouseleave={handleSubmenuLeave}>
            <button type="button" class="submenu-item" onclick={onToggleSound}>
              <span class="item-icon">{soundEnabled ? "🔊" : "🔇"}</span>
              <span class="item-label">Audio: {soundEnabled ? "Enabled" : "Muted"}</span>
            </button>
            <button type="button" class="submenu-item" onclick={() => executeAction(() => StartHwndInspector())}>
              <span class="item-icon">🪟</span>
              <span class="item-label">HWND Tree Inspector</span>
            </button>
            <button type="button" class="submenu-item" onclick={() => executeAction(() => StartControlGallery(180, 50))}>
              <span class="item-icon">💻</span>
              <span class="item-label">Control Panel</span>
            </button>
          </div>
        {/if}
      </div>

      <div class="start-divider"></div>

      <!-- Direct Quick Launchers -->
      <button type="button" class="start-item" onclick={() => executeAction(() => StartExplorer(160, 70))}>
        <span class="item-icon">🗂️</span>
        <span class="item-label">Windows <u>E</u>xplorer</span>
      </button>

      <button type="button" class="start-item" onclick={() => executeAction(() => StartWasmApp(260, 110))}>
        <span class="item-icon">⚡</span>
        <span class="item-label"><u>W</u>ASM C Application</span>
      </button>

      <button type="button" class="start-item" onclick={() => executeAction(() => StartHwndInspector())}>
        <span class="item-icon">🪟</span>
        <span class="item-label"><u>I</u>nspect HWNDs</span>
      </button>

      <div class="start-divider"></div>

      <!-- Shut Down Option -->
      <button type="button" class="start-item" onclick={handleShutDown}>
        <span class="item-icon">🔌</span>
        <span class="item-label"><u>S</u>hut Down...</span>
      </button>
    </div>
  </div>
{/if}

<style>
  .start-menu-container {
    position: absolute;
    bottom: 30px;
    left: 0;
    z-index: 100000;
    display: flex;
    background: #c0c0c0;
    box-shadow:
      inset -1px -1px #0a0a0a,
      inset 1px 1px #dfdfdf,
      inset -2px -2px grey,
      inset 2px 2px #fff,
      3px 3px 10px rgba(0, 0, 0, 0.4);
    padding: 2px;
    font-family: "MS Sans Serif", "Pixelated MS Sans Serif", Tahoma, Arial, sans-serif;
    user-select: none;
  }

  .start-sidebar {
    width: 25px;
    background: linear-gradient(180deg, #000080 0%, #1084d0 100%);
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding-bottom: 8px;
    margin-right: 2px;
  }

  .sidebar-text {
    color: #c0c0c0;
    font-weight: normal;
    font-size: 13px;
    letter-spacing: 1px;
    writing-mode: vertical-rl;
    transform: rotate(180deg);
    white-space: nowrap;
  }

  .sidebar-text strong {
    color: #ffffff;
    font-weight: bold;
  }

  .start-items {
    width: 175px;
    display: flex;
    flex-direction: column;
    padding: 1px 0;
  }

  .start-parent-item,
  .start-item {
    position: relative;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px 8px;
    font-size: 11px;
    color: #000;
    cursor: default;
    border: 1px solid transparent;
    background: transparent;
    box-shadow: none;
    font-family: inherit;
    width: 100%;
    text-align: left;
    border-radius: 0;
    min-height: unset;
    min-width: unset;
    margin: 0;
  }

  .start-parent-item:hover,
  .start-parent-item.active,
  .start-item:hover {
    background: #000080;
    color: #ffffff;
  }

  .item-icon {
    width: 18px;
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .item-label {
    flex: 1;
    white-space: nowrap;
  }

  .item-arrow {
    font-size: 9px;
    color: inherit;
    margin-left: auto;
  }

  .start-divider {
    height: 0px;
    border-top: 1px solid #808080;
    border-bottom: 1px solid #ffffff;
    margin: 3px 2px;
  }

  .start-submenu {
    position: absolute;
    left: 100%;
    top: -2px;
    min-width: 195px;
    background: #c0c0c0;
    box-shadow:
      inset -1px -1px #0a0a0a,
      inset 1px 1px #dfdfdf,
      inset -2px -2px grey,
      inset 2px 2px #fff,
      3px 3px 8px rgba(0, 0, 0, 0.4);
    padding: 2px;
    display: flex;
    flex-direction: column;
    z-index: 100001;
  }

  .submenu-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 8px;
    font-size: 11px;
    color: #000;
    cursor: default;
    border: 1px solid transparent;
    background: transparent;
    box-shadow: none;
    font-family: inherit;
    width: 100%;
    text-align: left;
    border-radius: 0;
    min-height: unset;
    min-width: unset;
    margin: 0;
  }

  .submenu-item:hover {
    background: #000080;
    color: #ffffff;
  }
</style>
