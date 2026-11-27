<script lang="ts">
  import { kernel } from "../kernel.svelte";
  import {
    FONT_STYLES,
    FONT_POINT_SIZES,
    DEFAULT_FONT_FAMILY,
    DEFAULT_FONT_POINT_SIZE,
    measureAvailableFontFamilies,
    makeCanvasFontMeasurer,
    nearestPointSize,
  } from "./font_dialog_utils";
  import type { ChooseFontResult } from "../types";

  let dlg = $derived(kernel.activeFontDialog);

  let families = $state<string[]>([DEFAULT_FONT_FAMILY, "Arial", "Courier New", "Times New Roman"]);
  let selectedFamily = $state(DEFAULT_FONT_FAMILY);
  let selectedStyleIndex = $state(0);
  let selectedSize = $state(DEFAULT_FONT_POINT_SIZE);
  let underline = $state(false);
  let strikeout = $state(false);

  let effectiveFamilies = $derived(
    dlg?.options.faceName && !families.includes(dlg.options.faceName)
      ? [dlg.options.faceName, ...families]
      : families
  );
  let effectiveSizes = $derived.by(() => {
    const min = dlg?.options.minSize;
    const max = dlg?.options.maxSize;
    if (min === undefined && max === undefined) return FONT_POINT_SIZES;
    const filtered = FONT_POINT_SIZES.filter((s) => {
      if (min !== undefined && min > 0 && s < min) return false;
      if (max !== undefined && max > 0 && s > max) return false;
      return true;
    });
    return filtered.length > 0 ? filtered : FONT_POINT_SIZES;
  });

  $effect(() => {
    if (!dlg) return;
    const options = dlg.options;

    if (typeof document !== "undefined") {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (ctx) {
        families = measureAvailableFontFamilies(makeCanvasFontMeasurer(ctx));
      }
    }

    selectedFamily = options.faceName || families[0] || DEFAULT_FONT_FAMILY;
    selectedStyleIndex = Math.max(
      0,
      FONT_STYLES.findIndex((s) => s.bold === !!options.bold && s.italic === !!options.italic)
    );
    selectedSize = nearestPointSize(
      options.pointSize || DEFAULT_FONT_POINT_SIZE,
      options.minSize,
      options.maxSize
    );
    underline = !!options.underline;
    strikeout = !!options.strikeout;
  });

  let currentStyle = $derived(FONT_STYLES[selectedStyleIndex] ?? FONT_STYLES[0]);

  function reply(result: ChooseFontResult | null) {
    if (dlg) {
      dlg.resolve(result);
    }
  }

  function confirm() {
    const pointSize = selectedSize;
    reply({
      faceName: selectedFamily,
      pointSize,
      weight: currentStyle.bold ? 700 : 400,
      bold: currentStyle.bold,
      italic: currentStyle.italic,
      underline,
      strikeout,
      lfHeight: Math.round((-pointSize * 96) / 72),
    });
  }

  function onFamilyKeydown(event: KeyboardEvent) {
    if (event.key === "Enter") confirm();
    if (event.key === "Escape") reply(null);
  }
</script>

{#if dlg}
  <div class="modal-backdrop">
    <div class="window win32-dialog" role="dialog" aria-label={dlg.options.title || "Font"}>
      <div class="title-bar">
        <div class="title-bar-text">{dlg.options.title || "Font"}</div>
        <div class="title-bar-controls">
          <button aria-label="Close" onclick={() => reply(null)}></button>
        </div>
      </div>
      <div class="window-body dialog-body">
        <div class="lists-row">
          <label class="list-column">
            <span class="list-label">Font:</span>
            <select
              class="font-list"
              size="8"
              bind:value={selectedFamily}
              onkeydown={onFamilyKeydown}
              ondblclick={confirm}
            >
              {#each effectiveFamilies as family (family)}
                <option value={family} style="font-family: '{family}', sans-serif">{family}</option>
              {/each}
            </select>
          </label>

          <label class="list-column">
            <span class="list-label">Font Style:</span>
            <select class="font-list" size="8" bind:value={selectedStyleIndex}>
              {#each FONT_STYLES as style, i (style.label)}
                <option value={i}>{style.label}</option>
              {/each}
            </select>
          </label>

          <label class="list-column size-column">
            <span class="list-label">Size:</span>
            <select class="font-list" size="8" bind:value={selectedSize}>
              {#each effectiveSizes as size (size)}
                <option value={size}>{size}</option>
              {/each}
            </select>
          </label>
        </div>

        <fieldset>
          <legend>Effects</legend>
          <label class="effect-row">
            <input type="checkbox" bind:checked={strikeout} /> Strikeout
          </label>
          <label class="effect-row">
            <input type="checkbox" bind:checked={underline} /> Underline
          </label>
        </fieldset>

        <fieldset class="sample-frame">
          <legend>Sample</legend>
          <div
            class="sample-text"
            style:font-family="'{selectedFamily}', 'MS Sans Serif', sans-serif"
            style:font-size="{selectedSize}pt"
            style:font-weight={currentStyle.bold ? "bold" : "normal"}
            style:font-style={currentStyle.italic ? "italic" : "normal"}
            style:text-decoration-line={underline && strikeout
              ? "underline line-through"
              : underline
                ? "underline"
                : strikeout
                  ? "line-through"
                  : "none"}
          >
            AaBbYyZz
          </div>
        </fieldset>

        <div class="button-row">
          <button onclick={confirm}>OK</button>
          <button onclick={() => reply(null)}>Cancel</button>
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
    min-width: 420px;
    max-width: 480px;
    box-shadow: 3px 3px 10px rgba(0, 0, 0, 0.5);
  }

  .dialog-body {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 12px;
  }

  .lists-row {
    display: flex;
    gap: 12px;
  }

  .list-column {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
    min-width: 0;
  }

  .size-column {
    flex: 0 0 64px;
  }

  .list-label {
    font-size: 11px;
  }

  .font-list {
    height: 132px;
    font-size: 11px;
    overflow-y: auto;
  }

  .effect-row {
    display: block;
    font-size: 11px;
    margin: 2px 0;
  }

  .sample-frame {
    margin: 0;
  }

  .sample-text {
    min-height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #ffffff;
    box-shadow: inset -1px -1px #fff, inset 1px 1px #808080, inset -2px -2px #dfdfdf,
      inset 2px 2px #0a0a0a;
    padding: 8px;
  }

  .button-row {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  .button-row button {
    min-width: 68px;
    height: 24px;
    font-size: 11px;
  }
</style>
