import { kernel } from "../kernel.svelte";
import {
  FONT_STYLES,
  FONT_POINT_SIZES,
  FONT_FAMILY_CANDIDATES,
  FONT_PROBE_FALLBACK_STACK,
  measureAvailableFontFamilies,
  pointSizeToLogicalHeight,
  logicalHeightToPointSize,
  styleLabelFor,
  clampPointSize,
  nearestPointSize,
} from "../ui/font_dialog_utils";
import type { ChooseFontResult } from "../types";

async function runFontDialogTests() {
  console.log("Starting Win32 Font Dialog Tests...\n");

  console.log("Test 1: Point size <-> logical height conversion...");
  if (pointSizeToLogicalHeight(10) !== -13) {
    throw new Error(`Expected -13 for 10pt, got ${pointSizeToLogicalHeight(10)}`);
  }
  if (pointSizeToLogicalHeight(12) !== -16) {
    throw new Error(`Expected -16 for 12pt, got ${pointSizeToLogicalHeight(12)}`);
  }
  if (logicalHeightToPointSize(-13) !== 10) {
    throw new Error(`Expected 10pt for -13, got ${logicalHeightToPointSize(-13)}`);
  }
  if (logicalHeightToPointSize(16) !== 12) {
    throw new Error(`Expected 12pt for 16, got ${logicalHeightToPointSize(16)}`);
  }
  if (logicalHeightToPointSize(0) !== 10) {
    throw new Error("Expected default 10pt for zero height");
  }
  console.log("\u2713 Point size conversions match MulDiv(pointSize, 96, 72)");

  console.log("Test 2: Style label mapping...");
  if (styleLabelFor(false, false) !== "Regular") throw new Error("Regular style label wrong");
  if (styleLabelFor(true, false) !== "Bold") throw new Error("Bold style label wrong");
  if (styleLabelFor(false, true) !== "Italic") throw new Error("Italic style label wrong");
  if (styleLabelFor(true, true) !== "Bold Italic") throw new Error("Bold Italic label wrong");
  if (FONT_STYLES.length !== 4) throw new Error("Expected 4 font styles");
  console.log("\u2713 Font style labels map bold/italic pairs correctly");

  console.log("Test 3: Point size clamping and snapping...");
  if (clampPointSize(20, 8, 14) !== 14) throw new Error("clampPointSize failed on max");
  if (clampPointSize(4, 8, 14) !== 8) throw new Error("clampPointSize failed on min");
  if (clampPointSize(11) !== 11) throw new Error("clampPointSize should pass through without limits");
  if (nearestPointSize(15) !== 14) throw new Error(`Expected nearest to 15 -> 14, got ${nearestPointSize(15)}`);
  if (nearestPointSize(13) !== 12) throw new Error(`Expected nearest to 13 -> 12, got ${nearestPointSize(13)}`);
  if (!FONT_POINT_SIZES.includes(nearestPointSize(100))) {
    throw new Error("nearestPointSize must return a listed size");
  }
  console.log("\u2713 Point size limits (CF_LIMITSIZE) and snapping verified");

  console.log("Test 4: Font family detection via canvas width comparison...");
  const fakeMeasure = (familyList: string) => {
    if (familyList === FONT_PROBE_FALLBACK_STACK) return 100;
    if (familyList.startsWith("'Arial'") || familyList.startsWith("'Courier New'")) return 152.5;
    return 100;
  };
  const available = measureAvailableFontFamilies(fakeMeasure);
  if (!available.includes("Arial")) throw new Error("Arial should be detected as available");
  if (!available.includes("Courier New")) throw new Error("Courier New should be detected as available");
  if (available.includes("Comic Sans MS")) throw new Error("Comic Sans MS should be filtered out");
  const noneAvailable = measureAvailableFontFamilies(() => 42);
  if (noneAvailable.length === 0 || !noneAvailable.includes("MS Sans Serif")) {
    throw new Error("Expected fallback family list when no family differs from baseline");
  }
  if (FONT_FAMILY_CANDIDATES.length < 10) {
    throw new Error("Expected a reasonable candidate font list");
  }
  console.log(`\u2713 Family detection: ${available.length} of ${FONT_FAMILY_CANDIDATES.length} candidates detected`);

  console.log("Test 5: ChooseFont promise lifecycle on the kernel...");
  const dialogPromise = kernel.ChooseFont({ title: "Font", faceName: "Arial", pointSize: 12 });
  if (!kernel.activeFontDialog) throw new Error("activeFontDialog should be set while dialog is open");
  if (kernel.activeFontDialog.options.faceName !== "Arial") {
    throw new Error("ChooseFont options were not stored on the kernel dialog state");
  }
  const result: ChooseFontResult | null = {
    faceName: "Times New Roman",
    pointSize: 14,
    weight: 700,
    bold: true,
    italic: false,
    underline: true,
    strikeout: false,
    lfHeight: -19,
  };
  kernel.activeFontDialog.resolve(result);
  const resolved = await dialogPromise;
  if (!resolved || resolved.faceName !== "Times New Roman" || resolved.pointSize !== 14) {
    throw new Error("ChooseFont promise did not resolve with the dialog result");
  }
  if (kernel.activeFontDialog !== null) {
    throw new Error("activeFontDialog should be cleared after resolution");
  }
  console.log("\u2713 ChooseFont opens, resolves the caller, and clears the dialog state");

  console.log("\nALL FONT DIALOG TESTS PASSED! \ud83d\udd24\ud83c\udf89");
}

runFontDialogTests().catch((e) => {
  console.error(e);
  process.exit(1);
});
