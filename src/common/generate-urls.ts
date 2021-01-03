export const hint_marker = '<next_is_preferred>';

export function is_IPv4(maybe_ip: string): boolean {
    if (maybe_ip.length < 7 || maybe_ip.length > 15) {
        return false
    }
    let number_of_octets = 0;
    let first: number|null = null;
    let second: number|null = null;
    let third: number|null = null;
    for (let i = 0; i <= maybe_ip.length; i++) {
        const code = maybe_ip.charCodeAt(i);
        if (code === 46 /* . */ || i === maybe_ip.length /* last special iteration */) {
            number_of_octets++;
            if (number_of_octets > 4 || (number_of_octets < 4 && i === maybe_ip.length)) {
                return false
            }
            if (first === null) {
                return false
            }
            if (third !== null && (first * 100 + second! * 10 + third) > 255) {
                return false
            }
            first = null;
            second = null;
            third = null;
            continue
        } else if (code < 48 /* 0 */ || code > 57 /* 9 */) {
            return false;
        }
        const digit = code - 48;
        if (first === null) {
            first = digit;
            continue
        } else if (second === null) {
            second = digit;
            continue
        } else if (third === null) {
            third = digit;
            continue
        } else {
            return false
        }
    }
    return true
}

function split_domain_dumb(hostname: string): [string, string[]] {
    const splitted = hostname.split('.');
    return [splitted.pop()!, splitted];
}

export function generate_urls(
    url_str: string,
    hint: boolean = false,
    split_domain_func = split_domain_dumb,
): string[] {
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

        if (!is_IPv4(url_obj.hostname) && url_obj.hostname.indexOf('.') >= 0) {
            let [domain, subdomain_parts] = split_domain_func(url_obj.hostname);
            if (subdomain_parts) {
                for (let i = 0; i < subdomain_parts.length; i++) {
                    result_list.push(`${subdomain_parts.slice(i, subdomain_parts.length).join('.')}.${domain}`);
                }
            }
            result_list.push(is_http ? domain : `${protocol_real}${domain}`);
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
