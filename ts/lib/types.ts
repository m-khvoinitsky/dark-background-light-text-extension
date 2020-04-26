export type RGBA = [number, number, number, number]
export type RGB = [number, number, number]
export type HSL = [number, number, number]
export interface HSV_obj {
    H: number,
    S: number,
    V: number,
}
export interface RGB_obj {
    R: number,
    G: number,
    B: number,
}

export type MethodIndex = '-1'|'0'|'1'|'2'|'3'
export interface ConfiguredPages {
    [key: string]: MethodIndex
}
export interface ConfiguredTabs {
    [key: number]: MethodIndex
}
export interface AddonOptions {
    enabled: boolean,
    global_toggle_hotkey: string,
    tab_toggle_hotkey: string,
    default_method: MethodIndex,
    default_foreground_color: string,
    default_background_color: string,
    default_link_color: string,
    default_visited_color: string,
    default_active_color: string,
    default_selection_color: string,
    do_not_set_overrideDocumentColors_to_never: boolean,
    configured_pages: ConfiguredPages,
}
export type PrefsType = string|number|boolean|ConfiguredPages
export interface Preference {
    type: 'bool'|'hotkey'|'menulist'|'color'|'configured_pages',
    name: string,
    value: PrefsType, // TODO: restrict types per value of 'type'
    options?: Array<{label: string, value: string}> // TODO: restrict to type=menulist
    title: string,
    available?: Promise<boolean>,
}

export interface MethodMetadata {
    label: string,
    number: MethodIndex,
    affects_iframes: boolean,
    stylesheets: string[],
    executor: MethodExecutorStatic|null,
}

export interface DefaultColors {
    default_light_color: RGBA,
    default_dark_color: RGBA,
}

export interface MethodExecutorStatic {
    new (window: Window, options: AddonOptions): MethodExecutor;
}
export interface MethodExecutor {
    load_into_window(): void;
    unload_from_window(): void;
}
