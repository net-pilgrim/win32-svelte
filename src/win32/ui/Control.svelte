<script lang="ts">
  import {
    kernel,
    SendMessage,
    PostMessage,
  } from "../kernel.svelte";
  import {
    WM_LBUTTONDOWN,
    WM_LBUTTONUP,
    WM_RBUTTONDOWN,
    WM_RBUTTONUP,
    WM_COMMAND,
    EN_CHANGE,
    CBN_SELCHANGE,
    BS_CHECKBOX,
    BS_AUTOCHECKBOX,
    BS_RADIOBUTTON,
    BS_AUTORADIOBUTTON,
    BS_GROUPBOX,
    BST_CHECKED,
    BST_UNCHECKED,
    MAKEWPARAM,
  } from "../constants";
  import type { WindowRecord } from "../types";

  interface Props {
    window: WindowRecord;
  }

  let { window: win }: Props = $props();

  let isCheckbox = $derived(
    win.className.toUpperCase() === "BUTTON" &&
    ((win.style & BS_AUTOCHECKBOX) === BS_AUTOCHECKBOX || (win.style & BS_CHECKBOX) === BS_CHECKBOX)
  );

  let isRadio = $derived(
    win.className.toUpperCase() === "BUTTON" &&
    ((win.style & BS_AUTORADIOBUTTON) === BS_AUTORADIOBUTTON || (win.style & BS_RADIOBUTTON) === BS_RADIOBUTTON)
  );

  let isGroupbox = $derived(
    win.className.toUpperCase() === "BUTTON" &&
    (win.style & BS_GROUPBOX) === BS_GROUPBOX
  );

  function onButtonPointerDown(e: PointerEvent) {
    e.stopPropagation();
    if (e.button === 0) {
      SendMessage(win.hwnd, WM_LBUTTONDOWN, 0, 0);
    } else if (e.button === 2) {
      SendMessage(win.hwnd, WM_RBUTTONDOWN, 0, 0);
    }
  }

  function onButtonPointerUp(e: PointerEvent) {
    e.stopPropagation();
    if (e.button === 0) {
      SendMessage(win.hwnd, WM_LBUTTONUP, 0, 0);
    } else if (e.button === 2) {
      SendMessage(win.hwnd, WM_RBUTTONUP, 0, 0);
    }
  }

  function onContextMenu(e: MouseEvent) {
    e.preventDefault();
  }

  function onCheckToggle(e: Event) {
    e.stopPropagation();
    SendMessage(win.hwnd, WM_LBUTTONDOWN, 0, 0);
    SendMessage(win.hwnd, WM_LBUTTONUP, 0, 0);
  }

  function onRadioSelect(e: Event) {
    e.stopPropagation();
    SendMessage(win.hwnd, WM_LBUTTONDOWN, 0, 0);
    SendMessage(win.hwnd, WM_LBUTTONUP, 0, 0);
  }

  function onEditInput(e: Event) {
    const target = e.target as HTMLInputElement | HTMLTextAreaElement;
    if (win.controlState) {
      win.controlState.value = target.value;
    }
    if (win.parentHwnd !== null) {
      const cmdWParam = MAKEWPARAM(win.menuId ?? 0, EN_CHANGE);
      SendMessage(win.parentHwnd, WM_COMMAND, cmdWParam, win.hwnd);
    }
  }

  function onComboboxChange(e: Event) {
    const target = e.target as HTMLSelectElement;
    if (win.controlState) {
      win.controlState.selectedIndex = Number(target.value);
    }
    if (win.parentHwnd !== null) {
      const cmdWParam = MAKEWPARAM(win.menuId ?? 0, CBN_SELCHANGE);
      SendMessage(win.parentHwnd, WM_COMMAND, cmdWParam, win.hwnd);
    }
  }

  function onTrackbarInput(e: Event) {
    const target = e.target as HTMLInputElement;
    const val = Number(target.value);
    if (win.controlState) {
      win.controlState.progressPos = val;
    }
    if (win.parentHwnd !== null) {
      const cmdWParam = MAKEWPARAM(win.menuId ?? 0, val);
      SendMessage(win.parentHwnd, WM_COMMAND, cmdWParam, win.hwnd);
    }
  }
</script>

{#if win.visible}
  {#if win.className.toUpperCase() === "BUTTON"}
    {#if isGroupbox}
      <fieldset
        class="win32-control win32-groupbox {win.customProps?.className ?? ''}"
        style="left: {win.x}px; top: {win.y}px; width: {win.width}px; height: {win.height}px; {win.customProps?.style ?? ''}"
      >
        <legend>{win.title}</legend>
      </fieldset>
    {:else if isCheckbox}
      <div
        class="win32-control field-row win32-checkbox-row {win.customProps?.className ?? ''}"
        style="left: {win.x}px; top: {win.y}px; width: {win.width}px; height: {win.height}px; {win.customProps?.style ?? ''}"
      >
        <input
          type="checkbox"
          id={"chk_" + win.hwnd}
          checked={win.controlState?.checked === BST_CHECKED}
          onchange={onCheckToggle}
          disabled={!win.enabled}
        />
        <label for={"chk_" + win.hwnd}>{win.title}</label>
      </div>
    {:else if isRadio}
      <div
        class="win32-control field-row win32-radio-row {win.customProps?.className ?? ''}"
        style="left: {win.x}px; top: {win.y}px; width: {win.width}px; height: {win.height}px; {win.customProps?.style ?? ''}"
      >
        <input
          type="radio"
          id={"rad_" + win.hwnd}
          name={win.customProps?.groupName ?? ("rad_group_" + win.parentHwnd)}
          checked={win.controlState?.checked === BST_CHECKED}
          onchange={onRadioSelect}
          disabled={!win.enabled}
        />
        <label for={"rad_" + win.hwnd}>{win.title}</label>
      </div>
    {:else}
      <button
        class="win32-control win32-button {win.customProps?.className ?? ''}"
        style="left: {win.x}px; top: {win.y}px; width: {win.width}px; height: {win.height}px; {win.customProps?.style ?? ''}"
        onpointerdown={onButtonPointerDown}
        onpointerup={onButtonPointerUp}
        oncontextmenu={onContextMenu}
        disabled={!win.enabled}
      >
        {win.title}
      </button>
    {/if}
  {:else if win.className.toUpperCase() === "STATIC"}
    <div
      class="win32-control win32-static {win.customProps?.className ?? ''}"
      style="left: {win.x}px; top: {win.y}px; width: {win.width}px; height: {win.height}px; {win.customProps?.style ?? ''}"
    >
      {win.title}
    </div>
  {:else if win.className.toUpperCase() === "EDIT"}
    {#if win.style & 0x0004}
      <!-- ES_MULTILINE -->
      <textarea
        class="win32-control win32-edit {win.customProps?.className ?? ''}"
        style="left: {win.x}px; top: {win.y}px; width: {win.width}px; height: {win.height}px; {win.customProps?.style ?? ''}"
        value={win.controlState?.value ?? ""}
        oninput={onEditInput}
        disabled={!win.enabled}
      ></textarea>
    {:else}
      <input
        type="text"
        class="win32-control win32-edit {win.customProps?.className ?? ''}"
        style="left: {win.x}px; top: {win.y}px; width: {win.width}px; height: {win.height}px; {win.customProps?.style ?? ''}"
        value={win.controlState?.value ?? ""}
        oninput={onEditInput}
        disabled={!win.enabled}
      />
    {/if}
  {:else if win.className.toUpperCase() === "COMBOBOX"}
    <select
      class="win32-control win32-combobox {win.customProps?.className ?? ''}"
      style="left: {win.x}px; top: {win.y}px; width: {win.width}px; height: {win.height}px; {win.customProps?.style ?? ''}"
      onchange={onComboboxChange}
      disabled={!win.enabled}
    >
      {#each win.controlState?.items ?? [] as item, i}
        <option value={i} selected={win.controlState?.selectedIndex === i}>{item}</option>
      {/each}
    </select>
  {:else if win.className.toUpperCase() === "PROGRESS" || win.className.toUpperCase() === "MSCTLS_PROGRESS32"}
    <div
      class="win32-control progress-indicator segmented {win.customProps?.className ?? ''}"
      style="left: {win.x}px; top: {win.y}px; width: {win.width}px; height: {win.height}px; {win.customProps?.style ?? ''}"
    >
      <span
        class="progress-indicator-bar"
        style="width: {win.controlState?.progressPos ?? 0}%;"
      ></span>
    </div>
  {:else if win.className.toUpperCase() === "TRACKBAR" || win.className.toUpperCase() === "MSCTLS_TRACKBAR32"}
    <input
      type="range"
      class="win32-control win32-trackbar {win.customProps?.className ?? ''}"
      style="left: {win.x}px; top: {win.y}px; width: {win.width}px; height: {win.height}px; {win.customProps?.style ?? ''}"
      min={win.controlState?.rangeMin ?? 0}
      max={win.controlState?.rangeMax ?? 100}
      value={win.controlState?.progressPos ?? 50}
      oninput={onTrackbarInput}
      disabled={!win.enabled}
    />
  {/if}
{/if}

<style>
  .win32-control {
    position: absolute;
    box-sizing: border-box;
    font-family: "MS Sans Serif", "Pixelated MS Sans Serif", Arial, sans-serif;
    font-size: 11px;
    user-select: none;
  }

  .win32-static {
    display: flex;
    align-items: center;
    overflow: hidden;
    white-space: pre-wrap;
    color: #000;
  }

  .win32-checkbox-row,
  .win32-radio-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .win32-groupbox {
    margin: 0;
    pointer-events: none;
  }

  .win32-groupbox legend {
    font-weight: bold;
    padding: 0 4px;
  }

  .win32-edit {
    user-select: text;
    font-family: "Courier New", monospace, sans-serif;
    font-size: 12px;
  }

  :global(.win32-led) {
    background: #000 !important;
    color: #ff0000 !important;
    font-family: "Courier New", monospace !important;
    font-weight: bold !important;
    font-size: 15px !important;
    letter-spacing: 2px !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    border: 1px inset #808080 !important;
  }

  :global(.mine-cell) {
    min-width: unset !important;
    min-height: unset !important;
    padding: 0 !important;
    font-size: 11px !important;
    font-weight: bold !important;
    line-height: 1 !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
  }

  :global(.mine-cell-revealed) {
    background: #bdbdbd !important;
    border: 1px solid #7b7b7b !important;
    box-shadow: none !important;
    cursor: default !important;
  }

  :global(.mine-cell-boom) {
    background: #ff0000 !important;
    border: 1px solid #7b7b7b !important;
    box-shadow: none !important;
  }

  :global(.smiley-button) {
    min-width: 26px !important;
    min-height: 26px !important;
    padding: 0 !important;
    font-size: 16px !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
  }
</style>
