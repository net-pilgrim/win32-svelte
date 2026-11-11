<script lang="ts">
  import { kernel } from "../kernel.svelte";
  import {
    MB_OKCANCEL,
    MB_YESNO,
    MB_YESNOCANCEL,
    MB_ICONQUESTION,
    MB_ICONEXCLAMATION,
    MB_ICONERROR,
    MB_ICONASTERISK,
    IDOK,
    IDCANCEL,
    IDYES,
    IDNO,
  } from "../constants";

  let mb = $derived(kernel.activeMessageBox);

  let isYesNo = $derived(mb && (mb.type & 0x0f) === MB_YESNO);
  let isOkCancel = $derived(mb && (mb.type & 0x0f) === MB_OKCANCEL);
  let isYesNoCancel = $derived(mb && (mb.type & 0x0f) === MB_YESNOCANCEL);

  let hasQuestionIcon = $derived(mb && (mb.type & MB_ICONQUESTION) === MB_ICONQUESTION);
  let hasExclamationIcon = $derived(mb && (mb.type & MB_ICONEXCLAMATION) === MB_ICONEXCLAMATION);
  let hasErrorIcon = $derived(mb && (mb.type & MB_ICONERROR) === MB_ICONERROR);
  let hasInfoIcon = $derived(mb && (mb.type & MB_ICONASTERISK) === MB_ICONASTERISK);

  function reply(code: number) {
    if (mb) {
      mb.resolve(code);
    }
  }
</script>

{#if mb}
  <div class="modal-backdrop">
    <div class="window win32-dialog" role="dialog">
      <div class="title-bar">
        <div class="title-bar-text">{mb.caption}</div>
        <div class="title-bar-controls">
          <button aria-label="Close" onclick={() => reply(IDCANCEL)}></button>
        </div>
      </div>
      <div class="window-body dialog-body">
        <div class="content-row">
          <div class="icon-area">
            {#if hasErrorIcon}
              <div class="retro-icon error">❌</div>
            {:else if hasQuestionIcon}
              <div class="retro-icon question">❓</div>
            {:else if hasExclamationIcon}
              <div class="retro-icon warning">⚠️</div>
            {:else}
              <div class="retro-icon info">ℹ️</div>
            {/if}
          </div>
          <div class="text-area">
            {mb.text}
          </div>
        </div>

        <div class="button-row">
          {#if isYesNo}
            <button onclick={() => reply(IDYES)}>Yes</button>
            <button onclick={() => reply(IDNO)}>No</button>
          {:else if isOkCancel}
            <button onclick={() => reply(IDOK)}>OK</button>
            <button onclick={() => reply(IDCANCEL)}>Cancel</button>
          {:else if isYesNoCancel}
            <button onclick={() => reply(IDYES)}>Yes</button>
            <button onclick={() => reply(IDNO)}>No</button>
            <button onclick={() => reply(IDCANCEL)}>Cancel</button>
          {:else}
            <button onclick={() => reply(IDOK)}>OK</button>
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.2);
    z-index: 99999;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .win32-dialog {
    min-width: 260px;
    max-width: 440px;
    box-shadow: 3px 3px 10px rgba(0, 0, 0, 0.5);
  }

  .dialog-body {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 12px;
  }

  .content-row {
    display: flex;
    gap: 14px;
    align-items: center;
  }

  .retro-icon {
    font-size: 30px;
    line-height: 1;
  }

  .text-area {
    font-size: 12px;
    line-height: 1.4;
    white-space: pre-wrap;
    user-select: text;
  }

  .button-row {
    display: flex;
    justify-content: center;
    gap: 8px;
  }

  .button-row button {
    min-width: 68px;
    height: 24px;
    font-size: 11px;
  }
</style>
