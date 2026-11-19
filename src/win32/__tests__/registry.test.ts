import {
  registry,
  RegOpenKeyEx,
  RegCreateKeyEx,
  RegCloseKey,
  RegQueryValueEx,
  RegSetValueEx,
  RegDeleteValue,
  RegDeleteKey,
  RegEnumKeyEx,
  RegEnumValue,
  RegExport,
  RegImport,
} from "../registry";
import {
  HKEY_CLASSES_ROOT,
  HKEY_CURRENT_USER,
  HKEY_LOCAL_MACHINE,
  REG_SZ,
  REG_DWORD,
  REG_BINARY,
  ERROR_SUCCESS,
  ERROR_FILE_NOT_FOUND,
  ERROR_NO_MORE_ITEMS,
  REG_CREATED_NEW_KEY,
  REG_OPENED_EXISTING_KEY,
} from "../constants";
import { Win32LuaRuntime } from "../lua_engine";

async function runRegistryTests() {
  console.log("Starting Win32 Windows Registry Subsystem Tests...\n");

  // Test 1: Verify Pre-seeded Keys & Values
  console.log("Test 1: Verifying default pre-seeded registry hives...");
  const phk = { val: 0 };
  let status = RegOpenKeyEx(HKEY_LOCAL_MACHINE, "Software\\Microsoft\\Windows\\CurrentVersion", 0, 0, phk);
  if (status !== ERROR_SUCCESS || phk.val === 0) {
    throw new Error(`Failed to open HKLM CurrentVersion key (status: ${status})`);
  }

  const pType = { val: 0 };
  const pData = { val: null as any };
  status = RegQueryValueEx(phk.val, "ProductName", 0, pType, pData);
  if (status !== ERROR_SUCCESS || pData.val !== "Microsoft Windows 98") {
    throw new Error(`Expected ProductName 'Microsoft Windows 98', got '${pData.val}'`);
  }
  console.log(`✓ Read HKLM ProductName: "${pData.val}" (REG_SZ)`);
  RegCloseKey(phk.val);

  // Test 2: Pre-seeded HKCU Desktop & Colors
  console.log("Test 2: Verifying HKCU settings...");
  const bg = registry.getString(HKEY_CURRENT_USER, "Control Panel\\Colors", "Background");
  if (bg !== "0 128 128") {
    throw new Error(`Expected Background '0 128 128', got '${bg}'`);
  }
  console.log(`✓ Read HKCU Teal Background Color: "${bg}"`);

  // Test 3: Pre-seeded HKCR COM Classes
  console.log("Test 3: Verifying HKCR COM Classes...");
  const calcClsid = registry.getString(HKEY_CLASSES_ROOT, "Calc.Engine\\CLSID");
  if (calcClsid !== "{3B8A8820-2E24-11D1-A2A9-00A0C9062910}") {
    throw new Error(`Expected Calc.Engine CLSID, got '${calcClsid}'`);
  }
  console.log(`✓ Read HKCR Calc.Engine CLSID: "${calcClsid}"`);

  // Test 4: Key Creation & Value Modification
  console.log("Test 4: Testing RegCreateKeyEx and RegSetValueEx...");
  const phkNew = { val: 0 };
  const pDisp = { val: 0 };
  status = RegCreateKeyEx(
    HKEY_CURRENT_USER,
    "Software\\Win32Test\\Config",
    0,
    "",
    0,
    0,
    null,
    phkNew,
    pDisp
  );
  if (status !== ERROR_SUCCESS || phkNew.val === 0) {
    throw new Error(`RegCreateKeyEx failed (status: ${status})`);
  }
  if (pDisp.val !== REG_CREATED_NEW_KEY && pDisp.val !== REG_OPENED_EXISTING_KEY) {
    throw new Error(`Unexpected disposition: ${pDisp.val}`);
  }

  // Set String
  RegSetValueEx(phkNew.val, "ThemeName", 0, REG_SZ, "Retro98");
  // Set DWORD
  RegSetValueEx(phkNew.val, "RefreshRate", 0, REG_DWORD, 60);
  // Set Binary
  const testBytes = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
  RegSetValueEx(phkNew.val, "MagicBytes", 0, REG_BINARY, testBytes);

  // Query back
  const pTheme = { val: null as any };
  RegQueryValueEx(phkNew.val, "ThemeName", 0, pType, pTheme);
  if (pTheme.val !== "Retro98") throw new Error(`Expected 'Retro98', got '${pTheme.val}'`);

  const pRate = { val: null as any };
  RegQueryValueEx(phkNew.val, "RefreshRate", 0, pType, pRate);
  if (pRate.val !== 60) throw new Error(`Expected 60, got '${pRate.val}'`);

  const pMagic = { val: null as any };
  RegQueryValueEx(phkNew.val, "MagicBytes", 0, pType, pMagic);
  if (!(pMagic.val instanceof Uint8Array) || pMagic.val[0] !== 0xde || pMagic.val[3] !== 0xef) {
    throw new Error(`Binary bytes mismatch`);
  }
  console.log("✓ Created keys and wrote REG_SZ, REG_DWORD, and REG_BINARY values successfully");
  RegCloseKey(phkNew.val);

  // Test 5: Enumeration
  console.log("Test 5: Testing RegEnumKeyEx and RegEnumValue...");
  const phkEnum = { val: 0 };
  RegOpenKeyEx(HKEY_CURRENT_USER, "Software\\Win32Test\\Config", 0, 0, phkEnum);

  const enumVals: string[] = [];
  let idx = 0;
  while (true) {
    const vName = { val: "" };
    const eStatus = RegEnumValue(phkEnum.val, idx, vName);
    if (eStatus === ERROR_NO_MORE_ITEMS) break;
    if (eStatus !== ERROR_SUCCESS) throw new Error(`RegEnumValue failed at index ${idx}`);
    enumVals.push(vName.val);
    idx++;
  }
  if (!enumVals.includes("ThemeName") || !enumVals.includes("RefreshRate") || !enumVals.includes("MagicBytes")) {
    throw new Error(`Missing expected enumerated values: ${enumVals.join(", ")}`);
  }
  console.log(`✓ Successfully enumerated ${enumVals.length} values: [${enumVals.join(", ")}]`);
  RegCloseKey(phkEnum.val);

  // Test 6: Value & Key Deletion
  console.log("Test 6: Testing RegDeleteValue and RegDeleteKey...");
  const phkDel = { val: 0 };
  RegOpenKeyEx(HKEY_CURRENT_USER, "Software\\Win32Test\\Config", 0, 0, phkDel);
  status = RegDeleteValue(phkDel.val, "RefreshRate");
  if (status !== ERROR_SUCCESS) throw new Error("RegDeleteValue failed");

  const qDel = { val: null as any };
  if (RegQueryValueEx(phkDel.val, "RefreshRate", 0, undefined, qDel) !== ERROR_FILE_NOT_FOUND) {
    throw new Error("Expected RefreshRate to be deleted");
  }
  RegCloseKey(phkDel.val);

  // Delete subkey
  status = RegDeleteKey(HKEY_CURRENT_USER, "Software\\Win32Test\\Config");
  if (status !== ERROR_SUCCESS) throw new Error("RegDeleteKey failed");
  const checkKey = { val: 0 };
  if (RegOpenKeyEx(HKEY_CURRENT_USER, "Software\\Win32Test\\Config", 0, 0, checkKey) !== ERROR_FILE_NOT_FOUND) {
    throw new Error("Expected Software\\Win32Test\\Config to be deleted");
  }
  console.log("✓ Successfully deleted values and keys");

  // Test 7: .REG Export and Import
  console.log("Test 7: Testing standard .REG file Export and Import...");
  const exportText = RegExport("HKEY_LOCAL_MACHINE");
  if (!exportText.includes("Windows Registry Editor Version 5.00") || !exportText.includes("[HKEY_LOCAL_MACHINE\\Software\\Microsoft\\Windows\\CurrentVersion]")) {
    throw new Error("Export text missing required .REG syntax");
  }
  console.log("✓ Exported HKLM to valid .REG format");

  // Import custom .reg script
  const customReg = `Windows Registry Editor Version 5.00

[HKEY_CURRENT_USER\\Software\\ImportTestApp]
"AppTitle"="Imported Retro App"
"Version"=dword:00000002
"Flags"=hex:01,02,03,04
`;
  const impRes = RegImport(customReg);
  if (impRes.importedValues < 3) {
    throw new Error(`Expected at least 3 imported values, got ${impRes.importedValues}`);
  }
  const appTitle = registry.getString(HKEY_CURRENT_USER, "Software\\ImportTestApp", "AppTitle");
  const appVer = registry.getDword(HKEY_CURRENT_USER, "Software\\ImportTestApp", "Version");
  if (appTitle !== "Imported Retro App" || appVer !== 2) {
    throw new Error(`Import verification failed: title='${appTitle}', ver=${appVer}`);
  }
  console.log(`✓ Imported .REG successfully: AppTitle='${appTitle}', Version=${appVer}`);

  // Test 8: Lua 5.3 Registry Integration
  console.log("Test 8: Testing Lua 5.3 Win32 Registry APIs...");
  const runtime = new Win32LuaRuntime();
  const logs: string[] = [];
  runtime.onLog = (msg) => logs.push(msg.text);

  const luaScript = `
    local hKey = win32.RegOpenKey(win32.HKEY_LOCAL_MACHINE, "Software\\\\Microsoft\\\\Windows\\\\CurrentVersion")
    if not hKey then error("Failed to open HKLM key from Lua") end
    local prod, t = win32.RegQueryValue(hKey, "ProductName")
    print("Lua Read HKLM ProductName: " .. tostring(prod))
    win32.RegCloseKey(hKey)

    local hkNew = win32.RegCreateKey(win32.HKEY_CURRENT_USER, "Software\\\\LuaRegTest")
    win32.RegSetValue(hkNew, "ScriptAuthor", "Lua53")
    win32.RegSetValue(hkNew, "MaxScore", 9999, win32.REG_DWORD)
    win32.RegCloseKey(hkNew)

    local val, valType = win32.RegQueryValue(win32.HKEY_CURRENT_USER, "Software\\\\LuaRegTest", "ScriptAuthor")
    local score = win32.RegQueryValue(win32.HKEY_CURRENT_USER, "Software\\\\LuaRegTest", "MaxScore")
    print("Lua Query Value: Author=" .. tostring(val) .. ", Score=" .. tostring(score))
  `;

  const luaRes = runtime.execute(luaScript);
  if (!luaRes.success) throw new Error(`Lua Registry test failed: ${luaRes.error}`);

  if (!logs.some((l) => l.includes("Lua Read HKLM ProductName: Microsoft Windows 98"))) {
    throw new Error("Missing expected Lua HKLM log");
  }
  if (!logs.some((l) => l.includes("Author=Lua53, Score=9999"))) {
    throw new Error("Missing expected Lua RegTest log");
  }
  console.log("✓ Lua 5.3 successfully opened, queried, created, and modified registry keys!");

  runtime.dispose();
  console.log("\nALL WIN32 REGISTRY TESTS PASSED! 🗃️⚡🎉");
  process.exit(0);
}

runRegistryTests().catch((err) => {
  console.error("Registry Test Failed:", err);
  process.exit(1);
});
