<script lang="ts">
  import { kernel } from "../kernel.svelte";

  let dlg = $derived(kernel.activePrintDialog);
  let selectedPrinter = $state("Browser Print (window.print)");
  let copies = $state(1);
  let printRange = $state("all");

  const printers = [
    "Browser Print (window.print)",
    "Print Preview Window",
    "HP LaserJet 4",
    "Generic / Text Only",
  ];

  $effect(() => {
    if (dlg) {
      selectedPrinter = dlg.options.printerName || printers[0];
      copies = dlg.options.nCopies || 1;
      printRange = "all";
    }
  });

  function commit() {
    dlg?.resolve({
      confirmed: true,
      printerName: selectedPrinter,
      nCopies: Math.max(1, copies),
    });
  }

  function cancel() {
    dlg?.resolve(null);
  }
</script>

{#if dlg}
  <div class="modal-backdrop">
    <div class="window win32-dialog win32-print-dialog" role="dialog" aria-modal="true">
      <div class="title-bar">
        <div class="title-bar-text">Print</div>
        <div class="title-bar-controls">
          <button aria-label="Close" onclick={cancel}></button>
        </div>
      </div>
      <div class="window-body print-dialog-body">
        <fieldset class="printer-group">
          <legend>Printer</legend>
          <div class="field-row">
            <label for="printer-select">Name:</label>
            <select id="printer-select" bind:value={selectedPrinter}>
              {#each printers as p}
                <option value={p}>{p}</option>
              {/each}
            </select>
          </div>
          <div class="printer-info">
            <div>Status: Ready</div>
            <div>Type: Local Print Driver</div>
            <div>Where: LPT1:</div>
          </div>
        </fieldset>

        <div class="print-options-row">
          <fieldset class="range-group">
            <legend>Print range</legend>
            <div class="field-row">
              <input type="radio" id="range-all" name="print-range" value="all" bind:group={printRange} />
              <label for="range-all">All</label>
            </div>
            <div class="field-row">
              <input type="radio" id="range-pages" name="print-range" value="pages" bind:group={printRange} />
              <label for="range-pages">Pages</label>
            </div>
          </fieldset>

          <fieldset class="copies-group">
            <legend>Copies</legend>
            <div class="field-row">
              <label for="copies-input">Number of copies:</label>
              <input id="copies-input" type="number" min="1" max="99" bind:value={copies} />
            </div>
          </fieldset>
        </div>

        <div class="button-row">
          <button class="default" onclick={commit}>OK</button>
          <button onclick={cancel}>Cancel</button>
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

  .win32-print-dialog {
    width: 390px;
    max-width: 95vw;
    box-shadow: 3px 3px 12px rgba(0, 0, 0, 0.5);
  }

  .print-dialog-body {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 8px;
  }

  fieldset {
    margin: 0;
    padding: 6px 10px 10px 10px;
  }

  .printer-group .field-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
  }

  .printer-group .field-row select {
    flex: 1;
    height: 22px;
  }

  .printer-info {
    font-size: 11px;
    color: #404040;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding-left: 2px;
  }

  .print-options-row {
    display: flex;
    gap: 8px;
  }

  .range-group {
    flex: 1;
  }

  .copies-group {
    flex: 1;
  }

  .copies-group .field-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .copies-group input {
    width: 50px;
    height: 22px;
  }

  .button-row {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 4px;
  }

  .button-row button {
    min-width: 75px;
    height: 23px;
  }
</style>
