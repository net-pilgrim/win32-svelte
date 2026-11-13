<script lang="ts">
  import { onMount } from "svelte";
  import { kernel, ShowWindow, MessageBox } from "../kernel.svelte";
  import { SW_RESTORE, SW_MINIMIZE, MB_OK } from "../constants";
  import Window from "./Window.svelte";
  import MessageBoxModal from "./MessageBoxModal.svelte";
  import DesktopIcon from "./DesktopIcon.svelte";
  import StartMenu from "./StartMenu.svelte";
  import { audio } from "../audio";
  import { StartMinesweeper } from "../../samples/minesweeper";
  import { StartCalculator } from "../../samples/calculator";
  import { StartNotepad } from "../../samples/notepad";
  import { StartControlGallery } from "../../samples/control_gallery";
  import { StartPaintDemo } from "../../samples/paint_demo";
  import { StartExplorer } from "../../samples/explorer";
  import { StartMfcDemo } from "../../samples/mfc_demo";
  import { StartRcDemo } from "../../samples/rc_demo.ts";
  import { StartWasmApp } from "../../samples/wasm_app";

  let topWindows = $derived(kernel.windows.filter((w) => w.parentHwnd === null));

  let timeString = $state("");
  let selectedIconId = $state<string | null>(null);
  let isStartMenuOpen = $state(false);
  let soundEnabled = $state(true);

  interface IconItem {
    id: string;
    title: string;
    icon: string;
    x: number;
    y: number;
    action: () => void;
    onDropFiles?: (data: any) => void;
  }

  let recycledItems = $state<string[]>([]);

  let icons = $state<IconItem[]>([
    {
      id: "computer",
      title: "My Computer",
      icon: "💻",
      x: 16,
      y: 16,
      action: () => StartControlGallery(180, 50),
    },
    {
      id: "explorer",
      title: "Windows Explorer",
      icon: "🗂️",
      x: 16,
      y: 96,
      action: () => StartExplorer(160, 70),
    },
    {
      id: "minesweeper",
      title: "Minesweeper",
      icon: "💣",
      x: 16,
      y: 176,
      action: () => StartMinesweeper(120, 80),
    },
    {
      id: "paint",
      title: "GDI Paint",
      icon: "🎨",
      x: 16,
      y: 256,
      action: () => StartPaintDemo(240, 100),
    },
    {
      id: "notepad",
      title: "Notepad",
      icon: "📝",
      x: 16,
      y: 336,
      action: () => StartNotepad(320, 70),
    },
    {
      id: "calculator",
      title: "Calculator",
      icon: "🔢",
      x: 16,
      y: 416,
      action: () => StartCalculator(380, 90),
    },
    {
      id: "mfc",
      title: "MFC Scribble",
      icon: "📐",
      x: 106,
      y: 16,
      action: () => StartMfcDemo(220, 80),
    },
    {
      id: "rcdemo",
      title: "RC Compiler",
      icon: "📦",
      x: 106,
      y: 96,
      action: () => StartRcDemo(240, 90),
    },
    {
      id: "wasm_app",
      title: "WASM C App",
      icon: "⚡",
      x: 106,
      y: 176,
      action: () => StartWasmApp(260, 110),
    },
    {
      id: "c_source",
      title: "sample_app.c",
      icon: "📄",
      x: 106,
      y: 256,
      action: () => StartNotepad(360, 80, "C:\\wasm_application\\sample_app.c"),
    },
    {
      id: "windows_h",
      title: "windows.h",
      icon: "📋",
      x: 106,
      y: 336,
      action: () => StartNotepad(420, 110, "C:\\wasm_application\\windows.h"),
    },
    {
      id: "lua_host",
      title: "Lua 5.3 Host",
      icon: "🌙",
      x: 106,
      y: 416,
      action: () => launchLuaHost(220, 70),
    },
    {
      id: "recycle",
      title: "Recycle Bin",
      icon: "🗑️",
      x: 16,
      y: 496,
      action: () => {
        if (recycledItems.length === 0) {
          MessageBox(null, "The Recycle Bin is currently empty.", "Recycle Bin", MB_OK);
        } else {
          MessageBox(
            null,
            `The Recycle Bin contains ${recycledItems.length} item(s):\n\n${recycledItems.map((n) => `• ${n}`).join("\n")}`,
            "Recycle Bin",
            MB_OK
          );
        }
      },
      onDropFiles: (fileData: any) => {
        const name = fileData.name || "Item";
        recycledItems.push(name);
        audio.playChord();
        MessageBox(null, `'${name}' was deleted and sent to the Recycle Bin.`, "Recycle Bin", MB_OK);
      },
    },
  ]);

  onMount(() => {
    const updateTime = () => {
      const now = new Date();
      timeString = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  });

  function toggleTaskbarWindow(hwnd: number) {
    const win = kernel.getWindow(hwnd);
    if (!win || !win.enabled) return;
    if (win.minimized) {
      ShowWindow(hwnd, SW_RESTORE);
    } else if (kernel.activeHwnd === hwnd) {
      ShowWindow(hwnd, SW_MINIMIZE);
    } else {
      kernel.BringToFront(hwnd);
    }
  }

  function onDesktopSurfaceClick() {
    selectedIconId = null;
    isStartMenuOpen = false;
  }

  function toggleStartMenu() {
    audio.playClick();
    isStartMenuOpen = !isStartMenuOpen;
  }

  function toggleSound() {
    soundEnabled = !soundEnabled;
    audio.enabled = soundEnabled;
  }

  function launchLuaHost(x?: number, y?: number, scriptPath?: string) {
    import("../../samples/lua_host").then(({ StartLuaHost }) => {
      StartLuaHost(x, y, scriptPath);
    });
  }

  function minimizeAll() {
    const allMin = topWindows.every((w) => w.minimized);
    for (const win of topWindows) {
      ShowWindow(win.hwnd, allMin ? SW_RESTORE : SW_MINIMIZE);
    }
  }
</script>

<div class="desktop-container">
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="desktop-surface" onclick={onDesktopSurfaceClick}>
    <!-- Draggable Desktop Icons -->
    {#each icons as icon (icon.id)}
      <DesktopIcon
        id={icon.id}
        title={icon.title}
        icon={icon.icon}
        x={icon.x}
        y={icon.y}
        isSelected={selectedIconId === icon.id}
        onSelect={() => (selectedIconId = icon.id)}
        onMove={(newX, newY) => {
          icon.x = newX;
          icon.y = newY;
        }}
        onLaunch={icon.action}
        onDropFiles={icon.onDropFiles}
      />
    {/each}

    <!-- Windows -->
    {#each topWindows as win (win.hwnd)}
      <Window window={win} />
    {/each}
  </div>

  <!-- Start Menu -->
  <StartMenu
    isOpen={isStartMenuOpen}
    onClose={() => (isStartMenuOpen = false)}
    {soundEnabled}
    onToggleSound={toggleSound}
  />

  <div class="taskbar">
    <button
      class="start-button {isStartMenuOpen ? 'active' : ''}"
      onclick={toggleStartMenu}
    >
      <span class="start-flag">🪟</span>
      <strong>Start</strong>
    </button>

    <div class="taskbar-divider"></div>

    <!-- Quick Launch Toolbar -->
    <div class="quick-launch">
      <button class="quick-btn" title="Windows Explorer" onclick={() => StartExplorer(160, 70)}>
        🗂️
      </button>
      <button class="quick-btn" title="WASM C Application" onclick={() => StartWasmApp(260, 110)}>
        ⚡
      </button>
      <button class="quick-btn" title="Lua 5.3 Command Center" onclick={() => launchLuaHost(220, 70)}>
        🌙
      </button>
      <button class="quick-btn" title="Notepad" onclick={() => StartNotepad(320, 70)}>
        📝
      </button>
      <button class="quick-btn" title="GDI Paint" onclick={() => StartPaintDemo(240, 100)}>
        🎨
      </button>
      <button class="quick-btn" title="Show Desktop" onclick={minimizeAll}>
        🖥️
      </button>
    </div>

    <div class="taskbar-divider"></div>

    <div class="taskbar-windows">
      {#each topWindows as win (win.hwnd)}
        <button
          class="taskbar-item {kernel.activeHwnd === win.hwnd && !win.minimized ? 'active' : ''}"
          onclick={() => toggleTaskbarWindow(win.hwnd)}
        >
          <span class="window-icon">🗔</span>
          <span class="window-title">{win.title || "Window"}</span>
        </button>
      {/each}
    </div>

    <div class="system-tray">
      <button
        class="tray-btn"
        title={soundEnabled ? "Mute Audio" : "Unmute Audio"}
        onclick={toggleSound}
      >
        {soundEnabled ? "🔊" : "🔇"}
      </button>
      <span class="clock">{timeString}</span>
    </div>
  </div>

  <MessageBoxModal />
</div>

<style>
  .desktop-container {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background-color: #008080;
    font-family: "MS Sans Serif", "Pixelated MS Sans Serif", Tahoma, Arial, sans-serif;
  }

  .desktop-surface {
    position: relative;
    flex: 1;
    overflow: hidden;
  }

  .taskbar {
    height: 30px;
    background: #c0c0c0;
    border-top: 2px solid #ffffff;
    box-shadow: inset 0 1px 0 #dfdfdf;
    display: flex;
    align-items: center;
    padding: 2px 4px;
    gap: 4px;
    z-index: 9999;
  }

  .start-button {
    height: 24px;
    padding: 2px 6px;
    display: flex;
    align-items: center;
    gap: 4px;
    font-weight: bold;
    font-size: 11px;
    cursor: default;
  }

  .start-button.active {
    background: #e0e0e0;
    box-shadow:
      inset -1px -1px #fff,
      inset 1px 1px #0a0a0a,
      inset -2px -2px #dfdfdf,
      inset 2px 2px grey;
  }

  .quick-launch {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 0 1px;
  }

  .quick-btn {
    width: 22px;
    height: 22px;
    min-width: 22px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    background: transparent;
    border: 1px solid transparent;
    cursor: default;
    border-radius: 0;
    box-shadow: none;
  }

  .quick-btn:hover {
    box-shadow:
      inset -1px -1px #0a0a0a,
      inset 1px 1px #fff,
      inset -2px -2px grey,
      inset 2px 2px #dfdfdf;
  }

  .quick-btn:active {
    box-shadow:
      inset -1px -1px #fff,
      inset 1px 1px #0a0a0a,
      inset -2px -2px #dfdfdf,
      inset 2px 2px grey;
    background: #e0e0e0;
  }

  .start-flag {
    font-size: 13px;
  }

  .taskbar-divider {
    width: 2px;
    height: 20px;
    border-left: 1px solid #808080;
    border-right: 1px solid #ffffff;
    margin: 0 2px;
  }

  .taskbar-windows {
    display: flex;
    flex: 1;
    gap: 3px;
    overflow-x: auto;
  }

  .taskbar-item {
    height: 24px;
    max-width: 160px;
    flex: 1;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 2px 6px;
    font-size: 11px;
    text-align: left;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .taskbar-item.active {
    background: #e0e0e0;
    border: 2px inset #ffffff;
    font-weight: bold;
  }

  .window-icon {
    font-size: 11px;
  }

  .window-title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .system-tray {
    height: 22px;
    padding: 2px 4px;
    border: 2px inset #ffffff;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #c0c0c0;
    gap: 4px;
  }

  .tray-btn {
    background: transparent;
    border: none;
    box-shadow: none;
    font-size: 12px;
    cursor: default;
    padding: 0 2px;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: unset;
    min-height: unset;
    height: 18px;
    border-radius: 0;
  }

  .tray-btn:hover {
    box-shadow:
      inset -1px -1px #0a0a0a,
      inset 1px 1px #fff,
      inset -2px -2px grey,
      inset 2px 2px #dfdfdf;
  }

  .clock {
    font-size: 11px;
    color: #000;
    padding-right: 2px;
  }
</style>
