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

/**
 * One numbering space for both directions, so a misrouted message can never
 * be mistaken for a valid one at the other end.
 */
export const enum MessageAction {
  QUERY_TAB_ID,
  INSERT_CSS,
  REMOVE_CSS,
  QUERY_BASE_STYLE,
  GET_CONFIGURED_PRIVATE,
  SET_CONFIGURED_PRIVATE,
  GET_MY_TAB_CONFIGURATION,
  GET_TAB_CONFIGURATION,
  SET_CONFIGURED_TAB,
  OPEN_OPTIONS_PAGE,
  IS_COMMANDS_UPDATE_AVAILABLE,
  QUERY_PARENT_METHOD_NUMBER,
  GET_METHOD_NUMBER,
}

/** Messages the background script accepts over runtime.sendMessage. */
export type Message =
  | { action: MessageAction.QUERY_TAB_ID }
  | { action: MessageAction.INSERT_CSS; code: string }
  | { action: MessageAction.REMOVE_CSS; code: string }
  | { action: MessageAction.QUERY_BASE_STYLE }
  | { action: MessageAction.GET_CONFIGURED_PRIVATE }
  | {
      action: MessageAction.SET_CONFIGURED_PRIVATE;
      key: string;
      value: MethodIndex | null;
    }
  | { action: MessageAction.GET_MY_TAB_CONFIGURATION }
  | { action: MessageAction.GET_TAB_CONFIGURATION; tab_id: number }
  | {
      action: MessageAction.SET_CONFIGURED_TAB;
      key: number;
      value: MethodIndex | null;
    }
  | { action: MessageAction.OPEN_OPTIONS_PAGE }
  | { action: MessageAction.IS_COMMANDS_UPDATE_AVAILABLE }
  | { action: MessageAction.QUERY_PARENT_METHOD_NUMBER };

/** Messages a content script accepts over tabs.sendMessage. */
export type ContentMessage = { action: MessageAction.GET_METHOD_NUMBER };

/** What each message is answered with. */
export interface MessageResponses {
  [MessageAction.QUERY_TAB_ID]: number | undefined;
  [MessageAction.INSERT_CSS]: void;
  [MessageAction.REMOVE_CSS]: void;
  [MessageAction.QUERY_BASE_STYLE]: string;
  [MessageAction.GET_CONFIGURED_PRIVATE]: ConfiguredPages;
  [MessageAction.SET_CONFIGURED_PRIVATE]: void;
  [MessageAction.GET_MY_TAB_CONFIGURATION]: MethodIndex | false;
  [MessageAction.GET_TAB_CONFIGURATION]: MethodIndex | false;
  [MessageAction.SET_CONFIGURED_TAB]: void;
  [MessageAction.OPEN_OPTIONS_PAGE]: void;
  [MessageAction.IS_COMMANDS_UPDATE_AVAILABLE]: boolean;
  [MessageAction.QUERY_PARENT_METHOD_NUMBER]: MethodIndex;
  [MessageAction.GET_METHOD_NUMBER]: MethodIndex;
}

export type MessageResponse<M extends Message | ContentMessage> =
  MessageResponses[M['action']];

export function is_message(
  message: unknown,
): message is Message | ContentMessage {
  return typeof message === 'object' && message !== null && 'action' in message;
}
