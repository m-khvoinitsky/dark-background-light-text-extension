import { MessageAction } from './types';
import { send_message } from './shared';

export async function query_style() {
  const css_promise = await send_message({
    action: MessageAction.QUERY_BASE_STYLE,
  });

  let ext_style = document.getElementById('base-extension-style');
  if (!ext_style) {
    const container = document.head || document.documentElement;
    ext_style = document.createElement('style');
    ext_style.setAttribute('id', 'base-extension-style');
    container.appendChild(ext_style);
  }
  ext_style.textContent = await css_promise;
}
if (document.readyState === 'loading') {
  document.addEventListener(
    'readystatechange',
    (_event) => {
      query_style().catch((rejection) => console.error(rejection));
    },
    { once: true },
  );
} else {
  query_style().catch((rejection) => console.error(rejection));
}
