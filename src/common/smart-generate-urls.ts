import { parse as tldts_parse } from 'tldts';
import { generate_urls } from './generate-urls';

export function smart_generate_urls(
  url_str: string,
  hint: boolean = false,
): string[] {
  return generate_urls(url_str, hint, (hostname) => {
    const tldts_obj = tldts_parse(hostname, {
      detectIp: false,
      extractHostname: false,
    });
    return [
      tldts_obj.domain!,
      tldts_obj.subdomain ? tldts_obj.subdomain.split('.') : [],
    ];
  });
}
