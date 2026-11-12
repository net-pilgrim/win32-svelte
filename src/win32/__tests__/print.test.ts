if (typeof (globalThis as any).$state === "undefined") {
  (globalThis as any).$state = (v: any) => v;
}

import {
  CreateDC,

  DeleteDC,
  StartDoc,
  StartPage,
  EndPage,
  EndDoc,
  AbortDoc,
  PrinterHDC,
  PrintTextDocument,
} from "../print";
import { Rectangle, TextOut, MoveToEx, LineTo } from "../gdi";

async function runPrintTests() {
  console.log("Starting Win32 Print Spooler Tests...\n");

  // Test 1: CreateDC with WINSPOOL driver
  console.log("Test 1: CreateDC('WINSPOOL')...");
  const hdc = CreateDC("WINSPOOL", "HP LaserJet 4") as PrinterHDC;
  if (!hdc || !(hdc instanceof PrinterHDC)) {
    throw new Error("CreateDC('WINSPOOL') did not return a PrinterHDC");
  }
  if (hdc.printerName !== "HP LaserJet 4") {
    throw new Error(`Expected printerName 'HP LaserJet 4', got '${hdc.printerName}'`);
  }
  console.log("✓ PrinterHDC successfully created");

  // Test 2: Document Spooling Lifecycle (StartDoc, StartPage, EndPage, EndDoc)
  console.log("Test 2: Document Spooling (Multi-page)...");
  const jobId = StartDoc(hdc, { lpszDocName: "Quarterly_Report_1998.txt" });
  if (jobId <= 0 || !hdc.inDoc) {
    throw new Error(`StartDoc failed, got jobId: ${jobId}`);
  }

  // --- Page 1 ---
  const page1Ok = StartPage(hdc);
  if (!page1Ok || !hdc.inPage || hdc.pages.length !== 1) {
    throw new Error("StartPage 1 failed");
  }

  // Draw GDI primitives on page 1
  Rectangle(hdc, 20, 20, 780, 100);
  TextOut(hdc, 30, 40, "Quarterly Report 1998 - Page 1");
  MoveToEx(hdc, 30, 80);
  LineTo(hdc, 770, 80);

  const endPage1Ok = EndPage(hdc);
  if (!endPage1Ok || hdc.inPage) {
    throw new Error("EndPage 1 failed");
  }

  // --- Page 2 ---
  const page2Ok = StartPage(hdc);
  if (!page2Ok || !hdc.inPage || (hdc.pages.length as number) !== 2) {
    throw new Error("StartPage 2 failed");
  }


  TextOut(hdc, 30, 40, "Quarterly Report 1998 - Page 2");
  const endPage2Ok = EndPage(hdc);
  if (!endPage2Ok || hdc.inPage) {
    throw new Error("EndPage 2 failed");
  }

  // Complete document
  const endDocOk = EndDoc(hdc);
  if (!endDocOk || hdc.inDoc) {
    throw new Error("EndDoc failed");
  }
  if ((hdc.pages.length as number) !== 2) {
    throw new Error(`Expected 2 spooled pages, got ${hdc.pages.length}`);
  }

  console.log(`✓ Document spooled successfully with ${hdc.pages.length} pages`);

  // Test 3: AbortDoc
  console.log("Test 3: AbortDoc...");
  StartDoc(hdc, { lpszDocName: "Cancelled Doc" });
  StartPage(hdc);
  AbortDoc(hdc);
  if (hdc.inDoc || hdc.inPage || (hdc.pages.length as number) !== 0) {
    throw new Error("AbortDoc did not properly clear active job");
  }

  console.log("✓ AbortDoc successfully cleaned up job");

  // Test 4: PrintTextDocument routine (simulating multi-page text document)
  console.log("Test 4: PrintTextDocument layout and pagination...");
  const sampleLines = Array.from({ length: 120 }, (_, i) => `Line ${i + 1}: The quick brown fox jumps over the lazy dog.`);
  const sampleText = sampleLines.join("\n");

  // In test environment, mode="print" completes spooling and invokes TriggerBrowserPrint
  await PrintTextDocument(sampleText, "Sample Report", "print");
  console.log("✓ PrintTextDocument completed pagination and spooling");

  DeleteDC(hdc);
  console.log("\nALL PRINT SUBSYSTEM TESTS PASSED! 🖨️🎉");
}

runPrintTests().catch((err) => {
  console.error("Print test failed:", err);
  process.exit(1);
});
