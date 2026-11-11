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
    WM_NOTIFY,
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
    TCN_SELCHANGE,
    TVN_SELCHANGED,
    LVN_ITEMCHANGED,
    STATUSCLASSNAME,
    WC_TABCONTROL,
    WC_TREEVIEW,
    WC_LISTVIEW,
  } from "../constants";
  import type { WindowRecord, TreeNodeItem, ListViewRow, NMHDR } from "../types";

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

  function onTabSelect(e: MouseEvent, index: number) {
    e.preventDefault();
    e.stopPropagation();
    if (win.controlState) {
      win.controlState.selectedTab = index;
    }
    if (win.parentHwnd !== null) {
      const nmhdr: NMHDR = {
        hwndFrom: win.hwnd,
        idFrom: win.menuId ?? 0,
        code: TCN_SELCHANGE,
        tabIndex: index,
      };
      SendMessage(win.parentHwnd, WM_NOTIFY, win.menuId ?? 0, nmhdr as any);
    }
  }

  function onTreeNodeSelect(e: MouseEvent, node: TreeNodeItem) {
    e.stopPropagation();
    if (win.controlState) {
      win.controlState.selectedNodeId = node.id;
    }
    if (win.parentHwnd !== null) {
      const nmhdr: NMHDR = {
        hwndFrom: win.hwnd,
        idFrom: win.menuId ?? 0,
        code: TVN_SELCHANGED,
        item: node,
        nodeId: node.id,
      };
      SendMessage(win.parentHwnd, WM_NOTIFY, win.menuId ?? 0, nmhdr as any);
    }
  }

  function onListRowClick(e: MouseEvent, row: ListViewRow, index: number) {
    e.stopPropagation();
    if (win.controlState) {
      win.controlState.selectedRowIndex = index;
      win.controlState.listRows?.forEach((r, idx) => {
        r.selected = idx === index;
      });
    }
    if (win.parentHwnd !== null) {
      const nmhdr: NMHDR = {
        hwndFrom: win.hwnd,
        idFrom: win.menuId ?? 0,
        code: LVN_ITEMCHANGED,
        itemIndex: index,
        row,
      };
      SendMessage(win.parentHwnd, WM_NOTIFY, win.menuId ?? 0, nmhdr as any);
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
  {:else if win.className.toUpperCase() === "STATUSBAR" || win.className.toUpperCase() === "MSCTLS_STATUSBAR32"}
    <div
      class="win32-control status-bar win32-statusbar {win.customProps?.className ?? ''}"
      style="left: {win.x}px; top: {win.y}px; width: {win.width}px; height: {win.height}px; {win.customProps?.style ?? ''}"
    >
      {#each win.controlState?.statusParts ?? [{ text: win.title || "Ready" }] as part}
        <p
          class="status-bar-field"
          style={part.width ? `flex-grow: 0; width: ${part.width}px; min-width: ${part.width}px;` : "flex-grow: 1;"}
        >
          {part.text}
        </p>
      {/each}
    </div>
  {:else if win.className.toUpperCase() === "TABCONTROL" || win.className.toUpperCase() === "SYSTABCONTROL32"}
    <div
      class="win32-control win32-tabcontrol-container {win.customProps?.className ?? ''}"
      style="left: {win.x}px; top: {win.y}px; width: {win.width}px; height: {win.height}px; {win.customProps?.style ?? ''}"
    >
      <menu role="tablist">
        {#each win.controlState?.tabs ?? [] as tab, i}
          <li role="tab" aria-selected={win.controlState?.selectedTab === i}>
            <a href="#tab" onclick={(e) => onTabSelect(e, i)}>{tab.text}</a>
          </li>
        {/each}
      </menu>
    </div>
  {:else if win.className.toUpperCase() === "TREEVIEW" || win.className.toUpperCase() === "SYSTREEVIEW32"}
    <ul
      class="win32-control tree-view {win.customProps?.className ?? ''}"
      style="left: {win.x}px; top: {win.y}px; width: {win.width}px; height: {win.height}px; overflow: auto; {win.customProps?.style ?? ''}"
    >
      {#each win.controlState?.treeNodes ?? [] as node}
        <li>
          {#if node.children && node.children.length > 0}
            <details open={node.expanded ?? true}>
              <summary onclick={(e) => e.stopPropagation()}>
                <a
                  href="#node"
                  class={win.controlState?.selectedNodeId === node.id ? "selected-tree-node" : ""}
                  onclick={(e) => onTreeNodeSelect(e, node)}
                >
                  {node.icon ? node.icon + " " : ""}{node.text}
                </a>
              </summary>
              {@render renderTreeNodes(node.children)}
            </details>
          {:else}
            <a
              href="#node"
              class={win.controlState?.selectedNodeId === node.id ? "selected-tree-node" : ""}
              onclick={(e) => onTreeNodeSelect(e, node)}
            >
              {node.icon ? node.icon + " " : ""}{node.text}
            </a>
          {/if}
        </li>
      {/each}
    </ul>
  {:else if win.className.toUpperCase() === "LISTVIEW" || win.className.toUpperCase() === "SYSLISTVIEW32"}
    <div
      class="win32-control sunken-panel win32-listview-container {win.customProps?.className ?? ''}"
      style="left: {win.x}px; top: {win.y}px; width: {win.width}px; height: {win.height}px; overflow: auto; {win.customProps?.style ?? ''}"
    >
      <table class="interactive win32-listview-table">
        <thead>
          <tr>
            {#each win.controlState?.listColumns ?? [] as col}
              <th style={col.width ? `width: ${col.width}px; min-width: ${col.width}px;` : ""}>
                {col.text}
              </th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each win.controlState?.listRows ?? [] as row, rIdx}
            <tr
              class={row.selected || win.controlState?.selectedRowIndex === rIdx ? "highlighted" : ""}
              onclick={(e) => onListRowClick(e, row, rIdx)}
            >
              <td>
                {row.icon ? row.icon + " " : ""}{row.text}
              </td>
              {#each row.subItems ?? [] as sub}
                <td>{sub}</td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
{/if}

{#snippet renderTreeNodes(nodes: TreeNodeItem[])}
  <ul>
    {#each nodes as node}
      <li>
        {#if node.children && node.children.length > 0}
          <details open={node.expanded ?? true}>
            <summary onclick={(e) => e.stopPropagation()}>
              <a
                href="#node"
                class={win.controlState?.selectedNodeId === node.id ? "selected-tree-node" : ""}
                onclick={(e) => onTreeNodeSelect(e, node)}
              >
                {node.icon ? node.icon + " " : ""}{node.text}
              </a>
            </summary>
            {@render renderTreeNodes(node.children)}
          </details>
        {:else}
          <a
            href="#node"
            class={win.controlState?.selectedNodeId === node.id ? "selected-tree-node" : ""}
            onclick={(e) => onTreeNodeSelect(e, node)}
          >
            {node.icon ? node.icon + " " : ""}{node.text}
          </a>
        {/if}
      </li>
    {/each}
  </ul>
{/snippet}

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

  .selected-tree-node {
    background-color: var(--dialog-blue, #000080) !important;
    color: #fff !important;
    outline: 1px dotted #ff0;
  }

  .win32-tabcontrol-container {
    display: flex;
    flex-direction: column;
  }

  .win32-tabcontrol-container menu[role="tablist"] {
    margin-bottom: 0;
  }

  .win32-listview-container {
    background: #fff;
    box-sizing: border-box;
  }

  .win32-listview-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
  }

  .win32-listview-table th {
    text-align: left;
    white-space: nowrap;
    user-select: none;
  }

  .win32-listview-table td {
    padding: 2px 4px;
    white-space: nowrap;
  }

  .win32-statusbar {
    margin: 0;
    align-items: center;
    background: var(--surface, #c0c0c0);
  }
</style>
