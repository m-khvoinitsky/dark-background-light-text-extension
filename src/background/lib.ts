import type { WebRequest } from 'webextension-polyfill';

export function modify_csp(
  header: WebRequest.HttpHeadersItemType,
): WebRequest.HttpHeadersItemType {
  if (header.name.toLowerCase() === 'content-security-policy') {
    const new_values = header.value!.split(',').map((value) => {
      const directives: { [key: string]: string[] } = {};
      for (const directive of value
        .split(';')
        .map((d) => d.trim())
        .filter((d) => d.length > 0)) {
        const parts = directive
          .split(' ')
          .map((p) => p.trim())
          .filter((p) => p.length > 0);
        const name = parts.shift()!;
        directives[name] = parts;
      }

      if (Object.prototype.hasOwnProperty.call(directives, 'style-src')) {
        if (directives['style-src'].includes("'unsafe-inline'")) {
          return value;
        } else if (
          directives['style-src'].length === 1
          && directives['style-src'][0] === "'none'"
        ) {
          directives['style-src'] = ["'unsafe-inline'"];
        } else {
          directives['style-src'].push("'unsafe-inline'");
        }
      } else if (
        Object.prototype.hasOwnProperty.call(directives, 'default-src')
      ) {
        if (directives['default-src'].includes("'unsafe-inline'")) {
          return value;
        } else if (
          directives['default-src'].length === 1
          && directives['default-src'][0] === "'none'"
        ) {
          directives['style-src'] = ["'unsafe-inline'"];
        } else {
          directives['style-src'] = directives['default-src'].slice();
          directives['style-src'].push("'unsafe-inline'");
        }
      } else {
        return value;
      }

      return Object.keys(directives)
        .map((k) => `${k} ${directives[k].join(' ')}`)
        .join('; ');
    });
    return {
      name: header.name,
      value: new_values.join(' , '),
    };
  } else {
    return header;
  }
}

export function modify_cors(
  headers: WebRequest.HttpHeaders,
  details: WebRequest.OnHeadersReceivedDetailsType,
) {
  // Workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=1393022
  if (details.documentUrl) {
    const url_obj = new URL(details.documentUrl);
    let done = false;
    for (const header of headers) {
      if (header.name.toLowerCase() === 'access-control-allow-origin') {
        header.value = url_obj.origin;
        done = true;
      }
    }
    if (!done) {
      headers.push({
        name: 'Access-Control-Allow-Origin',
        value: url_obj.origin,
      });
    }
  }
  return headers;
}

function splitver(ver: string): number[] {
  return ver.split('.').map((s) => parseInt(s, 10));
}

/** Very simple "less than" for version strings
 * Does **not** handle alpha, beta, etc postfixes, only dot-separated numbers */
export function version_lt(target: string, ref: string): boolean {
  const t_a = splitver(target);
  const r_a = splitver(ref);

  const length = Math.max(t_a.length, r_a.length);
  for (let i = 0; i < length; i++) {
    const t = t_a[i] ?? 0;
    const r = r_a[i] ?? 0;
    if (t === r) {
      continue;
    }
    return t < r;
  }
  return false;
}
