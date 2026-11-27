<script lang="ts">
  import { kernel } from "../kernel.svelte";
  import { vfs } from "../vfs";
  import type { VFSFileInfo } from "../types";

  let dlg = $derived(kernel.activeFileDialog);
  let isSave = $derived(dlg?.options.isSave ?? false);
  let title = $derived(dlg?.options.title || (isSave ? "Save As" : "Open"));

  let currentDir = $state("C:\\My Documents");
  let entries = $state<VFSFileInfo[]>([]);
  let selectedFile = $state<VFSFileInfo | null>(null);
  let fileName = $state("");
  let selectedFilterIndex = $state(0);
  let parsedFilters = $state<{ label: string; pattern: string }[]>([]);

  $effect(() => {
    if (dlg) {
      currentDir = dlg.options.initialDir || "C:\\My Documents";
      fileName = dlg.options.fileName || "";
      selectedFile = null;
      parseFilters(dlg.options.filter);
      loadEntries(currentDir);
    }
  });

  function parseFilters(filterStr?: string) {
    if (!filterStr) {
      parsedFilters = [
        { label: "Text Documents (*.txt)", pattern: "*.txt" },
        { label: "All Files (*.*)", pattern: "*.*" },
      ];
      selectedFilterIndex = 0;
      return;
    }

    let parts: string[] = [];
    if (filterStr.includes("\0")) {
      parts = filterStr.split("\0").filter((s) => s.length > 0);
    } else if (filterStr.includes("|")) {
      parts = filterStr.split("|").filter((s) => s.length > 0);
    } else {
      parts = [filterStr, "*.*"];
    }

    const list: { label: string; pattern: string }[] = [];
    for (let i = 0; i < parts.length; i += 2) {
      const label = parts[i];
      const pattern = parts[i + 1] || "*.*";
      list.push({ label, pattern });
    }
    if (list.length === 0) {
      list.push({ label: "All Files (*.*)", pattern: "*.*" });
    }
    parsedFilters = list;
    selectedFilterIndex = 0;
  }

  async function loadEntries(dir: string) {
    try {
      const res = await vfs.getDirectoryEntries(dir);
      entries = res;
    } catch (e) {
      console.warn("Failed to load VFS entries for:", dir, e);
      try {
        const rootRes = await vfs.getDirectoryEntries("C:\\");
        currentDir = "C:\\";
        entries = rootRes;
      } catch {
        entries = [];
      }
    }
  }

  let filteredEntries = $derived(() => {
    const filter = parsedFilters[selectedFilterIndex];
    const pattern = filter?.pattern?.toLowerCase() || "*.*";
    return entries.filter((e) => {
      if (e.isDirectory) return true;
      if (pattern === "*.*" || pattern === "*") return true;
      const ext = pattern.replace(/^\*/, "");
      return e.name.toLowerCase().endsWith(ext);
    });
  });

  function selectEntry(e: VFSFileInfo) {
    selectedFile = e;
    if (!e.isDirectory) {
      fileName = e.name;
    }
  }

  function handleEntryDoubleClick(e: VFSFileInfo) {
    if (e.isDirectory) {
      currentDir = e.path;
      loadEntries(currentDir);
    } else {
      fileName = e.name;
      commit();
    }
  }

  function goUp() {
    const norm = vfs.normalizePath(currentDir);
    if (norm.parts.length > 0) {
      norm.parts.pop();
      currentDir = `${norm.drive}:\\${norm.parts.join("\\")}`;
      loadEntries(currentDir);
    }
  }

  function commit() {
    if (!fileName.trim()) return;
    let full = fileName.trim();
    if (!full.includes(":\\") && !full.startsWith("/")) {
      const base = currentDir.endsWith("\\") ? currentDir : `${currentDir}\\`;
      full = `${base}${full}`;
    }
    if (isSave && dlg?.options.defExt && !full.includes(".")) {
      full = `${full}.${dlg.options.defExt}`;
    }
    dlg?.resolve(full);
  }

  function cancel() {
    dlg?.resolve(null);
  }
</script>

{#if dlg}
  <div class="modal-backdrop">
    <div class="window win32-dialog win32-file-dialog" role="dialog" aria-modal="true">
      <div class="title-bar">
        <div class="title-bar-text">{title}</div>
        <div class="title-bar-controls">
          <button aria-label="Close" onclick={cancel}></button>
        </div>
      </div>
      <div class="window-body file-dialog-body">
        <div class="look-in-row">
          <label for="look-in-select">Look &in;:</label>
          <div class="look-in-controls">
            <select
              id="look-in-select"
              value={currentDir}
              onchange={(e) => {
                currentDir = (e.target as HTMLSelectElement).value;
                loadEntries(currentDir);
              }}
            >
              <option value="C:\">C:\</option>
              <option value="C:\My Documents">C:\My Documents</option>
              <option value="C:\wasm_application">C:\wasm_application</option>
              <option value="C:\wasm-demo">C:\wasm-demo</option>
            </select>
            <button class="up-btn" title="Up One Level" onclick={goUp}>📁⬆️</button>
          </div>
        </div>

        <div class="sunken-panel file-list-container">
          {#each filteredEntries() as entry (entry.path)}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              class="file-item {selectedFile?.path === entry.path ? 'selected' : ''}"
              onclick={() => selectEntry(entry)}
              ondblclick={() => handleEntryDoubleClick(entry)}
            >
              <span class="file-icon">{entry.icon || (entry.isDirectory ? "📁" : "📄")}</span>
              <span class="file-name">{entry.name}</span>
            </div>
          {/each}
          {#if entries.length === 0}
            <div class="empty-hint">Folder is empty</div>
          {/if}
        </div>

        <div class="bottom-form">
          <div class="form-inputs">
            <div class="field-row">
              <label for="dlg-file-name">File &name:</label>
              <input
                id="dlg-file-name"
                type="text"
                bind:value={fileName}
                onkeydown={(e) => e.key === "Enter" && commit()}
              />
            </div>
            <div class="field-row">
              <label for="dlg-file-type">Files of &type:</label>
              <select id="dlg-file-type" bind:value={selectedFilterIndex}>
                {#each parsedFilters as f, idx}
                  <option value={idx}>{f.label}</option>
                {/each}
              </select>
            </div>
          </div>
          <div class="form-buttons">
            <button class="default" onclick={commit}>{isSave ? "Save" : "Open"}</button>
            <button onclick={cancel}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.25);
    z-index: 99998;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .win32-file-dialog {
    width: 480px;
    max-width: 95vw;
    box-shadow: 3px 3px 12px rgba(0, 0, 0, 0.5);
  }

  .file-dialog-body {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 8px;
  }

  .look-in-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .look-in-row label {
    min-width: 60px;
  }

  .look-in-controls {
    display: flex;
    flex: 1;
    gap: 6px;
    align-items: center;
  }

  .look-in-controls select {
    flex: 1;
    height: 22px;
  }

  .up-btn {
    padding: 1px 6px;
    height: 22px;
    font-size: 12px;
  }

  .file-list-container {
    height: 180px;
    background: #ffffff;
    overflow-y: auto;
    padding: 4px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .file-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 2px 4px;
    cursor: pointer;
    user-select: none;
    font-size: 12px;
  }

  .file-item:hover {
    background: #e8f0fe;
  }

  .file-item.selected {
    background: #000080;
    color: #ffffff;
  }

  .file-icon {
    font-size: 14px;
  }

  .file-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .empty-hint {
    padding: 12px;
    color: #808080;
    font-style: italic;
    text-align: center;
  }

  .bottom-form {
    display: flex;
    gap: 12px;
    margin-top: 4px;
  }

  .form-inputs {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .form-inputs .field-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .form-inputs .field-row label {
    min-width: 80px;
    font-size: 12px;
  }

  .form-inputs .field-row input,
  .form-inputs .field-row select {
    flex: 1;
    height: 22px;
  }

  .form-buttons {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 75px;
  }

  .form-buttons button {
    height: 23px;
  }
</style>
