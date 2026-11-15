<script lang="ts">
  import { onMount } from "svelte";
  import { audio } from "../audio";
  import menuData from "../../../startmenu.json";
  import {
    type MenuItem,
    type StartMenuProps,
    formatMnemonic,
    createActionHandlers,
  } from "./start_menu_utils";

  let {
    isOpen,
    onClose,
    soundEnabled,
    onToggleSound,
    flat = true,
  }: StartMenuProps = $props();

  let activeSubmenu = $state<string | null>(null);
  let menuContainerEl = $state<HTMLElement | null>(null);

  const menuItems: MenuItem[] = menuData as MenuItem[];
  const actionHandlers = $derived(createActionHandlers(onToggleSound, onClose));

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

  function handleContainerKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      activeSubmenu = null;
      return;
    }

    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const currentTarget = document.activeElement as HTMLElement;
      const activeSubmenuEl = menuContainerEl?.querySelector<HTMLElement>(".start-submenu");
      const currentContainer =
        activeSubmenuEl && activeSubmenuEl.contains(currentTarget)
          ? activeSubmenuEl
          : menuContainerEl?.querySelector<HTMLElement>(".start-items");
      if (!currentContainer) return;

      const items = Array.from(
        currentContainer.querySelectorAll<HTMLElement>(
          ".start-item:not(:disabled), .start-parent-item:not(.disabled), .submenu-item:not(:disabled)"
        )
      ).filter((el) => {
        return (
          currentContainer.contains(el) &&
          (!el.closest(".start-submenu") || currentContainer.classList.contains("start-submenu"))
        );
      });

      if (items.length === 0) return;
      const idx = items.indexOf(currentTarget);
      if (idx === -1) {
        items[0]?.focus();
      } else {
        const nextIdx =
          e.key === "ArrowDown"
            ? (idx + 1) % items.length
            : (idx - 1 + items.length) % items.length;
        items[nextIdx]?.focus();
      }
    } else if (e.key === "ArrowRight") {
      const activeEl = document.activeElement as HTMLElement;
      if (activeEl?.classList.contains("start-parent-item")) {
        e.preventDefault();
        const parentId = activeEl.getAttribute("data-id");
        if (parentId) {
          activeSubmenu = parentId;
          setTimeout(() => {
            const firstSubItem = menuContainerEl?.querySelector<HTMLElement>(
              ".start-submenu .submenu-item:not(:disabled)"
            );
            firstSubItem?.focus();
          }, 20);
        }
      }
    } else if (e.key === "ArrowLeft") {
      const activeEl = document.activeElement as HTMLElement;
      if (activeEl?.classList.contains("submenu-item")) {
        e.preventDefault();
        const parentId = activeSubmenu;
        activeSubmenu = null;
        if (parentId) {
          const parentItem = menuContainerEl?.querySelector<HTMLElement>(
            `.start-parent-item[data-id="${parentId}"]`
          );
          parentItem?.focus();
        }
      }
    }
  }

  function handleParentKeyDown(e: KeyboardEvent, item: MenuItem) {
    if (e.key === "Enter" || e.key === " " || e.key === "ArrowRight") {
      e.preventDefault();
      activeSubmenu = item.id ?? null;
      setTimeout(() => {
        const firstSubItem = menuContainerEl?.querySelector<HTMLElement>(
          ".start-submenu .submenu-item:not(:disabled)"
        );
        firstSubItem?.focus();
      }, 20);
    }
  }

  onMount(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
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

    window.addEventListener("keydown", handleGlobalKeyDown);
    window.addEventListener("pointerdown", handlePointerDown);
    return () => {
      window.removeEventListener("keydown", handleGlobalKeyDown);
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  });
</script>

{#if isOpen}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="start-menu-container {flat ? 'flat' : 'beveled'}"
    bind:this={menuContainerEl}
    onkeydown={handleContainerKeyDown}
    role="menu"
    tabindex="-1"
  >
    <!-- Windows 98 Sidebar Banner -->
    <div class="start-sidebar">
      <span class="sidebar-text">Win32 <strong>Svelte 98</strong></span>
    </div>

    <!-- Main Menu Column -->
    <div class="start-items">
      {#each menuItems as item}
        {#if item.type === "divider"}
          <div class="start-divider" role="separator"></div>
        {:else if item.items && item.items.length > 0}
          <!-- Parent item with flyout submenu -->
          <!-- svelte-ignore a11y_role_has_required_aria_props -->
          <div
            class="start-parent-item {activeSubmenu === item.id ? 'active' : ''} {item.disabled ? 'disabled' : ''}"
            data-id={item.id}
            onmouseenter={() => !item.disabled && handleSubmenuHover(item.id)}
            onkeydown={(e) => !item.disabled && handleParentKeyDown(e, item)}
            role="menuitem"
            tabindex={item.disabled ? -1 : 0}
            aria-haspopup="true"
            aria-expanded={activeSubmenu === item.id}
          >
            <span class="item-icon">
              {item.icon || "📁"}
            </span>
            <span class="item-label">{@html formatMnemonic(item.label, item.mnemonic)}</span>
            <span class="item-arrow">▶</span>

            {#if activeSubmenu === item.id}
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div
                class="start-submenu {flat ? 'flat' : 'beveled'}"
                role="menu"
                tabindex="-1"
                onmouseleave={handleSubmenuLeave}
              >
                {#each item.items as subItem}
                  {#if subItem.type === "divider"}
                    <div class="start-divider" role="separator"></div>
                  {:else}
                    <button
                      type="button"
                      class="submenu-item {subItem.disabled ? 'disabled' : ''}"
                      disabled={subItem.disabled}
                      onclick={() => !subItem.disabled && handleItemClick(subItem)}
                    >
                      <span class="item-icon">
                        {subItem.id === "audio_toggle"
                          ? (soundEnabled ? "🔊" : "🔇")
                          : (subItem.icon || "📄")}
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
            class="start-item {item.disabled ? 'disabled' : ''}"
            disabled={item.disabled}
            onclick={() => !item.disabled && handleItemClick(item)}
          >
            <span class="item-icon">
              {item.icon || "📄"}
            </span>
            <span class="item-label">{@html formatMnemonic(item.label, item.mnemonic)}</span>
          </button>
        {/if}
      {/each}
    </div>
  </div>
{/if}

<style>
  .start-menu-container {
    --win98-menu-bg: #c0c0c0;
    --win98-menu-color: #000000;
    --win98-highlight: #000080;
    --win98-highlight-text: #ffffff;
    --win98-menu-disabled: #808080;
    --win98-focus-outline: #000000;
    --win98-font-family: "MS Sans Serif", Tahoma, "Segoe UI", Arial, sans-serif;

    position: absolute;
    bottom: 30px;
    left: 2px;
    display: flex;
    z-index: 99999;
    box-sizing: border-box;
    min-width: 200px;
    background: var(--win98-menu-bg, #c0c0c0);
    border-top: 2px solid #ffffff;
    border-left: 2px solid #ffffff;
    border-right: 2px solid #000000;
    border-bottom: 2px solid #000000;
    box-shadow: 2px 2px 8px rgba(0, 0, 0, 0.4);
    user-select: none;
    font-family: var(--win98-font-family);
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;
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
    font-family: var(--win98-font-family);
    -webkit-font-smoothing: antialiased;
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
    background: var(--win98-menu-bg, #c0c0c0);
    position: relative;
  }

  /* Reset button and item properties to remove 98.css button bevels */
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
    color: var(--win98-menu-color, #000000);
    box-sizing: border-box;
    border-radius: 0;
    margin: 0;
    min-width: unset;
    min-height: unset;
    text-shadow: none;
    outline: none;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  .start-parent-item {
    position: relative;
    cursor: default;
  }

  /* -------------------------------------------------------------
     FLAT MODE (Default): De-beveled, authentic Windows 98 flat menu items
     ------------------------------------------------------------- */
  .start-menu-container.flat .start-item,
  .start-menu-container.flat .start-parent-item,
  .start-menu-container.flat .submenu-item {
    box-shadow: none !important;
    border: none !important;
    background: transparent;
  }

  .start-menu-container.flat .start-item:not(:disabled):hover,
  .start-menu-container.flat .start-parent-item:hover,
  .start-menu-container.flat .start-parent-item.active,
  .start-menu-container.flat .submenu-item:not(:disabled):hover,
  .start-menu-container.flat .start-item:not(:disabled):focus-visible,
  .start-menu-container.flat .start-parent-item:focus-visible,
  .start-menu-container.flat .submenu-item:not(:disabled):focus-visible {
    background: var(--win98-highlight, #000080) !important;
    color: var(--win98-highlight-text, #ffffff) !important;
    box-shadow: none !important;
    text-shadow: none !important;
  }

  /* Prevent 98.css button:active 3D bevel depression when flat */
  .start-menu-container.flat .start-item:not(:disabled):active,
  .start-menu-container.flat .submenu-item:not(:disabled):active {
    box-shadow: none !important;
    text-shadow: none !important;
    background: var(--win98-highlight, #000080) !important;
    color: var(--win98-highlight-text, #ffffff) !important;
  }

  /* Keyboard focus outline for accessibility */
  .start-menu-container.flat .start-item:focus-visible,
  .start-menu-container.flat .start-parent-item:focus-visible,
  .start-menu-container.flat .submenu-item:focus-visible {
    outline: 1px dotted var(--win98-focus-outline, #000000);
    outline-offset: -2px;
  }

  .start-menu-container.flat .start-item:not(:disabled):focus-visible,
  .start-menu-container.flat .submenu-item:not(:disabled):focus-visible {
    outline-color: var(--win98-highlight-text, #ffffff);
  }

  /* -------------------------------------------------------------
     BEVELED MODE (Legacy opt-in): 3D button bevels
     ------------------------------------------------------------- */
  .start-menu-container.beveled .start-item,
  .start-menu-container.beveled .submenu-item {
    box-shadow:
      inset -1px -1px #0a0a0a,
      inset 1px 1px #fff,
      inset -2px -2px grey,
      inset 2px 2px #dfdfdf;
    margin: 1px 0;
  }

  .start-menu-container.beveled .start-item:active,
  .start-menu-container.beveled .submenu-item:active {
    box-shadow:
      inset -1px -1px #fff,
      inset 1px 1px #0a0a0a,
      inset -2px -2px #dfdfdf,
      inset 2px 2px grey;
  }

  .start-menu-container.beveled .start-parent-item:hover,
  .start-menu-container.beveled .start-parent-item.active {
    background: var(--win98-highlight, #000080);
    color: var(--win98-highlight-text, #ffffff);
  }

  /* -------------------------------------------------------------
     Disabled State: Subtle color-only suppression without bevels
     ------------------------------------------------------------- */
  .start-item:disabled,
  .submenu-item:disabled,
  .start-parent-item.disabled {
    color: var(--win98-menu-disabled, #808080) !important;
    cursor: default;
    box-shadow: none !important;
    background: transparent !important;
    text-shadow: 1px 1px 0 #ffffff !important;
  }

  .item-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 16px;
    font-size: 14px;
    margin-right: 8px;
    flex-shrink: 0;
    color: initial !important;
    text-shadow: none !important;
    font-family: "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif;
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
  .start-parent-item.active .item-arrow,
  .start-parent-item:focus-visible .item-arrow {
    color: var(--win98-highlight-text, #ffffff);
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
    background: var(--win98-menu-bg, #c0c0c0);
    border-top: 2px solid #ffffff;
    border-left: 2px solid #ffffff;
    border-right: 2px solid #000000;
    border-bottom: 2px solid #000000;
    box-shadow: 2px 2px 8px rgba(0, 0, 0, 0.4);
    padding: 2px;
    z-index: 100000;
  }
</style>
