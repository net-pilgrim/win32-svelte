import * as fs from "node:fs";
import * as path from "node:path";
import {
  SvgMetafile,
  MetafileSvgRecorder,
  parseEmfToSvg,
  parseWmfToSvg,
} from "../metafile_svg";
import { Win32WasmRuntime } from "../wasm_bridge";
import { getSampleAppWasmBytes } from "../../wasm/sample_app_wasm";

async function runMetafileSvgTests() {
  console.log("Starting Win32 Metafile (EMF/WMF) SVG Vector Engine Tests...\n");

  const wasmFilesDir = path.resolve(process.cwd(), "public/wasm-files");

  // --- Test 1: Real EMF parsing and SVG generation for all 7 Chap18 test files ---
  console.log("Test 1: Parsing binary EMF files and verifying SVG vector generation...");
  const emfFiles = [
    { name: "emf2.emf", minCommands: 2, desc: "cross & rect" },
    { name: "emf3.emf", minCommands: 2, desc: "colored cross & brush" },
    { name: "emf4.emf", minCommands: 1, desc: "stretch image" },
    { name: "emf7.emf", minCommands: 3, desc: "transformed metafile" },
    { name: "emf8.emf", minCommands: 50, desc: "ruler with ticks & text" },
    { name: "emf11.emf", minCommands: 50, desc: "metric ruler" },
    { name: "emf12.emf", minCommands: 50, desc: "inch ruler" },
  ];

  for (const item of emfFiles) {
    const filePath = path.join(wasmFilesDir, item.name);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Test file not found: ${filePath}`);
    }
    const buf = fs.readFileSync(filePath);
    const data = new Uint8Array(buf);
    const metafile = parseEmfToSvg(data, item.name);

    if (metafile.type !== "enhmetafile") {
      throw new Error(`Expected enhmetafile type for ${item.name}`);
    }
    if (metafile.bounds.right <= metafile.bounds.left) {
      throw new Error(`Invalid bounds for ${item.name}: ${JSON.stringify(metafile.bounds)}`);
    }

    const svg = metafile.toSvg();
    if (!svg.startsWith("<svg") || !svg.endsWith("</svg>")) {
      throw new Error(`Invalid SVG markup generated for ${item.name}`);
    }
    if (!svg.includes("viewBox=")) {
      throw new Error(`Missing viewBox in SVG for ${item.name}`);
    }

    console.log(`  ✓ ${item.name}: ${metafile.commands.length} vector commands, bounds (${metafile.bounds.left},${metafile.bounds.top},${metafile.bounds.right},${metafile.bounds.bottom}), SVG size: ${svg.length} chars`);
  }

  // Check specific content of emf8.emf (ruler with inch numbers)
  const emf8Buf = fs.readFileSync(path.join(wasmFilesDir, "emf8.emf"));
  const emf8 = parseEmfToSvg(new Uint8Array(emf8Buf), "emf8.emf");
  const emf8Svg = emf8.toSvg();
  const textCommands = emf8.commands.filter((c) => c.type === "text");
  if (textCommands.length < 5) {
    throw new Error(`Expected at least 5 text commands in emf8.emf, found ${textCommands.length}`);
  }
  const texts = textCommands.map((c: any) => c.text);
  if (!texts.includes("1") || !texts.includes("2") || !texts.includes("3") || !texts.includes("4") || !texts.includes("5")) {
    throw new Error(`Missing ruler numbers in emf8.emf: ${texts.join(", ")}`);
  }
  console.log(`✓ emf8.emf ruler text verified: [${texts.join(", ")}]`);

  // --- Test 2: 16-bit WMF Parsing (Standard & Aldus Placeable Header) ---
  console.log("\nTest 2: Parsing 16-bit WMF files (Aldus Placeable & standard)...");

  // Construct a synthetic Aldus Placeable WMF
  const apmWmf = new Uint8Array(22 + 18 + 6 * 4); // 22 APM + 18 WMF header + 4 records
  const dv = new DataView(apmWmf.buffer);

  // Aldus Placeable Header (22 bytes)
  dv.setUint32(0, 0x9ac6cdd7, true); // key
  dv.setInt16(4, 0, true);           // hmf
  dv.setInt16(6, 0, true);           // left
  dv.setInt16(8, 0, true);           // top
  dv.setInt16(10, 800, true);        // right
  dv.setInt16(12, 600, true);        // bottom
  dv.setUint16(14, 1000, true);      // inch
  dv.setUint32(16, 0, true);         // reserved
  dv.setUint16(20, 0, true);         // checksum

  // WMF Header (18 bytes at offset 22)
  dv.setUint16(22, 1, true);         // mtType (memory)
  dv.setUint16(24, 9, true);         // mtHeaderSize
  dv.setUint16(26, 0x0300, true);    // mtVersion
  dv.setUint32(28, apmWmf.byteLength / 2, true); // mtSize
  dv.setUint16(32, 1, true);         // mtNoObjects
  dv.setUint32(34, 10, true);        // mtMaxRecord

  // Record 1 at offset 40: META_RECTANGLE (0x041B)
  // WMF parameter order: bottom, right, top, left
  dv.setUint32(40, 7, true);         // rdSize (7 words = 14 bytes)
  dv.setUint16(44, 0x041b, true);     // META_RECTANGLE
  dv.setInt16(46, 200, true);        // bottom
  dv.setInt16(48, 300, true);        // right
  dv.setInt16(50, 50, true);         // top
  dv.setInt16(52, 50, true);         // left

  // Record 2 at offset 54: META_EOF (0x0000)
  dv.setUint32(54, 3, true);         // rdSize (3 words = 6 bytes)
  dv.setUint16(58, 0x0000, true);     // META_EOF

  const parsedWmf = parseWmfToSvg(apmWmf, "sample.wmf");
  if (parsedWmf.type !== "metafile") {
    throw new Error("Expected metafile type for WMF");
  }
  if (parsedWmf.bounds.right !== 800 || parsedWmf.bounds.bottom !== 600) {
    throw new Error(`Unexpected bounds in APM WMF: ${JSON.stringify(parsedWmf.bounds)}`);
  }
  const rectCmd = parsedWmf.commands.find((c) => c.type === "rect");
  if (!rectCmd || rectCmd.type !== "rect" || rectCmd.x !== 50 || rectCmd.y !== 50 || rectCmd.w !== 250 || rectCmd.h !== 150) {
    throw new Error(`Unexpected rect command in WMF: ${JSON.stringify(rectCmd)}`);
  }
  const wmfSvg = parsedWmf.toSvg();
  if (!wmfSvg.includes('<rect x="50" y="50" width="250" height="150"')) {
    throw new Error(`Missing expected rect in WMF SVG: ${wmfSvg}`);
  }
  console.log("✓ Aldus Placeable WMF successfully parsed into SVG vector commands");

  // --- Test 3: Live GDI Metafile SVG Recorder ---
  console.log("\nTest 3: Testing live GDI Metafile SVG Recorder...");
  const recorder = new MetafileSvgRecorder("enhmetafile", "test_recorded.emf", "Recorded Test Metafile");

  recorder.setPen("#ff0000", 3);
  recorder.setBrush("#00ff00");
  recorder.recordRectangle(10, 20, 110, 120);

  recorder.setPen("#0000ff", 2);
  recorder.setBrush("#ffff00");
  recorder.recordEllipse(150, 30, 250, 130);

  recorder.recordMoveTo(50, 200);
  recorder.recordLineTo(150, 250);

  recorder.recordPolyline([
    { x: 200, y: 200 },
    { x: 250, y: 220 },
    { x: 300, y: 190 },
  ]);

  recorder.recordPolygon([
    { x: 350, y: 200 },
    { x: 400, y: 250 },
    { x: 320, y: 250 },
  ]);

  recorder.recordPolyBezier([
    { x: 10, y: 300 },
    { x: 40, y: 350 },
    { x: 80, y: 350 },
    { x: 110, y: 300 },
  ]);

  recorder.setTextColor("#ff00ff");
  recorder.recordTextOut(200, 320, "Crisp Vector SVG");

  const recorded = recorder.close();
  if (recorded.commands.length !== 7) {
    throw new Error(`Expected 7 commands in recorded metafile, got ${recorded.commands.length}`);
  }

  const recordedSvg = recorded.toSvg();
  if (!recordedSvg.includes('<rect x="10" y="20"') ||
      !recordedSvg.includes('<ellipse cx="200" cy="80"') ||
      !recordedSvg.includes('<line x1="50" y1="200" x2="150" y2="250"') ||
      !recordedSvg.includes('<polyline points="200,200 250,220 300,190"') ||
      !recordedSvg.includes('<polygon points="350,200 400,250 320,250"') ||
      !recordedSvg.includes('<path d="M 10 300 C 40 350, 80 350, 110 300"') ||
      !recordedSvg.includes('Crisp Vector SVG')) {
    throw new Error(`Incomplete recorded SVG markup:\n${recordedSvg}`);
  }
  console.log("✓ Live Metafile SVG Recorder captured all vector primitives (rect, ellipse, line, polyline, polygon, bezier, text)");

  // --- Test 4: Direct Vector Affine Canvas Rendering ---
  console.log("\nTest 4: Testing direct vector affine rendering to Canvas context...");
  const executedCalls: string[] = [];
  const mockCtx: any = {
    save: () => executedCalls.push("save"),
    restore: () => executedCalls.push("restore"),
    translate: (x: number, y: number) => executedCalls.push(`translate(${x},${y})`),
    scale: (sx: number, sy: number) => executedCalls.push(`scale(${sx.toFixed(2)},${sy.toFixed(2)})`),
    beginPath: () => executedCalls.push("beginPath"),
    closePath: () => executedCalls.push("closePath"),
    moveTo: (x: number, y: number) => executedCalls.push(`moveTo(${x},${y})`),
    lineTo: (x: number, y: number) => executedCalls.push(`lineTo(${x},${y})`),
    bezierCurveTo: () => executedCalls.push("bezierCurveTo"),
    stroke: () => executedCalls.push("stroke"),
    fill: () => executedCalls.push("fill"),
    fillRect: (x: number, y: number, w: number, h: number) => executedCalls.push(`fillRect(${x},${y},${w},${h})`),
    strokeRect: (x: number, y: number, w: number, h: number) => executedCalls.push(`strokeRect(${x},${y},${w},${h})`),
    fillText: (text: string, x: number, y: number) => executedCalls.push(`fillText(${text},${x},${y})`),
    ellipse: () => executedCalls.push("ellipse"),
    arc: () => executedCalls.push("arc"),
  };

  recorded.renderToCanvas(mockCtx, { left: 100, top: 100, right: 900, bottom: 700 });
  if (!executedCalls.includes("save") || !executedCalls.includes("restore") || !executedCalls.some((c) => c.startsWith("scale("))) {
    throw new Error(`Expected affine transform calls, got: ${executedCalls.join(", ")}`);
  }
  if (!executedCalls.includes("fillRect(10,20,100,100)") || !executedCalls.includes("fillText(Crisp Vector SVG,200,320)")) {
    throw new Error(`Expected vector drawing calls on canvas, got: ${executedCalls.join(", ")}`);
  }
  console.log("✓ Direct vector affine Canvas rendering executed crisp scalable drawing calls");

  // --- Test 5: WASM Bridge Win32 GDI Integration ---
  console.log("\nTest 5: Testing WASM Bridge Win32 Metafile APIs...");
  const runtime = new Win32WasmRuntime();
  await runtime.instantiate(getSampleAppWasmBytes());
  const imports = runtime.getImportObject().win32 as any;

  // Test CreateEnhMetaFile -> Draw -> CloseEnhMetaFile
  const hdcEmf = imports.CreateEnhMetaFileA(0, 0, 0, 0);
  if (!hdcEmf) throw new Error("CreateEnhMetaFileA returned null handle");

  const hPen = imports.CreatePen(0, 2, 0x00ff0000); // Blue pen
  const hBrush = imports.CreateSolidBrush(0x0000ff00); // Green brush
  imports.SelectObject(hdcEmf, hPen);
  imports.SelectObject(hdcEmf, hBrush);

  imports.Rectangle(hdcEmf, 10, 10, 200, 150);
  imports.Ellipse(hdcEmf, 50, 50, 150, 120);

  const hemf = imports.CloseEnhMetaFile(hdcEmf);
  if (!hemf) throw new Error("CloseEnhMetaFile returned null handle");

  // Test PlayEnhMetaFile into target DC
  const hdcTarget = imports.CreateDCA();
  const resPlay = imports.PlayEnhMetaFile(hdcTarget, hemf, 0);
  if (!resPlay) throw new Error("PlayEnhMetaFile failed");

  // Test GetEnhMetaFileA with preloaded / existing file
  const hEmf8 = imports.GetEnhMetaFileA(0); // sample
  if (!hEmf8) throw new Error("GetEnhMetaFileA failed");

  // Allocate memory for header test
  const lpHeader = (runtime as any).allocateMemory(108);
  const hdrRes = imports.GetEnhMetaFileHeader(hEmf8, 108, lpHeader);
  if (hdrRes !== 108) throw new Error(`Unexpected header size: ${hdrRes}`);

  const view = new DataView((runtime as any).memory.buffer);
  const sig = view.getUint32(lpHeader + 40, true);
  if (sig !== 0x464d4520) {
    throw new Error(`Unexpected EMF signature: 0x${sig.toString(16)}`);
  }

  imports.DeleteEnhMetaFile(hemf);
  imports.DeleteEnhMetaFile(hEmf8);
  imports.DeleteDC(hdcTarget);
  runtime.destroy();
  console.log("✓ WASM Bridge Metafile creation, vector recording, header querying, and playback verified");

  console.log("\nALL WIN32 METAFILE (EMF/WMF) SVG VECTOR TESTS PASSED! 🖼️⚡🎉\n");
}

runMetafileSvgTests().catch((err) => {
  console.error("Metafile SVG test failed:", err);
  process.exit(1);
});
