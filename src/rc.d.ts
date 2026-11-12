declare module "*.rc" {
  import type { ResourceBundle, DialogTemplate, MenuTemplate } from "./src/rc/types";

  export const resources: ResourceBundle;
  export default resources;

  // Resource IDs
  export const IDD_ABOUTBOX: number;
  export const IDD_OPTIONS: number;
  export const IDR_CALC_MENU: number;
  export const IDM_FILE_EXIT: number;
  export const IDM_OPTIONS_PREFERENCES: number;
  export const IDM_HELP_ABOUT: number;
  export const IDC_SOUND_CHECK: number;
  export const IDC_RAD_DECIMAL: number;
  export const IDC_RAD_HEX: number;
  export const IDC_PRECISION_EDIT: number;
  export const IDC_VERSION_TEXT: number;
  export const IDC_COPYRIGHT_TEXT: number;
  export const IDOK: number;
  export const IDCANCEL: number;
  export const IDC_STATIC: number;
}
