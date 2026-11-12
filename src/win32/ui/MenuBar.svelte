<script lang="ts">
  import { onMount } from "svelte";
  import { kernel, SendMessage } from "../kernel.svelte";
  import { WM_COMMAND, MAKEWPARAM } from "../constants";
  import type { HWND, HMENU, MenuItem } from "../types";

  interface Props {
    hwnd: HWND;
    hMenu: HMENU;
  }

  let { hwnd, hMenu }: Props = $props();

  let menuBarEl = $state<HTMLElement | null>(null);
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
    SendMessage(hwnd, WM_COMMAND, MAKEWPARAM(item.id, 0), 0);
  }

  onMount(() => {
    const handleGlobalPointerDown = (e: PointerEvent) => {
      if (menuBarEl && menuBarEl.contains(e.target as Node)) {
        return;
      }
      activePopupIdx = null;
    };
    window.addEventListener("pointerdown", handleGlobalPointerDown);
    return () => window.removeEventListener("pointerdown", handleGlobalPointerDown);
  });

  function splitMnemonic(text: string): { before: string; char: string; after: string } | null {
    const ampIdx = text.indexOf("&");
    if (ampIdx !== -1 && ampIdx < text.length - 1) {
      return {
        before: text.slice(0, ampIdx),
        char: text[ampIdx + 1],
        after: text.slice(ampIdx + 2),
      };
    }
    return null;
  }

  function parseMenuItem(text: string, explicitShortcut?: string) {
    let main = text;
    let shortcut = explicitShortcut;
    if (main.includes("\t")) {
      const parts = main.split("\t");
      main = parts[0];
      if (!shortcut && parts[1]) {
        shortcut = parts[1];
      }
    }
    const mnemonic = splitMnemonic(main);
    return {
      main: mnemonic ? mnemonic.before + mnemonic.char + mnemonic.after : main,
      shortcut,
      mnemonic,
    };
  }
</script>

{#if rootMenu}
  <div class="menu-bar" bind:this={menuBarEl}>
    {#each rootMenu.items as topItem, idx}
      {@const parsed = parseMenuItem(topItem.text, topItem.shortcut)}
      {@const subMenu = topItem.hSubMenu ? kernel.GetMenuRecord(topItem.hSubMenu) : null}
      {@const isOpen = activePopupIdx === idx}

      <div class="menu-bar-entry">
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <button
          class="menu-bar-btn {isOpen ? 'open' : ''}"
          onclick={(e) => toggleMenu(idx, e)}
          onmouseenter={() => onMenuHover(idx)}
        >
          {#if parsed.mnemonic}
            {parsed.mnemonic.before}<u>{parsed.mnemonic.char}</u>{parsed.mnemonic.after}
          {:else}
            {parsed.main}
          {/if}
        </button>

        {#if isOpen && subMenu}
          <div class="menu-popup window" role="menu">
            {#each subMenu.items as subItem}
              {#if subItem.isSeparator}
                <div class="menu-separator"></div>
              {:else}
                {@const subParsed = parseMenuItem(subItem.text, subItem.shortcut)}
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <div
                  class="menu-item {subItem.disabled ? 'disabled' : ''}"
                  onclick={(e) => onMenuItemClick(subItem, e)}
                  role="menuitem"
                  tabindex="-1"
                >
                  <span class="menu-check">{subItem.checked ? "✓" : ""}</span>
                  <span class="menu-title">
                    {#if subParsed.mnemonic}
                      {subParsed.mnemonic.before}<u>{subParsed.mnemonic.char}</u>{subParsed.mnemonic.after}
                    {:else}
                      {subParsed.main}
                    {/if}
                  </span>
                  {#if subParsed.shortcut}
                    <span class="menu-shortcut">{subParsed.shortcut}</span>
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
