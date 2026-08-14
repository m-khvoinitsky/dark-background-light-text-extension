import type { Browser } from 'webextension-polyfill';
import { generate_urls } from './generate-urls';

declare const browser: Browser;

export function smart_generate_urls(
  url_str: string,
  hint: boolean = false,
): string[] {
  return generate_urls(url_str, hint, (hostname) => {
    // generate_urls only calls this for dotted, non-IPv4 hostnames.
    // allowUnknownSuffix keeps hostnames under a suffix Firefox does not know
    // from collapsing to nothing, which is what the public suffix list would
    // otherwise do to intranet names.
    const domain = browser.publicSuffix.getDomain(hostname, {
      allowUnknownSuffix: true,
    });
    if (domain === null || domain === hostname) {
      return [hostname, []];
    }
    const subdomain = hostname.slice(0, -(domain.length + 1));
    return [domain, subdomain ? subdomain.split('.') : []];
  });
}
