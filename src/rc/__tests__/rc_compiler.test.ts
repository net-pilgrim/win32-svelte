import assert from "node:assert";
import { compileRcSync } from "../compiler.ts";
import { RcLexer } from "../lexer.ts";
import { RcPreprocessor } from "../preprocessor.ts";
import { RcParser } from "../parser.ts";
import { dluToPixelsX, dluToPixelsY } from "../dlu.ts";

function runTests() {
  console.log("Running RC Compiler tests...");

  // 1. Lexer Test
  {
    const source = `
      // Comment
      /* Multi-line
         comment */
      #define IDD_TEST 100
      "Hello \\"World\\""
      0x1A 42 -5
      WS_POPUP | WS_CAPTION
    `;
    const lexer = new RcLexer(source);
    const tokens = lexer.tokenize();

    assert(tokens.some((t) => t.type === "DIRECTIVE" && t.value === "define"));
    assert(tokens.some((t) => t.type === "STRING" && t.value === 'Hello "World"'));
    assert(tokens.some((t) => t.type === "NUMBER" && t.numberValue === 0x1a));
    assert(tokens.some((t) => t.type === "NUMBER" && t.numberValue === 42));
    assert(tokens.some((t) => t.type === "NUMBER" && t.numberValue === -5));
    assert(tokens.some((t) => t.type === "PUNCTUATOR" && t.value === "|"));
    console.log("✓ Lexer passed");
  }

  // 2. Preprocessor Test
  {
    const source = `
      #define BASE 100
      #define IDD_MY_DIALOG (BASE + 5)
      #ifdef IDD_MY_DIALOG
      #define FEATURE_ACTIVE 1
      #else
      #define FEATURE_ACTIVE 0
      #endif
    `;
    const preprocessor = new RcPreprocessor();
    const result = preprocessor.processSync(source);

    assert.strictEqual(result.symbols["BASE"], 100);
    assert.strictEqual(result.symbols["IDD_MY_DIALOG"], 105);
    assert.strictEqual(result.symbols["FEATURE_ACTIVE"], 1);
    console.log("✓ Preprocessor passed");
  }

  // 3. Parser & Dialog Test
  {
    const source = `
      #define IDD_ABOUT 200
      #define IDC_STATIC -1
      #define IDOK 1
      IDD_ABOUT DIALOGEX 0, 0, 160, 80
      STYLE DS_MODALFRAME | WS_POPUP | WS_CAPTION | WS_SYSMENU
      CAPTION "About Us"
      FONT 8, "MS Sans Serif"
      BEGIN
          ICON            "IDI_APP",IDC_STATIC,10,10,20,20
          LTEXT           "Test Application v1.0",IDC_STATIC,40,10,100,8
          DEFPUSHBUTTON   "OK",IDOK,100,55,50,14,WS_GROUP
      END
    `;
    const res = compileRcSync(source);
    assert(res.bundle.dialogs["IDD_ABOUT"]);
    const dlg = res.bundle.dialogs["IDD_ABOUT"];
    assert.strictEqual(dlg.caption, "About Us");
    assert.strictEqual(dlg.width, 160);
    assert.strictEqual(dlg.height, 80);
    assert.strictEqual(dlg.font?.pointSize, 8);
    assert.strictEqual(dlg.font?.typeface, "MS Sans Serif");
    assert.strictEqual(dlg.controls.length, 3);
    assert.strictEqual(dlg.controls[0].type, "ICON");
    assert.strictEqual(dlg.controls[1].type, "LTEXT");
    assert.strictEqual(dlg.controls[2].type, "DEFPUSHBUTTON");
    assert.strictEqual(dlg.controls[2].id, 1);
    console.log("✓ Parser Dialog passed");
  }

  // 4. Menu & StringTable Test
  {
    const source = `
      #define IDR_MENU1 300
      #define ID_FILE_EXIT 4001
      #define IDS_TITLE 5001

      IDR_MENU1 MENU
      BEGIN
          POPUP "&File"
          BEGIN
              MENUITEM "E&xit", ID_FILE_EXIT
              MENUITEM SEPARATOR
          END
      END

      STRINGTABLE
      BEGIN
          IDS_TITLE "My Sample Title"
      END
    `;
    const res = compileRcSync(source);
    assert(res.bundle.menus["IDR_MENU1"]);
    const menu = res.bundle.menus["IDR_MENU1"];
    assert.strictEqual(menu.items.length, 1);
    assert.strictEqual(menu.items[0].text, "&File");
    assert(menu.items[0].subItems && menu.items[0].subItems.length === 2);
    assert.strictEqual(menu.items[0].subItems[0].text, "E&xit");
    assert.strictEqual(menu.items[0].subItems[0].id, 4001);
    assert.strictEqual(menu.items[0].subItems[1].isSeparator, true);

    assert.strictEqual(res.bundle.stringTable[5001], "My Sample Title");
    console.log("✓ Menu and StringTable passed");
  }

  // 5. DLU Conversion Test
  {
    // 8pt MS Sans Serif: baseUnitX = 7, baseUnitY = 14
    // 50 DLUs x = (50 * 7) / 4 = 88 px
    // 14 DLUs y = (14 * 14) / 8 = 25 px
    const pxX = dluToPixelsX(50, { pointSize: 8, typeface: "MS Sans Serif" });
    const pxY = dluToPixelsY(14, { pointSize: 8, typeface: "MS Sans Serif" });
    assert(pxX >= 75 && pxX <= 90);
    assert(pxY >= 20 && pxY <= 26);
    console.log("✓ DLU calculations passed");
  }

  console.log("\nALL TESTS PASSED SUCCESSFULLY! 🎉\n");
}

runTests();
