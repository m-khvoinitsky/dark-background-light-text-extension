import type {
    AddonOptions,
    MethodExecutor,
} from '../../common/types';

export class InvertMethod implements MethodExecutor {
    window: Window;

    // @ts-ignore: TS6133
    constructor(window: Window, options: AddonOptions) {
        this.window = window;
    }

    load_into_window() {
        let el: HTMLElement|null = this.window.document.querySelector('#mybpwaycfxccmnp-dblt-backdrop-filter');
        if (!el) {
            el = this.window.document.createElement('div');
            el.setAttribute('id', 'mybpwaycfxccmnp-dblt-backdrop-filter');
            el.style.display = 'none';
            this.window.document.documentElement.appendChild(el);
        }
    }

    unload_from_window() {
        const el = this.window.document.querySelector('#mybpwaycfxccmnp-dblt-backdrop-filter');
        if (el !== null) {
            el.parentElement!.removeChild(el);
        }
    }
}
