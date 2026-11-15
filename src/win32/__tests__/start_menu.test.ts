import menuData from "../../../startmenu.json";
import { formatMnemonic, createActionHandlers } from "../ui/start_menu_utils";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runStartMenuTests() {
  console.log("Starting Win32 Start Menu De-Bevel & Integration Tests...\n");

  // Test 1: Mnemonic Formatter
  console.log("Test 1: Mnemonic Formatter (formatMnemonic)...");
  if (formatMnemonic("Programs", "P") !== "<u>P</u>rograms") {
    throw new Error(`Expected '<u>P</u>rograms', got '${formatMnemonic("Programs", "P")}'`);
  }
  if (formatMnemonic("Shut Down...", "U") !== "Sh<u>u</u>t Down...") {
    throw new Error(`Expected 'Sh<u>u</u>t Down...', got '${formatMnemonic("Shut Down...", "U")}'`);
  }
  if (formatMnemonic("Documents", "D") !== "<u>D</u>ocuments") {
    throw new Error(`Expected '<u>D</u>ocuments', got '${formatMnemonic("Documents", "D")}'`);
  }
  if (formatMnemonic("No Mnemonic") !== "No Mnemonic") {
    throw new Error(`Expected 'No Mnemonic', got '${formatMnemonic("No Mnemonic")}'`);
  }
  console.log("✓ Mnemonic underlines formatted correctly");

  // Test 2: Start Menu JSON Data Validation
  console.log("Test 2: Validating startmenu.json structure...");
  const dummyToggle = () => {};
  const dummyClose = () => {};
  const handlers = createActionHandlers(dummyToggle, dummyClose);

  const items = menuData as any[];
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("startmenu.json is empty or not an array");
  }

  const ids = new Set<string>();
  let hasPrograms = false;
  let hasShutdown = false;
  let hasSettings = false;

  for (const item of items) {
    if (item.id) ids.add(item.id);
    if (item.id === "programs") hasPrograms = true;
    if (item.id === "shutdown") hasShutdown = true;
    if (item.id === "settings") hasSettings = true;

    if (item.items) {
      for (const sub of item.items) {
        if (sub.id) ids.add(sub.id);
        if (sub.action && !handlers[sub.action]) {
          throw new Error(`Submenu item '${sub.id}' points to unknown action '${sub.action}'`);
        }
      }
    } else if (item.action && !handlers[item.action]) {
      throw new Error(`Item '${item.id}' points to unknown action '${item.action}'`);
    }
  }

  if (!hasPrograms || !hasShutdown || !hasSettings) {
    throw new Error("Missing essential Start Menu items (programs, settings, or shutdown)");
  }
  console.log(`✓ Verified ${items.length} top-level entries and submenus against registered actions`);

  // Test 3: Action Handlers Dictionary Coverage
  console.log("Test 3: Checking action handlers coverage...");
  const expectedActions = [
    "explorer",
    "wasm",
    "lua",
    "doom",
    "minesweeper",
    "paint",
    "notepad",
    "calculator",
    "mfc",
    "rc",
    "odbc",
    "isql",
    "control_gallery",
    "inspector",
    "toggle_sound",
    "shutdown",
  ];

  for (const action of expectedActions) {
    if (typeof handlers[action] !== "function") {
      throw new Error(`Missing expected action handler: ${action}`);
    }
  }
  console.log(`✓ All ${expectedActions.length} action handlers are registered`);

  // Test 4: Verify CSS De-Beveling Invariants in StartMenu.svelte
  console.log("Test 4: Verifying StartMenu.svelte flat style rules & de-beveling...");
  const sveltePath = path.resolve(__dirname, "../ui/StartMenu.svelte");
  const svelteContent = fs.readFileSync(sveltePath, "utf-8");

  // Invariant 1: Flat is default prop
  if (!svelteContent.includes("flat = true")) {
    throw new Error("StartMenu.svelte must default flat prop to true");
  }

  // Invariant 2: Flat mode strips box-shadow on items and active states
  if (!svelteContent.includes(".start-menu-container.flat .start-item")) {
    throw new Error("Missing .start-menu-container.flat rules in StartMenu.svelte");
  }
  if (!svelteContent.includes("box-shadow: none !important")) {
    throw new Error("Flat rules must override 98.css button box-shadow with box-shadow: none !important");
  }

  // Invariant 3: Focus and highlight colors
  if (!svelteContent.includes("--win98-highlight")) {
    throw new Error("Missing --win98-highlight CSS variable support in StartMenu.svelte");
  }

  // Invariant 4: Beveled legacy mode preserved
  if (!svelteContent.includes(".start-menu-container.beveled")) {
    throw new Error("Legacy beveled mode should be preserved for opt-in");
  }
  console.log("✓ De-beveling rules, CSS variables, and flat defaults verified");

  console.log("\nALL START MENU TESTS PASSED! 🪟⚡🎉\n");
}

runStartMenuTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
