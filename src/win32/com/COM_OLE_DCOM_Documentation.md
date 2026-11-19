# COM / OLE / DCOM Documentation Update

## New Features
- **COM Core Engine** (`src/win32/com/core.ts`)
  - `IUnknown`, CLSID handling, class store, `Co*` APIs.
- **Automation** (`src/win32/com/automation.ts`)
  - `IDispatch`, `CreateObject`, proxy filtering for Promise methods.
- **Simulated DCOM** (`src/win32/com/dcom/*`)
  - `CoCreateInstanceEx`, object exporter table with `allowLoopback` flag, BroadcastChannel transport, optional WebSocket transport.
- **OLE Structured Storage** (`src/win32/com/ole/*`)
  - `MemoryStream`, `DocFileStorage`, `StgCreateDocfile`, `StgOpenStorage`.
- **OLE Drag‑&‑Drop / Clipboard** (`src/win32/com/ole/dragdrop.ts`)
  - `IDataObject`, `IDropSource`, `DoDragDrop`, clipboard APIs.
- **DCOMCNFG Sample** (`src/samples/dcomcnfg.ts`)
  - Integrated into start menu via `startmenu.json`.

## README Additions
Add a **COM / OLE / DCOM** section after the existing architecture diagram, e.g.:
```markdown
### 📦 COM / OLE / DCOM Subsystems
- **COM Core** – In‑process component object model with `CoCreateInstance`, class registration, and reference counting.
- **Automation** – Scriptable automation via `CreateObject` and `IDispatch` proxies.
- **Simulated DCOM** – Cross‑tab RPC using `BroadcastChannel`. Supports `CoCreateInstanceEx` with optional remote endpoints.
- **OLE Structured Storage** – Compound file APIs (`StgCreateDocfile`, `StgOpenStorage`).
- **Drag‑&‑Drop & Clipboard** – Shell drag/drop and clipboard integration.
- **DCOMCNFG** – Configuration tool available from the Start menu under *Programs → Accessories*.
```
Link to the new docs:
```markdown
See the detailed API reference in [`src/win32/com/README.md`](src/win32/com/README.md).
```

## Migration Notes
- **VFS method names**: COM servers now use PascalCase (`CreateFile`, `ReadFile`, `WriteFile`, …). Update any custom code that still calls the lower‑case variants.
- **Automation proxies**: The proxy no longer exposes `then`, `catch`, or `finally`. If your scripts relied on promise‑like behavior, adjust to use explicit callbacks.
- **DCOM loopback**: The default `allowLoopback` is `true`. Set `objectExporter.allowLoopback = false` to disable processing of local loopback frames.

## Example Usage
```typescript
import { CoCreateInstance, CLSID } from './win32/com/core';
import { CreateObject } from './win32/com/automation';

// COM example
const obj = CoCreateInstance(CLSID('My.Component'), null, CLSCTX_INPROC_SERVER);

// Automation example
const excel = CreateObject('Excel.Application');
excel.Visible = true;

// DCOM example (cross‑tab)
const remoteObj = CoCreateInstanceEx(CLSID('Remote.Service'), {
  name: 'broadcast://dcom-channel',
  allowLoopback: false,
});
```

---
*This file is a draft for inclusion in the project's documentation. Adjust headings/placement as needed.*