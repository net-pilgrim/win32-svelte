# 📋 TODO & Architectural Roadmap

This document outlines planned features, architectural milestones, and subsystem expansions for `win32-svelte`.

---

## 💾 Client-Side Storage & Offline-First Subsystems (Zero-Backend)

A tremendous amount of authentic OS functionality can be achieved entirely in-browser using standard **`localStorage`**, **`IndexedDB`**, and the modern **Origin Private File System (OPFS)**. This gives `win32-svelte` persistent, offline-capable storage with zero server requirements.

```mermaid
flowchart TD
    subgraph BrowserClient["win32-svelte Runtime (Browser)"]
        Kernel["Win32 Kernel & APIs<br/>(kernel32, advapi32, winspool)"]
        
        subgraph StorageDrivers["Client-Side Storage Drivers"]
            LS["localStorage<br/>- Windows Registry (HKCU / HKLM)<br/>- Window Coordinates & State<br/>- Sound & Theme Preferences"]
            IDB["IndexedDB<br/>- Virtual Drive C:\ File Storage<br/>- Binary Files & Large Documents<br/>- Floppy / CD-ROM Disk Images (.img, .iso)"]
            OPFS["Origin Private File System (OPFS)<br/>- High-Performance Native VFS<br/>- Synchronous File Handles<br/>- Streamed Read/Write Chunks"]
            PrintEngine["In-Browser Print Engine<br/>- High-DPI Offscreen Canvas<br/>- Client-side PDF Generation<br/>- Native window.print() Preview"]
        end
        
        Kernel --> LS
        Kernel --> IDB
        Kernel --> OPFS
        Kernel --> PrintEngine
    end
```

### 1. Client-Side Persistent Filesystem (OPFS)
- [x] **Origin Private File System (OPFS & VFS Core)**:
  - Backed by W3C `navigator.storage.getDirectory()` with seamless in-memory fallback for headless/Node environments.
  - Implements full Win32 `kernel32.dll` file I/O APIs: `CreateFile`, `ReadFile`, `WriteFile`, `CloseHandle`, `SetFilePointer`, `GetFileSize`, `DeleteFile`, `MoveFile`, `CopyFile`, `CreateDirectory`, `RemoveDirectory`, `GetFileAttributes`.
  - Wildcard search: `FindFirstFile` / `FindNextFile` / `FindClose` (`*.txt`, `*.*`).
  - Pre-seeded with authentic Windows 98 directory tree and system files (`AUTOEXEC.BAT`, `CONFIG.SYS`, `SYSTEM.INI`, `WIN.INI`, `SYSTEM32`, `Welcome.txt`, etc.).
  - Reactive change listeners (`vfs.addChangeListener`) automatically synchronizing open explorer windows.
- [x] **Virtual Removable Media (`A:` & `D:`)**:
  - Top-level virtual drive mapping (`A:`, `C:`, `D:`) integrated into Win32 path normalization.
- [x] **File Import & Export**:
  - Right-click / Menu in Explorer $\rightarrow$ "Export to Host" (triggers browser download).
  - Drag from host desktop into Explorer or Notepad $\rightarrow$ automatically saves into OPFS persistent sandbox.
- [x] **Application Integration**:
  - Windows Explorer (`src/samples/explorer.ts`) dynamically browses live OPFS folders, double-click navigates directories or opens files, and supports creating new folders / deleting items.
  - Notepad (`src/samples/notepad.ts`) natively opens, saves, and creates files directly to/from OPFS paths (`C:\My Documents`, etc.).


### 2. Client-Side Windows Registry (`localStorage` & `advapi32.dll`)
- [ ] **Synchronous Registry Store via `localStorage`**:
  - Because `localStorage` is synchronous, key-value lookups match the blocking semantics of `RegQueryValueEx` and `RegSetValueEx` without needing `async/await`!
  - Namespace keys by registry hive:
    - `HKCU\Control Panel\Desktop` $\rightarrow$ wallpaper, color schemes, sound effects.
    - `HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer` $\rightarrow$ desktop icon positions, recent files.
    - `HKLM\Software` $\rightarrow$ installed application registrations.
- [ ] **Registry API Implementation**:
  - `RegOpenKeyEx`, `RegCloseKey`, `RegQueryValueEx`, `RegSetValueEx`, `RegDeleteValue`.
  - `RegSaveKey` / `RegRestoreKey`: Import/Export `.reg` files in classic ASCII Windows registry format.

### 3. Client-Side Printing & PDF Export (Zero-Backend)
- [ ] **GDI Client-Side Spooler**:
  - When calling `StartDoc` / `EndDoc`, the printer `HDC` renders the print pages into an offscreen high-DPI canvas or SVG.
- [ ] **PDF Generation & Browser Print**:
  - Convert rendered pages into a downloadable PDF directly in the browser (e.g. using `pdf-lib`).
  - Trigger native `window.print()` with a specialized Windows 98 print preview stylesheet (`@media print`).

---

## ☁️ Remote Subsystems & Containerized Backend Architecture (Hybrid Mode)

Integrate a lightweight remote container (Docker / Linux daemon) communicating with the browser frontend via **REST** and **WebSockets** to elevate `win32-svelte` from an in-memory GUI sandbox to a persistent, networked cloud workstation.

```mermaid
flowchart TD
    subgraph Browser["win32-svelte (Browser Frontend)"]
        UI["Svelte 5 Presentation & Controls"]
        Kernel["Win32 User & GDI Kernel"]
        Bridge["Remote Subsystem Bridge Client"]
        UI --> Kernel
        Kernel --> Bridge
    end

    subgraph Network["Transport Layer"]
        WS["WebSocket (Full-Duplex Streams)<br/>- Raw TCP/Winsock Proxy<br/>- Inotify File Watcher<br/>- Process STDIN/STDOUT Pipes"]
        REST["REST API (HTTP / JSON / Blobs)<br/>- File Upload / Download<br/>- Spool Print Jobs<br/>- Registry Hive Synchronization"]
    end

    subgraph Container["Remote Backend Container (Docker / Wine / Linux)"]
        Gateway["API Gateway / Daemon"]
        VFS["Virtual File System (C:\ -> /data/drive_c)"]
        Spooler["Print Spooler (CUPS / Ghostscript / PDF)"]
        WinsockProxy["TCP/UDP Winsock Socket Proxy"]
        RegistryDB["Persistent Registry (SQLite / JSON)"]
        WineProc["Headless Wine Process Execution"]

        Gateway --> VFS
        Gateway --> Spooler
        Gateway --> WinsockProxy
        Gateway --> RegistryDB
        Gateway --> WineProc
    end

    Bridge <--> WS
    Bridge <--> REST
    WS <--> Gateway
    REST <--> Gateway
```

---

### 1. Remote Filesystem (`kernel32.dll`)
- [ ] **Handle-Based File I/O API**:
  - `CreateFile(lpFileName, dwDesiredAccess, dwShareMode, ...)`: Proxies file open to container; returns numeric `HANDLE`.
  - `ReadFile(hFile, lpBuffer, nNumberOfBytesToRead, lpNumberOfBytesRead, ...)`: Streams byte chunks via WebSocket / binary REST chunks.
  - `WriteFile(hFile, lpBuffer, nNumberOfBytesToWrite, lpNumberOfBytesWritten, ...)`: Writes chunks to container volume.
  - `CloseHandle(hObject)`: Releases file descriptors on the backend container.
- [ ] **Directory Enumeration & Attributes**:
  - `FindFirstFile(lpFileName, lpFindFileData)` / `FindNextFile(hFindFile, lpFindFileData)`: Translates `/data/drive_c` container directory listings into `WIN32_FIND_DATA` structs.
  - `GetFileAttributes(lpFileName)` / `SetFileAttributes(lpFileName, dwFileAttributes)`.
  - `CreateDirectory(lpPathName)` / `RemoveDirectory(lpPathName)`.
- [ ] **Live Directory Change Notifications**:
  - `ReadDirectoryChangesW(...)`: Uses container `inotify` over WebSocket to push live filesystem updates directly into Windows Explorer without polling.
- [ ] **Mountable Drives**:
  - Map `(A:)` to simulated floppy disks / image uploads.
  - Map `(C:)` to container volume storage (`/var/win32/drive_c`).
  - Map `(D:)` to simulated CD-ROM ISO images.

---

### 2. Remote Printing Subsystem (`winspool.drv` & GDI Print DC)
- [ ] **GDI Printer Device Context (`CreateDC("WINSPOOL", ...)` )**:
  - Implement printer `HDC` that records GDI drawing primitives (`MoveTo`, `LineTo`, `Rectangle`, `Ellipse`, `TextOut`, fonts) into an Execution Journal / Enhanced Metafile (EMF).
- [ ] **Document Spooling Flow**:
  - `StartDoc(hdc, &docInfo)`: Initiates a new print job.
  - `StartPage(hdc)` / `EndPage(hdc)`: Delimits page boundaries.
  - `EndDoc(hdc)`: Completes the spool and packages commands for transmission.
  - `AbortDoc(hdc)`: Cancels the active spool.
- [ ] **Container Spooler Daemon**:
  - Receives GDI command streams over REST (`POST /api/spool/jobs`).
  - Rasterizes or converts commands into standard **PDF** or **PostScript** using Cairo, Ghostscript, or Puppeteer.
  - Options:
    - **Physical Print**: Routes directly to real office/home printers via **CUPS**.
    - **Virtual Print / Download**: Returns a downloadable PDF or triggers browser `window.print()` with pixel-perfect output.
- [ ] **Common Dialog Support**:
  - `PrintDlg(&pd)`: Standard Windows 98 Print configuration dialog (printer selection, page ranges, copies).

---

### 3. Winsock / Raw Networking (`ws2_32.dll`)
- [ ] **WebSocket-to-TCP/UDP Gateway**:
  - Run a lightweight TCP/UDP proxy inside the container (e.g. `websockify` or custom Node/Go proxy).
- [ ] **Socket API Implementation**:
  - `WSAStartup(wVersionRequired, &wsaData)` / `WSACleanup()`.
  - `socket(af, type, protocol)`: Opens a dedicated WebSocket stream to container daemon.
  - `connect(s, name, namelen)`: Daemon connects a real TCP socket to target host/port.
  - `send(s, buf, len, flags)` / `recv(s, buf, len, flags)`.
  - `closesocket(s)`.
- [ ] **Classic Network Sample Applications**:
  - Telnet client (`TELNET.EXE`) connecting to BBS servers.
  - IRC client (`mIRC`) connecting to real IRC networks.
  - FTP client (`FTP.EXE`) or basic HTTP browser.

---

### 4. Persistent Windows Registry (`advapi32.dll`)
- [ ] **Container Registry Database**:
  - SQLite, LevelDB, or JSON-backed persistent registry store inside the container.
- [ ] **Registry API Implementation**:
  - `RegOpenKeyEx(hKey, lpSubKey, ulOptions, samDesired, &phkResult)`.
  - `RegQueryValueEx(hKey, lpValueName, lpReserved, lpType, lpData, lpcbData)`.
  - `RegSetValueEx(hKey, lpValueName, Reserved, dwType, lpData, cbData)`.
  - `RegCloseKey(hKey)`.
- [ ] **Standard Hives**:
  - `HKEY_LOCAL_MACHINE` (`HKLM`): Machine-wide software and system settings.
  - `HKEY_CURRENT_USER` (`HKCU`): User desktop layout, icon positions, wallpaper, color themes.
  - Client-side cache to avoid round-trips for read-heavy operations.

---

### 5. Remote Process Execution & Headless Wine (`CreateProcess`)
- [ ] **Process Creation Gateway**:
  - `CreateProcess(lpApplicationName, lpCommandLine, ...)`: Proxies execution requests to a headless Wine environment running in the container.
- [ ] **Standard I/O Streams over WebSockets**:
  - Pipe container process `STDIN`, `STDOUT`, and `STDERR` over WebSockets.
- [ ] **Command Prompt Window (`cmd.exe` / `command.com`)**:
  - Terminal window inside `win32-svelte` running real MS-DOS / Win32 console binaries hosted by the container.

---

### 6. ODBC & Database Connectivity (`odbc32.dll` & Supabase)
- [ ] **ODBC Core API Engine (`odbc32.dll`)**:
  - Implement classic Win32 ODBC handles and function signatures:
    - Environment & Connection: `SQLAllocHandle`, `SQLSetEnvAttr`, `SQLFreeHandle`.
    - Connection Management: `SQLConnect`, `SQLDriverConnect`, `SQLDisconnect`.
    - Statement & Query Execution: `SQLExecDirect`, `SQLPrepare`, `SQLExecute`.
    - Cursor & Result Set Navigation: `SQLFetch`, `SQLGetData`, `SQLNumResultCols`, `SQLDescribeCol`, `SQLRowCount`.
- [ ] **Supabase ODBC Driver & Cloud Bridge**:
  - Expose Supabase projects as a first-class virtual ODBC Data Source Name (DSN).
  - Map PostgreSQL queries and PostgREST endpoints to tabular ODBC cursor rowsets.
  - Optional Supabase Realtime subscriptions driving Win32 change events / notifications.
  - Connection string parsing (e.g., `DSN=Supabase;ProjectRef=xyz;ApiKey=...;`).
- [ ] **ODBC Data Source Administrator (`ODBCAD32.EXE` / `ODBCCP32.CPL`)**:
  - Classic Windows 98 Control Panel applet with User DSN, System DSN, File DSN, and Drivers tabs (`SysTabControl32`).
  - "Configure Data Source" modal dialog for entering Supabase Project URL and API Key.
  - "Test Connection" button with authentic Win32 dialog feedback.
- [ ] **Sample Database Applications**:
  - Win32 SQL Query Analyzer / ISQL tool (`ISQL.EXE`): Query box with results rendered in a virtualized `SysListView32` table.
  - Database Table Inspector inside Windows Explorer under a virtual `ODBC Data Sources` folder.

---

## 🪟 GUI, Common Controls & Architecture Enhancements

### 7. Common Controls 32 (`COMCTL32`) Roadmap
- [x] `SysTreeView32` (`WC_TREEVIEW`): Hierarchical tree nodes, expand/collapse, dotted lines, selection.
- [x] `SysListView32` (`WC_LISTVIEW`): Report/details mode, sticky column headers, row selection.
- [x] `SysTabControl32` (`WC_TABCONTROL`): Tabbed property sheet strips with selection switching.
- [x] `msctls_statusbar32` (`STATUSCLASSNAME`): Multi-field recessed status bar panels.
- [ ] **Image Lists (`HIMAGELIST`)**:
  - Support for `ImageList_Create`, `ImageList_Add`, and binding icons to ListView and TreeView nodes.
- [ ] **ListView Column Reordering & Sorting**:
  - Interactive header column resizing and sorting (`LVM_SORTITEMS`).
- [ ] **TreeView In-Place Label Editing**:
  - Double-click/F2 to edit node labels (`TVM_EDITLABEL`).

---

### 8. Drag & Drop and Clipboard Subsystems
- [x] **Shell Drag & Drop (`shell32.dll`)**:
  - `DragAcceptFiles`, `WM_DROPFILES`, `DragQueryFile`, `DragQueryPoint`, `DragFinish`.
  - Host OS file dropping into Notepad and Explorer.
  - In-app dragging from Explorer to Notepad and Recycle Bin.
- [ ] **System Clipboard (`user32.dll`)**:
  - `OpenClipboard(hwnd)`, `EmptyClipboard()`, `SetClipboardData(uFormat, hMem)`, `GetClipboardData(uFormat)`, `CloseClipboard()`.
  - Bridge to browser `navigator.clipboard` API for text and images.
- [ ] **OLE Structured Drag & Drop (`ole32.dll`)**:
  - `RegisterDragDrop(hwnd, pDropTarget)`.
  - `DoDragDrop(pDataObject, pDropSource, dwOKEffects, pdwEffect)`.

---

### 9. Microsoft Foundation Classes (MFC) Extensions
- [x] **Core MFC Architecture**:
  - `CObject`: RTTI, `isKindOf()`.
  - `CCmdTarget`: Command routing & Message Maps (`ON_COMMAND`, `ON_BN_CLICKED`, `ON_WM_MESSAGE`).
  - `CWnd`: Window wrapper, `FromHandle`, `attach`/`detach`, `createEx`.
  - `CFrameWnd`: Top-level SDI frame windows.
  - `CDialog`: Modal dialogs with `doModal()`, `onInitDialog()`, `onOK()`, `onCancel()`.
  - `CWinApp`: Application singleton and lifecycle (`initInstance`, `m_pMainWnd`, `run`).
  - `CDC` & `CPaintDC`: Device contexts with GDI drawing methods.
  - Controls: `CButton`, `CEdit`, `CStatic`, `CComboBox`, `CProgressCtrl`, `CSliderCtrl`, `CTreeCtrl`, `CListCtrl`.
- [ ] **Document / View Architecture**:
  - `CDocument`: Data container with `OnNewDocument()`, `OnOpenDocument()`, `Serialize()`.
  - `CView`: Base view class attached to a `CDocument` with `OnDraw(CDC* pDC)`.
  - `CDocTemplate` / `CSingleDocTemplate`: Managing document, frame, and view coordination.
- [ ] **MFC Toolbars & Statusbars**:
  - `CToolBar`: Dockable button bars with bitmap icons.
  - `CStatusBar`: Object-oriented status bar wrapper.

---

### 10. Resource Script (`.rc`) Compiler & Tooling
- [x] **`.rc` Parser & Compiler**:
  - Parse classic `.rc` scripts:
    - `DIALOGEX` / `DIALOG` definitions (controls, coordinates, styles, font metrics).
    - `MENU` / `MENUEX` structures with nested popups and shortcuts.
    - `STRINGTABLE` localization tables.
    - `ACCELERATORS` hotkey maps.
    - Preprocessor directives (`#include`, `#define`, `#undef`, `#ifdef`, `#ifndef`).
  - Emit typed TypeScript / JSON schema objects directly executable by the kernel.
  - CLI compiler (`npm run rc -- <file.rc> -o <output.ts>`).
  - Vite build plugin (`win32RcPlugin` / `vite-plugin-win32-rc`) with direct `.rc` imports and HMR watch tracking.
- [x] **Dialog Box Engine**:
  - `CreateDialogParam(hInstance, lpTemplateName, hWndParent, lpDialogFunc, dwInitParam)`
  - `DialogBoxParam(...)`: Native execution of modal `.rc` dialog templates with owner disable/re-enable.
  - Dialog control helpers: `GetDlgItem`, `SetDlgItemText`, `GetDlgItemText`, `CheckDlgButton`, `IsDlgButtonChecked`, `SendDlgItemMessage`.
  - Resource loaders: `LoadMenu`, `LoadString`.
  - Integration with MFC `CDialog(lpszTemplateName, pParentWnd)`.

---

### 11. WebAssembly & C Compilation Target
- [ ] **C Header Bridge (`windows.h`)**:
  - Create a lightweight `windows.h` header for Emscripten / Clang that compiles native C Win32 code directly to WebAssembly and links against this JavaScript/Svelte kernel!
- [ ] **Native C Transpilation**:
  - Pipeline to take TypeScript `win32-svelte` applications and emit clean C99 code targetable by GCC or MSVC.

