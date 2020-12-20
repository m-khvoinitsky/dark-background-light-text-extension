import { parse } from 'tldts';

export const hint_marker = '<next_is_preferred>';

export function generate_urls(url_str: string, hint: boolean = false): string[] {
    // This whole function is one of the most fragile pieces of code I've ever written,
    // touch it with great caution. Likely, there are unittests.
    try {
        const url_obj = new URL(url_str);
        const result_list: string[] = [];
        const protocol_real = (url_obj.href.startsWith(`${url_obj.protocol}//`)) ?
            `${url_obj.protocol}//` : url_obj.protocol;
        const is_http = url_obj.protocol === 'http:' || url_obj.protocol === 'https:';
        let hint_added = false;
        if (hint && url_str.indexOf('/') < 0) {
            result_list.push(hint_marker);
            hint_added = true;
        }

        if (url_obj.pathname) {
            let pathname_parts = url_obj.pathname.split('/').filter(p => p.length > 0);
            let prepend_protocol_and_or_host = (
                (url_obj.host) ?
                    `${is_http ? '' : protocol_real}${url_obj.host}/` :
                    protocol_real.endsWith('//') ? `${protocol_real}/` : protocol_real
            );
            for (let i = pathname_parts.length - 1; i >= 0; i--) {
                result_list.push(`${prepend_protocol_and_or_host}${pathname_parts.slice(0, i + 1).join('/')}`)
            }
        }
        if (hint && !hint_added) {
            if (protocol_real === 'file://' && result_list.length > 0) {
                result_list.splice(result_list.length - 1, 0, hint_marker);
            } else {
                result_list.push(hint_marker);
            }
            hint_added = true;
        }
        if (url_obj.host && url_obj.hostname) {
            // host -> host:port
            // hostname -> host only
            if (url_obj.host !== url_obj.hostname) {
                // host:port if there is port
                // if there is no port, value will be added in the
                // next block (from tldts_obj)
                result_list.push(
                    is_http ? url_obj.host : `${protocol_real}${url_obj.host}`
                );
            }
        }

        let tldts_obj = parse(url_str);
        if (!tldts_obj.isIp && tldts_obj.domain) {
            if (tldts_obj.subdomain) {
                let subdomain_parts = tldts_obj.subdomain.split('.');
                for (let i = 0; i < subdomain_parts.length; i++) {
                    result_list.push(`${subdomain_parts.slice(i, subdomain_parts.length).join('.')}.${tldts_obj.domain}`);
                }
            }
            result_list.push(tldts_obj.domain);
        } else if (url_obj.hostname) {
            result_list.push(is_http ? url_obj.hostname : `${protocol_real}${url_obj.hostname}`);
        }

        if (!is_http) {
            result_list.push(protocol_real);
        }

        if (result_list.length == 0) {
            console.error(`generate_urls: no urls has been generated, returning original: ${url_str}`)
            return hint ? [hint_marker, url_str] : [url_str];
        }
        return result_list;
    } catch (e) {
        console.error(`generate_urls: something went wrong, returning original URL: ${url_str}`, e);
        // if something goes horribly wrong, return at least the original URL
        return hint ? [hint_marker, url_str] : [url_str];
    }
}
