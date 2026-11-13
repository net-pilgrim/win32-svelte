<script lang="ts">
  import { onMount } from "svelte";
  import { MessageBox } from "../kernel.svelte";
  import { MB_OK } from "../constants";
  import { audio } from "../audio";
  import menuData from "../../../startmenu.json";

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

  interface MenuItem {
    id?: string;
    label?: string;
    mnemonic?: string;
    icon?: string;
    type?: string;
    action?: string;
    params?: Record<string, any>;
    args?: any[];
    items?: MenuItem[];
  }

  interface Props {
    isOpen: boolean;
    onClose: () => void;
    soundEnabled: boolean;
    onToggleSound: () => void;
  }

  let { isOpen, onClose, soundEnabled, onToggleSound }: Props = $props();

  let activeSubmenu = $state<string | null>(null);
  let menuContainerEl = $state<HTMLElement | null>(null);

  const menuItems: MenuItem[] = menuData as MenuItem[];

  function executeAction(fn: () => void) {
    audio.playClick();
    onClose();
    activeSubmenu = null;
    fn();
  }

  function handleSubmenuHover(name?: string) {
    activeSubmenu = name ?? null;
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

  const actionHandlers: Record<string, (params: Record<string, any>) => any> = {
    explorer: (p) => StartExplorer(p.x, p.y),
    wasm: (p) => StartWasmApp(p.x, p.y, p.path),
    lua: (p) => {
      import("../../samples/lua_host").then(({ StartLuaHost }) => StartLuaHost(p.x, p.y, p.path));
    },
    doom: (p) => {
      import("../../samples/doom").then(({ StartDoom }) => StartDoom(p.x, p.y));
    },
    minesweeper: (p) => StartMinesweeper(p.x, p.y),
    paint: (p) => StartPaintDemo(p.x, p.y),
    notepad: (p) => StartNotepad(p.x, p.y, p.path),
    calculator: (p) => StartCalculator(p.x, p.y),
    mfc: (p) => StartMfcDemo(p.x, p.y),
    rc: (p) => StartRcDemo(p.x, p.y),
    odbc: (p) => StartOdbcAdmin(p.x, p.y),
    isql: (p) => StartISQL(p.x, p.y),
    control_gallery: (p) => StartControlGallery(p.x, p.y),
    inspector: () => StartHwndInspector(),
    toggle_sound: () => onToggleSound(),
    shutdown: () => handleShutDown(),
  };

  function handleItemClick(item: MenuItem) {
    if (!item.action) return;
    executeAction(() => {
      const handler = actionHandlers[item.action!];
      if (handler) {
        handler(item.params ?? {});
      } else {
        console.warn(`Unknown start menu action: ${item.action}`);
      }
    });
  }

  function formatMnemonic(label?: string, mnemonic?: string): string {
    if (!label) return "";
    if (!mnemonic) return label;
    const idx = label.toLowerCase().indexOf(mnemonic.toLowerCase());
    if (idx === -1) return label;
    return `${label.slice(0, idx)}<u>${label[idx]}</u>${label.slice(idx + 1)}`;
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
      {#each menuItems as item}
        {#if item.type === "divider"}
          <div class="start-divider"></div>
        {:else if item.items && item.items.length > 0}
          <!-- Parent item with flyout submenu -->
          <div
            class="start-parent-item {activeSubmenu === item.id ? 'active' : ''}"
            onmouseenter={() => handleSubmenuHover(item.id)}
            role="menuitem"
            tabindex="-1"
          >
            <span class="item-icon">{item.icon}</span>
            <span class="item-label">{@html formatMnemonic(item.label, item.mnemonic)}</span>
            <span class="item-arrow">▶</span>

            {#if activeSubmenu === item.id}
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div class="start-submenu" role="menu" tabindex="-1" onmouseleave={handleSubmenuLeave}>
                {#each item.items as subItem}
                  {#if subItem.type === "divider"}
                    <div class="start-divider"></div>
                  {:else}
                    <button
                      type="button"
                      class="submenu-item"
                      onclick={() => handleItemClick(subItem)}
                    >
                      <span class="item-icon">
                        {subItem.id === "audio_toggle" ? (soundEnabled ? "🔊" : "🔇") : subItem.icon}
                      </span>
                      <span class="item-label">
                        {subItem.id === "audio_toggle" ? `Audio: ${soundEnabled ? "Enabled" : "Muted"}` : subItem.label}
                      </span>
                    </button>
                  {/if}
                {/each}
              </div>
            {/if}
          </div>
        {:else}
          <!-- Direct action button -->
          <button
            type="button"
            class="start-item"
            onclick={() => handleItemClick(item)}
          >
            <span class="item-icon">{item.icon}</span>
            <span class="item-label">{@html formatMnemonic(item.label, item.mnemonic)}</span>
          </button>
        {/if}
      {/each}
    </div>
  </div>
{/if}

<style>
  .start-menu-container {
    position: absolute;
    bottom: 30px;
    left: 2px;
    display: flex;
    z-index: 99999;
    box-sizing: border-box;
    min-width: 200px;
    background: #c0c0c0;
    border-top: 2px solid #ffffff;
    border-left: 2px solid #ffffff;
    border-right: 2px solid #000000;
    border-bottom: 2px solid #000000;
    box-shadow: 2px 2px 8px rgba(0, 0, 0, 0.4);
    user-select: none;
    font-family: "Pixelated MS Sans Serif", Arial, sans-serif;
  }

  /* Authentic Windows 98 Vertical Gradient Banner */
  .start-sidebar {
    width: 26px;
    background: linear-gradient(180deg, #000080 0%, #1084d0 100%);
    display: flex;
    align-items: flex-end;
    padding-bottom: 8px;
    justify-content: center;
  }

  .sidebar-text {
    transform: rotate(-90deg);
    transform-origin: center center;
    white-space: nowrap;
    color: #ffffff;
    font-size: 15px;
    letter-spacing: 1px;
    font-weight: 500;
    margin-bottom: 24px;
    text-shadow: 1px 1px 1px #000000;
  }

  .sidebar-text strong {
    font-weight: bold;
    color: #ffffff;
  }

  .start-items {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 2px;
    background: #c0c0c0;
    position: relative;
  }

  .start-item,
  .start-parent-item,
  .submenu-item {
    display: flex;
    align-items: center;
    width: 100%;
    padding: 4px 10px;
    border: none;
    background: transparent;
    text-align: left;
    font-family: inherit;
    font-size: 12px;
    cursor: default;
    color: #000000;
    box-sizing: border-box;
  }

  .start-parent-item {
    position: relative;
    cursor: default;
  }

  .start-item:hover,
  .start-parent-item:hover,
  .start-parent-item.active,
  .submenu-item:hover {
    background: #000080;
    color: #ffffff;
  }

  .item-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    font-size: 14px;
    margin-right: 8px;
  }

  .item-label {
    flex: 1;
    white-space: nowrap;
  }

  .item-arrow {
    font-size: 9px;
    margin-left: 12px;
    color: #404040;
  }

  .start-parent-item:hover .item-arrow,
  .start-parent-item.active .item-arrow {
    color: #ffffff;
  }

  .start-divider {
    height: 0;
    border-top: 1px solid #808080;
    border-bottom: 1px solid #ffffff;
    margin: 3px 2px;
  }

  /* Flyout Submenu */
  .start-submenu {
    position: absolute;
    left: 100%;
    top: -2px;
    display: flex;
    flex-direction: column;
    min-width: 180px;
    background: #c0c0c0;
    border-top: 2px solid #ffffff;
    border-left: 2px solid #ffffff;
    border-right: 2px solid #000000;
    border-bottom: 2px solid #000000;
    box-shadow: 2px 2px 8px rgba(0, 0, 0, 0.4);
    padding: 2px;
    z-index: 100000;
  }
</style>
