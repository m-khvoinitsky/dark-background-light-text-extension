import { WebRequest } from 'webextension-polyfill-ts';

export function modify_csp(
    header: WebRequest.HttpHeadersItemType,
): WebRequest.HttpHeadersItemType {
    if (header.name.toLowerCase() === 'content-security-policy') {
        let new_values = header.value!.split(',').map(value => {
            let directives: {[key: string]: string[]} = {};
            for (let directive of value.split(';').map(d => d.trim()).filter(d => d.length > 0)) {
                let parts = directive.split(' ').map(p => p.trim()).filter(p => p.length > 0);
                let name = parts.shift()!;
                directives[name] = parts;
            }

            if (directives.hasOwnProperty('style-src')) {
                if (directives['style-src'].includes('data:'))
                    return value;
                else if (directives['style-src'].length === 1 && directives['style-src'][0] === "'none'")
                    directives['style-src'] = ['data:'];
                else
                    directives['style-src'].push('data:');
            } else if (directives.hasOwnProperty('default-src')) {
                if (directives['default-src'].includes('data:'))
                    return value;
                else if (directives['default-src'].length === 1 && directives['default-src'][0] === "'none'")
                    directives['style-src'] = [ 'data:' ];
                else {
                    directives['style-src'] = directives['default-src'].slice();
                    directives['style-src'].push('data:');
                }
            } else
                return value;

            return Object.keys(directives).map(k => `${k} ${directives[k].join(' ')}`).join('; ');
        });
        return {
            name: header.name,
            value: new_values.join(' , '),
        };
    } else
        return header;
};
