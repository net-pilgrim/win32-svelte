# Changelog

All notable changes to the `win32-svelte` project will be documented in this file.

## [Unreleased] - 2026-11-15

### Added
- **Choose Font Common Dialog**: Implemented the `commdlg` font selector (`ChooseFont`) as a Win32-style common dialog (`FontDialogModal.svelte`) with font family, style, size, strikeout/underline effects and a live sample preview.
- **`ChooseFont` API**: Added `kernel.ChooseFont` (Promise-based, matching `GetOpenFileName`/`ShowPrintDialog`), exported from `src/win32/dialog.ts` and `src/win32/index.ts`, with canvas-based font-family detection and point-size conversion helpers in `src/win32/ui/font_dialog_utils.ts`.
- **Wasm Bridge Font Dialog**: Replaced the silent `ChooseFontA`/`ChooseFontW` stubs with real `CHOOSEFONT`/`LOGFONT` marshalling honouring `CF_INITTOLOGFONTSTRUCT`, `CF_EFFECTS` and `CF_LIMITSIZE`, writing the chosen font back to guest memory.
- **Control Gallery Font Demo**: Added a Font group on the Effects tab with a live "Choose Font..." button applying the selection to a sample label.
- Added `src/win32/__tests__/font_dialog.test.ts` to the `npm test` chain.
- **Flat Start Menu Presentation**: De-beveled start menu entries in `StartMenu.svelte` to match authentic Windows 95/Windows 98 behavior, eliminating 3D button bevels (`box-shadow: none`) on menu buttons and submenu items.
- **`flat` Prop on `StartMenu`**: Added optional `flat` boolean prop (default `true`) allowing applications to choose between authentic flat menu entries and legacy beveled buttons.
- **CSS Variable Theming**: Introduced customizable CSS custom properties (`--win98-menu-bg`, `--win98-menu-color`, `--win98-highlight`, `--win98-highlight-text`, `--win98-menu-disabled`, `--win98-focus-outline`, `--win98-font-family`).
- **Classic Icon & Vibrant Emoji Rendering**:
  - Restored classic colorful emoji icons across the Start Button (`🪟`), Quick Launch toolbar, taskbar windows (`🗔`), system tray (`🔊`/`🔇`), desktop icons, and Start Menu.
  - Eliminated monochrome black silhouette rendering caused by `98.css` `color: transparent; text-shadow: 0 0 #222;` by explicitly overriding button text-shadows and setting `color: initial !important; text-shadow: none !important; font-family: "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif;`.
- **Authentic 3D Window Frames**:
  - Restored authentic Windows 98 3D frame border bevels (`inset -1px -1px #0a0a0a, inset 1px 1px #dfdfdf, inset -2px -2px grey, inset 2px 2px #fff`) with subtle drop-shadow and `3px` silver padding in `Window.svelte`.
  - Restored active (`navy` to `#1084d0`) and inactive (`grey` to `#b5b5b5`) title-bar gradients.
- **Smooth Typography**:
  - Antialiased Windows UI font stack (`"MS Sans Serif", Tahoma, "Segoe UI", Arial, sans-serif`) with `-webkit-font-smoothing: antialiased;` across the Start Menu, Taskbar, and Desktop.
- **Playwright Visual Testing Suite**:
  - Added `playwright.config.ts` configured with Chromium and automatic preview webServer.
  - Added `tests/visual.spec.ts` covering taskbar icon rendering, flat start menu layout, flyout submenus, keyboard navigation, window frame 3D bevels, and screenshot captures saved to `test-results/visual/`.
  - Added `npm run test:visual` to `package.json`.
- **Start Menu Keyboard Navigation**:
  - `ArrowDown` / `ArrowUp` to cycle through active menu items.
  - `ArrowRight` or `Enter` on parent items to open and focus flyout submenus.
  - `ArrowLeft` to collapse flyout submenus back to the parent item.
  - `Escape` (both locally on container and globally on window) to close the Start Menu.
  - Visible keyboard focus rings (`outline: 1px dotted`) preserving full accessibility.
- **Start Menu Utility Extraction & Unit Tests**:
  - Extracted menu actions and mnemonic parsing to `src/win32/ui/start_menu_utils.ts`.
  - Added comprehensive test suite `src/win32/__tests__/start_menu.test.ts` verifying mnemonic formatting, `startmenu.json` schema coverage, action dispatching, and CSS de-beveling rules.
