export type RGBA = [number, number, number, number];
export type RGB = [number, number, number];
export type HSL = [number, number, number];
export interface HSV_obj {
  H: number;
  S: number;
  V: number;
}
export interface RGB_obj {
  R: number;
  G: number;
  B: number;
}

export type MethodIndex = '-1' | '0' | '1' | '2' | '3';
export interface ConfiguredPages {
  [key: string]: MethodIndex;
}
export interface ConfiguredTabs {
  [key: number]: MethodIndex;
}
export interface AddonOptions {
  enabled: boolean;
  global_toggle_hotkey: string;
  tab_toggle_hotkey: string;
  default_method: MethodIndex;
  default_foreground_color: string;
  default_background_color: string;
  default_link_color: string;
  default_visited_color: string;
  default_active_color: string;
  default_selection_color: string;
  do_not_set_overrideDocumentColors_to_never: boolean;
  configured_pages: ConfiguredPages;
}
export type PrefsType = string | number | boolean | ConfiguredPages;
interface Preference {
  type: 'bool' | 'menulist' | 'color' | 'configured_pages';
  name: string;
  value: PrefsType;
  options?: Array<{ label: string; value: string }>;
  title: string;
}
export interface BoolPreference extends Preference {
  type: 'bool';
  name: string;
  value: boolean;
  options: undefined;
  title: string;
}
export interface MenuListPreference extends Preference {
  type: 'menulist';
  name: string;
  value: number;
  options: Array<{ label: string; value: string }>;
  title: string;
}
export interface ColorPreference extends Preference {
  type: 'color';
  name: string;
  value: string;
  options: undefined;
  title: string;
}
export interface ConfiguredPagesPreference extends Preference {
  type: 'configured_pages';
  name: string;
  value: ConfiguredPages;
  options: undefined;
  title: string;
}
export type Preferences = (
  | BoolPreference
  | MenuListPreference
  | ColorPreference
  | ConfiguredPagesPreference
)[];

export interface RenderOptions {
  default_foreground_color: string;
  default_background_color: string;
  default_link_color: string;
  default_visited_color: string;
  default_active_color: string;
  default_selection_color: string;
  is_toplevel: boolean;
  is_darkbg: boolean;
}

export interface StylesheetRendererBare {
  name: string;
}

export interface StylesheetRenderer extends StylesheetRendererBare {
  render: (options: RenderOptions) => string;
}

export interface MethodMetadataBare {
  label: string;
  number: MethodIndex;
  affects_iframes: boolean;
  stylesheets: StylesheetRendererBare[];
}

export interface MethodMetadataWithStylesheets extends MethodMetadataBare {
  stylesheets: StylesheetRenderer[];
}
export interface MethodExecutor {
  load_into_window(): void;
  unload_from_window(): void;
}
export interface MethodExecutorStatic {
  new (window: Window, options: AddonOptions): MethodExecutor;
}
export interface MethodMetadataWithExecutors extends MethodMetadataBare {
  executor: MethodExecutorStatic | null;
}
export type MethodsMetadataBare = {
  [key: string /* MethodIndex */]: MethodMetadataBare;
};
export type MethodsMetadataWithStylesheets = {
  [key: string /* MethodIndex */]: MethodMetadataWithStylesheets;
};
export type MethodsMetadataWithExecutors = {
  [key: string /* MethodIndex */]: MethodMetadataWithExecutors;
};

export interface DefaultColors {
  default_light_color: RGBA;
  default_dark_color: RGBA;
}

// eslint bug?
// eslint-disable-next-line no-shadow
export const enum CallbackID {
  INSERT_CSS,
  REMOVE_CSS,
}
