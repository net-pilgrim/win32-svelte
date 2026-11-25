import { win32Midi, Win32MidiSubsystem, MMSYSERR_NOERROR, MOD_SWSYNTH } from "../midi";
import MIDI from "midi.js";
import { Win32WasmRuntime } from "../wasm_bridge";
import { kernel, SendMessage } from "../kernel.svelte";
import fs from "fs";

console.log("Starting Win32 MIDI.js & Audio Subsystem Tests...\n");

// Test 1: Verify MIDI.js import and GM tables
console.log("Test 1: Verifying MIDI.js library and GM catalog...");
if (!MIDI) {
  throw new Error("Failed to load MIDI.js");
}
const piano = MIDI.GM.byId[0];
const organ = MIDI.GM.byId[19];
if (!piano || piano.instrument !== "Acoustic Grand Piano") {
  throw new Error("Acoustic Grand Piano GM instrument mismatch");
}
if (!organ || organ.instrument !== "Church Organ") {
  throw new Error("Church Organ GM instrument mismatch");
}
console.log(`✓ MIDI.js loaded: GM #0 = '${piano.instrument}', GM #19 = '${organ.instrument}'`);

// Test 2: midiOutGetNumDevs & midiOutGetDevCapsA
console.log("\nTest 2: Testing midiOutGetNumDevs and midiOutGetDevCapsA...");
const numDevs = win32Midi.midiOutGetNumDevs();
if (numDevs !== 1) {
  throw new Error(`Expected 1 MIDI device, got ${numDevs}`);
}

const capsBuf = new ArrayBuffer(64);
const resCaps = win32Midi.midiOutGetDevCapsA(0, capsBuf, 0, 52);
if (resCaps !== MMSYSERR_NOERROR) {
  throw new Error(`midiOutGetDevCapsA failed: ${resCaps}`);
}
const view = new DataView(capsBuf);
const wTech = view.getUint16(40, true);
if (wTech !== MOD_SWSYNTH) {
  throw new Error(`Expected MOD_SWSYNTH (${MOD_SWSYNTH}), got ${wTech}`);
}
let name = "";
for (let i = 0; i < 32; i++) {
  const code = new Uint8Array(capsBuf)[8 + i];
  if (code === 0) break;
  name += String.fromCharCode(code);
}
console.log(`✓ Device caps queried: '${name}', Technology: ${wTech}`);

// Test 3: Device handle lifecycle (midiOutOpen / midiOutClose)
console.log("\nTest 3: Testing midiOutOpen and midiOutClose...");
const handleBuf = new ArrayBuffer(4);
const resOpen = win32Midi.midiOutOpen(0, 0, handleBuf, 0, 0, 0);
if (resOpen !== MMSYSERR_NOERROR) {
  throw new Error(`midiOutOpen failed: ${resOpen}`);
}
const hMidiOut = new DataView(handleBuf).getUint32(0, true);
if (!hMidiOut) {
  throw new Error("Invalid handle returned from midiOutOpen");
}
console.log(`✓ Device opened: HMIDIOUT = ${hMidiOut}`);

// Test 4: Dispatching MIDI Short Messages (NoteOn, NoteOff, Patch, Bend, Drums)
console.log("\nTest 4: Testing midiOutShortMsg command dispatch...");
// 1. Program Change: Channel 0 -> 19 (Church Organ)
const msgPatch = 0xc0 | 0 | (19 << 8);
win32Midi.midiOutShortMsg(hMidiOut, msgPatch);

// 2. Note On: Channel 0 -> Note 60 (Middle C), Velocity 120
const msgNoteOn = 0x90 | 0 | (60 << 8) | (120 << 16);
win32Midi.midiOutShortMsg(hMidiOut, msgNoteOn);

// 3. Pitch Bend: Channel 0 -> +1 semitone
const msgBend = 0xe0 | 0 | (0x40 << 8) | (0x60 << 16);
win32Midi.midiOutShortMsg(hMidiOut, msgBend);

// 4. Note Off: Channel 0 -> Note 60
const msgNoteOff = 0x80 | 0 | (60 << 8);
win32Midi.midiOutShortMsg(hMidiOut, msgNoteOff);

// 5. Drum Channel 9: Bass Drum (35) and Snare (38)
const msgBassDrum = 0x90 | 9 | (35 << 8) | (127 << 16);
const msgSnare = 0x90 | 9 | (38 << 8) | (110 << 16);
win32Midi.midiOutShortMsg(hMidiOut, msgBassDrum);
win32Midi.midiOutShortMsg(hMidiOut, msgSnare);

// 6. All Notes Off (Controller 123)
const msgAllNotesOff = 0xb0 | 0 | (123 << 8);
win32Midi.midiOutShortMsg(hMidiOut, msgAllNotesOff);

console.log("✓ Dispatched ProgramChange, NoteOn, PitchBend, NoteOff, Drum Percussion, and AllNotesOff");

win32Midi.midiOutClose(hMidiOut);
console.log("✓ Device closed cleanly");

// Test 5: WASM Bridge integration with Petzold BachTocc.wasm
console.log("\nTest 5: Verifying Petzold BachTocc.wasm via Win32 WASM Bridge...");
const runtime = new Win32WasmRuntime();
const wasmBuf = fs.readFileSync("harness/build/Chap22/BachTocc/BachTocc.wasm");
await runtime.instantiate(wasmBuf);
runtime.runWinMain();

const win = kernel.windows.find((w) => w.className === "BachTocc");
if (!win) {
  throw new Error("BachTocc window not created!");
}
console.log(`✓ BachTocc initialized: HWND ${win.hwnd}, Title: '${win.title}'`);

// Dispatch timer tick to play the next polyphonic note in Bach's Toccata
SendMessage(win.hwnd, 0x0113 /* WM_TIMER */, 1, 0);
console.log("✓ Dispatched Bach Toccata WM_TIMER sequence note tick successfully!");

// Cleanup window
SendMessage(win.hwnd, 0x0010 /* WM_CLOSE */, 0, 0);

console.log("\nALL WIN32 MIDI.JS SUBSYSTEM TESTS PASSED! 🎹🎵🎉\n");
process.exit(0);
