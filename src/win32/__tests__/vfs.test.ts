import { vfs, Win32VFS } from "../vfs";
import {
  GENERIC_READ,
  GENERIC_WRITE,
  CREATE_NEW,
  CREATE_ALWAYS,
  OPEN_EXISTING,
  OPEN_ALWAYS,
  FILE_BEGIN,
  INVALID_HANDLE_VALUE,
} from "../constants";

async function runTests() {
  console.log("Starting Win32 OPFS VFS Tests...\n");

  const testVfs = new Win32VFS();
  await testVfs.init();

  console.log(`Backend initialized: ${testVfs.getBackendType()}`);
  if (testVfs.getBackendType() !== "memory") {
    throw new Error("Expected memory fallback in Node environment");
  }

  // 1. Verify default seeded files exist
  console.log("Test 1: Verify seeded default files...");
  const welcome = await testVfs.readTextFile("C:\\My Documents\\Welcome.txt");
  if (!welcome.includes("OPFS")) {
    throw new Error(`Failed to read Welcome.txt, got: ${welcome}`);
  }

  const sampleC = await testVfs.readTextFile("C:\\wasm_application\\sample_app.c");
  if (!sampleC.includes("windows.h")) {
    throw new Error(`Failed to read sample_app.c, got: ${sampleC}`);
  }
  console.log("✓ Seeded files verified");

  // 2. Test directory enumeration
  console.log("Test 2: getDirectoryEntries for C:\\...");
  const cEntries = await testVfs.getDirectoryEntries("C:\\");
  const names = cEntries.map((e) => e.name);
  if (!names.includes("My Documents") || !names.includes("wasm_application") || !names.includes("INCLUDE")) {
    throw new Error(`Expected My Documents, wasm_application, and INCLUDE in C:\\, got: ${names.join(", ")}`);
  }
  console.log(`✓ C:\\ entries: ${names.join(", ")}`);

  // 3. Test CreateFile, WriteFile, ReadFile, CloseHandle
  console.log("Test 3: File I/O (CreateFile, WriteFile, ReadFile)...");
  const testPath = "C:\\My Documents\\test_file.txt";
  const hFile = await testVfs.CreateFile(
    testPath,
    GENERIC_READ | GENERIC_WRITE,
    0,
    null,
    CREATE_ALWAYS
  );
  if (hFile === INVALID_HANDLE_VALUE) {
    throw new Error("Failed to create file");
  }

  const writeRes = await testVfs.WriteFile(hFile, "Hello Win32 OPFS World!");
  if (writeRes.bytesWritten !== 23) {
    throw new Error(`Expected 23 bytes written, got: ${writeRes.bytesWritten}`);
  }

  // Seek back to beginning
  await testVfs.SetFilePointer(hFile, 0, FILE_BEGIN);

  const readRes = await testVfs.ReadFile(hFile);
  const readText = new TextDecoder().decode(readRes.buffer);
  if (readText !== "Hello Win32 OPFS World!") {
    throw new Error(`Expected 'Hello Win32 OPFS World!', got: '${readText}'`);
  }

  await testVfs.CloseHandle(hFile);
  console.log("✓ File I/O succeeded");

  // 4. Test FindFirstFile and FindNextFile
  console.log("Test 4: FindFirstFile / FindNextFile...");
  const { handle: hFind, findData } = await testVfs.FindFirstFile("C:\\My Documents\\*.txt");
  if (hFind === INVALID_HANDLE_VALUE || !findData) {
    throw new Error("FindFirstFile failed to find matching *.txt files");
  }

  const foundFiles: string[] = [findData.cFileName];
  let next = await testVfs.FindNextFile(hFind);
  while (next) {
    foundFiles.push(next.cFileName);
    next = await testVfs.FindNextFile(hFind);
  }
  await testVfs.FindClose(hFind);

  if (!foundFiles.includes("Welcome.txt") || !foundFiles.includes("test_file.txt")) {
    throw new Error(`Find failed to list all txt files, found: ${foundFiles.join(", ")}`);
  }
  console.log(`✓ Wildcard find matched: ${foundFiles.join(", ")}`);

  // 5. Test MoveFile / Rename
  console.log("Test 5: MoveFile (Rename)...");
  const newPath = "C:\\My Documents\\renamed_file.txt";
  const moveOk = await testVfs.MoveFile(testPath, newPath);
  if (!moveOk) throw new Error("MoveFile returned false");

  const oldExists = await testVfs.FileExists(testPath);
  const newExists = await testVfs.FileExists(newPath);
  if (oldExists || !newExists) {
    throw new Error(`Move failed. oldExists=${oldExists}, newExists=${newExists}`);
  }
  console.log("✓ MoveFile succeeded");

  // 6. Test DeleteFile
  console.log("Test 6: DeleteFile...");
  const deleteOk = await testVfs.DeleteFile(newPath);
  if (!deleteOk || (await testVfs.FileExists(newPath))) {
    throw new Error("DeleteFile failed to remove file");
  }
  console.log("✓ DeleteFile succeeded");

  // 7. Test Change Listener notifications
  console.log("Test 7: Change Listeners...");
  let changeReceived = false;
  const unsub = testVfs.addChangeListener((evt) => {
    if (evt.action === "create" && evt.path.includes("listener_test.txt")) {
      changeReceived = true;
    }
  });

  await testVfs.writeTextFile("C:\\My Documents\\listener_test.txt", "listening");
  unsub();

  if (!changeReceived) {
    throw new Error("Change listener did not receive event");
  }
  console.log("✓ Change listeners succeeded");

  console.log("\nALL OPFS VFS TESTS PASSED! 🚀🎉");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
