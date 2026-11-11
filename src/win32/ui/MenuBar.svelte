<script lang="ts">
  import { onMount } from "svelte";
  import { kernel, SendMessage } from "../kernel.svelte";
  import { WM_COMMAND } from "../constants";
  import type { HWND, HMENU, MenuItem } from "../types";

  interface Props {
    hwnd: HWND;
    hMenu: HMENU;
  }

  let { hwnd, hMenu }: Props = $props();

  let activePopupIdx = $state<number | null>(null);

  let rootMenu = $derived(kernel.GetMenuRecord(hMenu));

  function toggleMenu(idx: number, e: MouseEvent) {
    e.stopPropagation();
    if (activePopupIdx === idx) {
      activePopupIdx = null;
    } else {
      activePopupIdx = idx;
    }
  }

  function onMenuHover(idx: number) {
    if (activePopupIdx !== null && activePopupIdx !== idx) {
      activePopupIdx = idx;
    }
  }

  function onMenuItemClick(item: MenuItem, e: MouseEvent) {
    e.stopPropagation();
    if (item.disabled || item.isSeparator) return;

    activePopupIdx = null;
    SendMessage(hwnd, WM_COMMAND, item.id, 0);
  }

  onMount(() => {
    const handleGlobalClick = () => {
      activePopupIdx = null;
    };
    window.addEventListener("pointerdown", handleGlobalClick);
    return () => window.removeEventListener("pointerdown", handleGlobalClick);
  });

  function formatMenuText(text: string): { label: string; underlineChar: string | null } {
    const ampIdx = text.indexOf("&");
    if (ampIdx !== -1 && ampIdx < text.length - 1) {
      return {
        label: text.replace("&", ""),
        underlineChar: text[ampIdx + 1],
      };
    }
    return { label: text, underlineChar: null };
  }
</script>

{#if rootMenu}
  <div class="menu-bar">
    {#each rootMenu.items as topItem, idx}
      {@const fmt = formatMenuText(topItem.text)}
      {@const subMenu = topItem.hSubMenu ? kernel.GetMenuRecord(topItem.hSubMenu) : null}
      {@const isOpen = activePopupIdx === idx}

      <div class="menu-bar-entry">
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <button
          class="menu-bar-btn {isOpen ? 'open' : ''}"
          onclick={(e) => toggleMenu(idx, e)}
          onmouseenter={() => onMenuHover(idx)}
        >
          {#if fmt.underlineChar}
            {fmt.label.slice(0, fmt.label.indexOf(fmt.underlineChar))}<u>{fmt.underlineChar}</u>{fmt.label.slice(fmt.label.indexOf(fmt.underlineChar) + 1)}
          {:else}
            {fmt.label}
          {/if}
        </button>

        {#if isOpen && subMenu}
          <div class="menu-popup window" role="menu">
            {#each subMenu.items as subItem}
              {#if subItem.isSeparator}
                <div class="menu-separator"></div>
              {:else}
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <div
                  class="menu-item {subItem.disabled ? 'disabled' : ''}"
                  onclick={(e) => onMenuItemClick(subItem, e)}
                  role="menuitem"
                  tabindex="-1"
                >
                  <span class="menu-check">{subItem.checked ? "✓" : ""}</span>
                  <span class="menu-title">{subItem.text.replace("&", "")}</span>
                  {#if subItem.shortcut}
                    <span class="menu-shortcut">{subItem.shortcut}</span>
                  {/if}
                </div>
              {/if}
            {/each}
          </div>
        {/if}
      </div>
    {/each}
  </div>
{/if}

<style>
  .menu-bar {
    display: flex;
    background: #c0c0c0;
    padding: 1px 2px;
    border-bottom: 1px solid #808080;
    box-shadow: 0 1px 0 #ffffff;
    font-size: 11px;
    font-family: "MS Sans Serif", "Pixelated MS Sans Serif", Arial, sans-serif;
    position: relative;
    z-index: 50;
  }

  .menu-bar-entry {
    position: relative;
  }

  .menu-bar-btn {
    background: transparent;
    border: 1px solid transparent;
    box-shadow: none;
    min-width: unset;
    min-height: unset;
    padding: 2px 6px;
    font-size: 11px;
    color: #000;
    cursor: default;
    border-radius: 0;
  }

  .menu-bar-btn:focus {
    outline: none;
  }

  .menu-bar-btn:hover {
    box-shadow: inset -1px -1px #0a0a0a, inset 1px 1px #fff, inset -2px -2px grey, inset 2px 2px #dfdfdf;
  }

  .menu-bar-btn.open {
    background: #000080;
    color: #ffffff;
    box-shadow: none;
  }

  .menu-popup {
    position: absolute;
    top: 100%;
    left: 0;
    min-width: 150px;
    background: #c0c0c0;
    box-shadow: inset -1px -1px #0a0a0a, inset 1px 1px #dfdfdf, inset -2px -2px grey, inset 2px 2px #fff, 2px 2px 6px rgba(0,0,0,0.4);
    padding: 2px 1px;
    z-index: 1000;
    display: flex;
    flex-direction: column;
  }

  .menu-item {
    display: flex;
    align-items: center;
    padding: 2px 8px 2px 4px;
    cursor: default;
    color: #000;
    gap: 6px;
    font-size: 11px;
    white-space: nowrap;
    user-select: none;
  }

  .menu-check {
    width: 12px;
    text-align: center;
    font-weight: bold;
    font-size: 11px;
  }

  .menu-title {
    flex: 1;
  }

  .menu-shortcut {
    color: #444;
    font-size: 10px;
    margin-left: 16px;
  }

  .menu-item:hover:not(.disabled) {
    background: #000080;
    color: #ffffff;
  }

  .menu-item:hover:not(.disabled) .menu-shortcut {
    color: #ffffff;
  }

  .menu-item.disabled {
    color: #808080;
    text-shadow: 1px 1px 0 #ffffff;
  }

  .menu-separator {
    height: 0;
    margin: 3px 2px;
    border-top: 1px solid #808080;
    border-bottom: 1px solid #ffffff;
  }
</style>
