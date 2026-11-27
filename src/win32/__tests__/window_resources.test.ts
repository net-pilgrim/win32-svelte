import assert from "node:assert";
import { kernel, CreateWindowEx, DestroyWindow } from "../kernel.svelte";
import { LoadMenu, LoadString, resolveResourceBundle } from "../dialog";
import type { ResourceBundle } from "../../rc/types";

async function testWindowResources() {
  console.log("=== Testing Window-Owned Private Resource Management ===");

  const bundleA: ResourceBundle = {
    dialogs: {},
    menus: {
      MAIN_MENU: {
        id: "MAIN_MENU",
        name: "MAIN_MENU",
        items: [
          { text: "App_A_File", flags: 0, id: 101 },
          { text: "App_A_Edit", flags: 0, id: 102 },
        ],
      },
    },
    stringTable: {
      100: "String from App A",
    },
    accelerators: {},
    icons: {},
    bitmaps: {},
    symbols: {},
  };

  const bundleB: ResourceBundle = {
    dialogs: {},
    menus: {
      MAIN_MENU: {
        id: "MAIN_MENU",
        name: "MAIN_MENU",
        items: [
          { text: "App_B_Properties", flags: 0, id: 201 },
          { text: "App_B_Info", flags: 0, id: 202 },
        ],
      },
    },
    stringTable: {
      100: "String from App B",
    },
    accelerators: {},
    icons: {},
    bitmaps: {},
    symbols: {},
  };

  // Register window class for test
  kernel.RegisterClassEx({
    className: "TEST_WINDOW_CLASS",
    lpfnWndProc: () => 0,
  });

  // 1. Create Window A owning bundleA
  const hwndA = CreateWindowEx(
    0,
    "TEST_WINDOW_CLASS",
    "Window A",
    0x10000000 /* WS_VISIBLE */,
    0, 0, 200, 200,
    null,
    null,
    bundleA
  );
  assert(hwndA > 0, "Failed to create Window A");
  const winA = kernel.getWindow(hwndA);
  assert(winA?.resourceBundle === bundleA, "Window A does not directly own bundleA");
  console.log("✓ Window A created with private ownership of bundleA");

  // 2. Create Window B owning bundleB
  const hwndB = CreateWindowEx(
    0,
    "TEST_WINDOW_CLASS",
    "Window B",
    0x10000000 /* WS_VISIBLE */,
    0, 0, 200, 200,
    null,
    null,
    bundleB
  );
  assert(hwndB > 0, "Failed to create Window B");
  const winB = kernel.getWindow(hwndB);
  assert(winB?.resourceBundle === bundleB, "Window B does not directly own bundleB");
  console.log("✓ Window B created with private ownership of bundleB");

  // 3. Create Child Control inside Window A
  const hwndChildA = CreateWindowEx(
    0,
    "BUTTON",
    "Button in A",
    0x50000000 /* WS_CHILD | WS_VISIBLE */,
    10, 10, 80, 25,
    hwndA,
    1001
  );
  assert(hwndChildA > 0, "Failed to create child button in Window A");
  const childA = kernel.getWindow(hwndChildA);
  assert(childA?.resourceBundle === bundleA, "Child control did not inherit Window A's resource bundle");
  assert(kernel.getWindowResourceBundle(hwndChildA) === bundleA, "getWindowResourceBundle failed for child control");
  console.log("✓ Child control in Window A automatically inherited private ownership of bundleA");

  // 4. Test LoadMenu delegation
  const hMenuA = LoadMenu(hwndA, "MAIN_MENU");
  assert(hMenuA, "Failed to load MAIN_MENU for Window A");
  const menuRecordA = kernel.GetMenuRecord(hMenuA);
  assert(menuRecordA?.items[0].text === "App_A_File", `Window A loaded wrong menu: ${menuRecordA?.items[0].text}`);
  console.log("✓ LoadMenu(hwndA, 'MAIN_MENU') resolved Window A's private menu ('App_A_File')");

  const hMenuB = LoadMenu(hwndB, "MAIN_MENU");
  assert(hMenuB, "Failed to load MAIN_MENU for Window B");
  const menuRecordB = kernel.GetMenuRecord(hMenuB);
  assert(menuRecordB?.items[0].text === "App_B_Properties", `Window B loaded wrong menu: ${menuRecordB?.items[0].text}`);
  console.log("✓ LoadMenu(hwndB, 'MAIN_MENU') resolved Window B's private menu ('App_B_Properties')");

  const hMenuChildA = LoadMenu(hwndChildA, "MAIN_MENU");
  assert(hMenuChildA, "Failed to load MAIN_MENU for child control");
  const menuRecordChildA = kernel.GetMenuRecord(hMenuChildA);
  assert(menuRecordChildA?.items[0].text === "App_A_File", "Child control did not delegate to parent Window A's menu");
  console.log("✓ LoadMenu(hwndChildA, 'MAIN_MENU') delegated to Window A's private menu");

  // 5. Test LoadString delegation
  const strA = LoadString(hwndA, 100);
  assert.strictEqual(strA, "String from App A", "LoadString for Window A returned wrong string");
  console.log("✓ LoadString(hwndA, 100) returned Window A's private string");

  const strB = LoadString(hwndB, 100);
  assert.strictEqual(strB, "String from App B", "LoadString for Window B returned wrong string");
  console.log("✓ LoadString(hwndB, 100) returned Window B's private string");

  const strChildA = LoadString(hwndChildA, 100);
  assert.strictEqual(strChildA, "String from App A", "LoadString for child control did not return Window A's string");
  console.log("✓ LoadString(hwndChildA, 100) delegated to Window A's private string");

  // Cleanup
  DestroyWindow(hwndChildA);
  DestroyWindow(hwndA);
  DestroyWindow(hwndB);
  console.log("✓ Cleaned up test windows");

  console.log("\n🎉 ALL WINDOW-OWNED PRIVATE RESOURCE TESTS PASSED! 🛡️✨\n");
}

testWindowResources().then(() => {
  process.exit(0);
}).catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
