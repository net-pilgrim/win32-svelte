import {
  CreateWindowEx,
  DefWindowProc,
  kernel,
  RegisterClassEx,
  SendMessage,
  ShowWindow,
} from "../win32/kernel.svelte";
import {
  SW_SHOW,
  TVM_INSERTITEM,
  TVN_SELCHANGED,
  WC_TREEVIEW,
  WM_CREATE,
  WM_NOTIFY,
  WS_CHILD,
  WS_OVERLAPPEDWINDOW,
  WS_VISIBLE,
} from "../win32/constants";
import type { HWND, LPARAM, LRESULT, NMHDR, TreeNodeItem, UINT, WPARAM, WindowRecord } from "../win32/types";

const IDC_HWND_TREE = 9001;

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
  const windows = kernel.windows.filter((win) => win.hwnd !== inspectorHwnd);
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

function HwndInspectorWndProc(
  hwnd: HWND,
  uMsg: UINT,
  _wParam: WPARAM,
  lParam: LPARAM
): LRESULT {
  switch (uMsg) {
    case WM_CREATE: {
      const hwndTree = CreateWindowEx(
        0,
        WC_TREEVIEW,
        "HWND tree",
        WS_CHILD | WS_VISIBLE,
        6,
        6,
        332,
        278,
        hwnd,
        IDC_HWND_TREE
      );

      for (const node of buildHwndTree(hwnd)) {
        SendMessage(hwndTree, TVM_INSERTITEM, 0, node);
      }
      return 0;
    }

    case WM_NOTIFY: {
      const notification = lParam as NMHDR;
      if (notification.idFrom === IDC_HWND_TREE && notification.code === TVN_SELCHANGED) {
        const selectedHwnd = Number(notification.nodeId);
        if (kernel.getWindow(selectedHwnd)) {
          kernel.BringToFront(selectedHwnd);
        }
      }
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
    "HWND Component Tree",
    WS_OVERLAPPEDWINDOW | WS_VISIBLE,
    x,
    y,
    350,
    320,
    null,
    null
  );

  ShowWindow(hwnd, SW_SHOW);
  return hwnd;
}
