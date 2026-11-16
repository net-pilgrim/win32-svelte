import {
  CreateWindowEx,
  DefWindowProc,
  KillTimer,
  kernel,
  RegisterClassEx,
  SendMessage,
  SetTimer,
  SetWindowText,
  ShowWindow,
} from "../win32/kernel.svelte";
import {
  ES_MULTILINE,
  ES_READONLY,
  SW_HIDE,
  SW_SHOW,
  TCM_INSERTITEM,
  TCN_SELCHANGE,
  TVI_ROOT,
  TVM_DELETEITEM,
  TVM_INSERTITEM,
  TVM_SELECTITEM,
  TVN_SELCHANGED,
  WC_TABCONTROL,
  WC_TREEVIEW,
  WM_CREATE,
  WM_DESTROY,
  WM_NOTIFY,
  WM_TIMER,
  WS_CHILD,
  WS_OVERLAPPEDWINDOW,
  WS_VISIBLE,
  WS_VSCROLL,
} from "../win32/constants";
import type { HWND, LPARAM, LRESULT, NMHDR, TreeNodeItem, UINT, WPARAM, WindowRecord } from "../win32/types";
import { Win32WasmRuntime, type WasmStringLogEntry } from "../win32/wasm_bridge";

const IDC_INSPECTOR_TAB = 9000;
const IDC_HWND_TREE = 9001;
const IDC_WASM_SUMMARY = 9002;
const IDC_WASM_LOGS = 9003;

interface InspectorState {
  hwndTab: HWND;
  hwndTree: HWND;
  hwndWasmSummary: HWND;
  hwndWasmLogs: HWND;
  activeTab: number;
  signature: string;
  selectedNodeId: string | null;
}

const inspectorStates = new Map<HWND, InspectorState>();

function getWindowText(win: WindowRecord) {
  return win.title || win.controlState?.value || "";
}

function createWindowNode(win: WindowRecord, childrenByParent: Map<HWND, WindowRecord[]>): TreeNodeItem {
  const text = getWindowText(win);
  const children = (childrenByParent.get(win.hwnd) ?? []).map((child) =>
    createWindowNode(child, childrenByParent)
  );

  return {
    id: String(win.hwnd),
    text: `[${win.hwnd}] ${win.className}${text ? ` — ${text}` : ""}`,
    icon: children.length > 0 ? "🗔" : "▪",
    expanded: true,
    children,
  };
}

function buildHwndTree(inspectorHwnd: HWND): TreeNodeItem[] {
  const windows = kernel.windows.filter(
    (win) => win.hwnd !== inspectorHwnd && win.parentHwnd !== inspectorHwnd
  );
  const handles = new Set(windows.map((win) => win.hwnd));
  const childrenByParent = new Map<HWND, WindowRecord[]>();
  const roots: WindowRecord[] = [];

  for (const win of windows) {
    if (win.parentHwnd === null || !handles.has(win.parentHwnd)) {
      roots.push(win);
      continue;
    }

    const children = childrenByParent.get(win.parentHwnd) ?? [];
    children.push(win);
    childrenByParent.set(win.parentHwnd, children);
  }

  return roots.map((win) => createWindowNode(win, childrenByParent));
}

function getHwndTreeSignature(inspectorHwnd: HWND) {
  return kernel.windows
    .filter((win) => win.hwnd !== inspectorHwnd && win.parentHwnd !== inspectorHwnd)
    .map(
      (win) =>
        `${win.hwnd}:${win.parentHwnd}:${win.className}:${getWindowText(win)}:${win.visible}`
    )
    .join("|");
}

function refreshHwndTree(inspectorHwnd: HWND, force = false) {
  const state = inspectorStates.get(inspectorHwnd);
  if (!state) return;

  const signature = getHwndTreeSignature(inspectorHwnd);
  if (!force && signature === state.signature) return;

  SendMessage(state.hwndTree, TVM_DELETEITEM, 0, TVI_ROOT);
  for (const node of buildHwndTree(inspectorHwnd)) {
    SendMessage(state.hwndTree, TVM_INSERTITEM, 0, node);
  }
  if (state.selectedNodeId) {
    SendMessage(state.hwndTree, TVM_SELECTITEM, 0, state.selectedNodeId);
  }
  state.signature = signature;
}

function refreshWasmStats(inspectorHwnd: HWND) {
  const state = inspectorStates.get(inspectorHwnd);
  if (!state) return;

  const runtimes = Win32WasmRuntime.getActiveRuntimes();
  if (runtimes.length === 0) {
    SetWindowText(
      state.hwndWasmSummary,
      "No active WebAssembly runtime instances detected.\n\n" +
      "• Launch 'WASM C Application' from Start Menu or Desktop\n" +
      "• Or open C:\\wasm_application\\sample_app.wasm via VFS\n\n" +
      "Linear memory and indirect function table metrics will stream here in real time."
    );
    SetWindowText(state.hwndWasmLogs, "No string marshaling events logged.");
    return;
  }

  let totalMemBytes = 0;
  let totalPages = 0;
  let totalTableLength = 0;
  let callableEntries = 0;
  const wndProcSlots: number[] = [];
  const allLogs: WasmStringLogEntry[] = [];
  let totalHdc = 0;
  let totalGdi = 0;

  for (const rt of runtimes) {
    const stats = rt.getStats();
    totalMemBytes += stats.memorySizeBytes;
    totalPages += stats.memoryPages;
    totalTableLength += stats.tableLength;
    callableEntries += stats.tableEntries.filter((e) => e.isCallable).length;
    wndProcSlots.push(...stats.registeredWndProcIndices);
    allLogs.push(...stats.stringLogs);
    totalHdc += stats.activeHdcCount;
    totalGdi += stats.activeGdiObjectCount;
  }

  const summary =
    `Active WASM Runtimes: ${runtimes.length} | HDCs: ${totalHdc} | GDI Objects: ${totalGdi}\n` +
    `Linear Memory: ${totalMemBytes.toLocaleString()} bytes (${totalPages} page${totalPages === 1 ? "" : "s"} @ 64KB)\n` +
    `Indirect Table: ${totalTableLength} slot${totalTableLength === 1 ? "" : "s"} (${callableEntries} callable export${callableEntries === 1 ? "" : "s"})\n` +
    `Active C WndProc Slots: [${wndProcSlots.join(", ")}]\n` +
    `Live String Marshaling Logs (${allLogs.length} events recorded):`;

  SetWindowText(state.hwndWasmSummary, summary);

  const recentLogs = allLogs.slice(-20).reverse();
  const logText = recentLogs
    .map((l) => {
      const timeStr = new Date(l.timestamp).toISOString().substring(11, 19);
      const dir = l.direction === "read" ? "READ " : "WRITE";
      const ptrHex = "0x" + l.ptr.toString(16).padStart(5, "0");
      return `[${timeStr}] ${dir} [${ptrHex}] ${l.api}:\n  "${l.text.replace(/\r?\n/g, "\\n")}"`;
    })
    .join("\n\n");

  SetWindowText(state.hwndWasmLogs, logText || "No string operations logged yet.");
}

function HwndInspectorWndProc(
  hwnd: HWND,
  uMsg: UINT,
  _wParam: WPARAM,
  lParam: LPARAM
): LRESULT {
  switch (uMsg) {
    case WM_CREATE: {
      // 1. Master Tab Control
      const hwndTab = CreateWindowEx(
        0,
        WC_TABCONTROL,
        "InspectorTabs",
        WS_CHILD | WS_VISIBLE,
        6,
        6,
        364,
        312,
        hwnd,
        IDC_INSPECTOR_TAB
      );

      SendMessage(hwndTab, TCM_INSERTITEM, 0, "HWND Tree");
      SendMessage(hwndTab, TCM_INSERTITEM, 1, "⚡ WASM Diagnostics");

      // 2. Tab 0: HWND TreeView
      const hwndTree = CreateWindowEx(
        0,
        WC_TREEVIEW,
        "HWND tree",
        WS_CHILD | WS_VISIBLE,
        14,
        36,
        348,
        274,
        hwnd,
        IDC_HWND_TREE
      );

      // 3. Tab 1: WASM Summary & Memory Diagnostics
      const hwndWasmSummary = CreateWindowEx(
        0,
        "STATIC",
        "",
        WS_CHILD,
        14,
        36,
        348,
        85,
        hwnd,
        IDC_WASM_SUMMARY
      );

      // 4. Tab 1: WASM String Marshaling & Call Log
      const hwndWasmLogs = CreateWindowEx(
        0,
        "EDIT",
        "",
        WS_CHILD | ES_MULTILINE | ES_READONLY | WS_VSCROLL,
        14,
        125,
        348,
        185,
        hwnd,
        IDC_WASM_LOGS
      );

      inspectorStates.set(hwnd, {
        hwndTab,
        hwndTree,
        hwndWasmSummary,
        hwndWasmLogs,
        activeTab: 0,
        signature: "",
        selectedNodeId: null,
      });

      refreshHwndTree(hwnd, true);
      SetTimer(hwnd, hwnd, 250);
      return 0;
    }

    case WM_NOTIFY: {
      const notification = lParam as NMHDR;

      // Tab switching
      if (notification.idFrom === IDC_INSPECTOR_TAB && notification.code === TCN_SELCHANGE) {
        const state = inspectorStates.get(hwnd);
        if (state) {
          const tabIndex = notification.tabIndex ?? 0;
          state.activeTab = tabIndex;
          if (tabIndex === 0) {
            ShowWindow(state.hwndTree, SW_SHOW);
            ShowWindow(state.hwndWasmSummary, SW_HIDE);
            ShowWindow(state.hwndWasmLogs, SW_HIDE);
            refreshHwndTree(hwnd, true);
          } else {
            ShowWindow(state.hwndTree, SW_HIDE);
            ShowWindow(state.hwndWasmSummary, SW_SHOW);
            ShowWindow(state.hwndWasmLogs, SW_SHOW);
            refreshWasmStats(hwnd);
          }
        }
        return 0;
      }

      // Tree item selection
      if (notification.idFrom === IDC_HWND_TREE && notification.code === TVN_SELCHANGED) {
        const state = inspectorStates.get(hwnd);
        if (state) state.selectedNodeId = String(notification.nodeId);
        const selectedHwnd = Number(notification.nodeId);
        if (kernel.getWindow(selectedHwnd)) {
          kernel.BringToFront(selectedHwnd);
        }
        return 0;
      }
      return 0;
    }

    case WM_TIMER: {
      if (_wParam === hwnd) {
        const state = inspectorStates.get(hwnd);
        if (state) {
          if (state.activeTab === 0) {
            refreshHwndTree(hwnd);
          } else {
            refreshWasmStats(hwnd);
          }
        }
      }
      return 0;
    }

    case WM_DESTROY: {
      KillTimer(hwnd, hwnd);
      inspectorStates.delete(hwnd);
      return 0;
    }

    default:
      return DefWindowProc(hwnd, uMsg, _wParam, lParam);
  }
}

export function StartHwndInspector(x = 500, y = 110): HWND {
  const className = "HwndInspectorApp";
  RegisterClassEx({
    className,
    lpfnWndProc: HwndInspectorWndProc,
  });

  const hwnd = CreateWindowEx(
    0,
    className,
    "HWND & WASM Inspector",
    WS_OVERLAPPEDWINDOW | WS_VISIBLE,
    x,
    y,
    388,
    360,
    null,
    null
  );

  ShowWindow(hwnd, SW_SHOW);
  return hwnd;
}
