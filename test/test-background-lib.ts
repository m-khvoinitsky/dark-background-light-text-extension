import { strict as assert } from 'assert';
import { describe } from 'mocha';
import {
    modify_csp,
    modify_cors,
    version_lt,
} from '../src/background/lib';
import { WebRequest } from 'webextension-polyfill-ts';
import { readFileSync } from 'fs';

const csp_test_data = [
    ["frame-src whatever", "frame-src whatever"],

    ["style-src 'none'", "style-src 'unsafe-inline'"],
    ["style-src https://example.com", "style-src https://example.com 'unsafe-inline'"],
    ["style-src 'unsafe-inline'", "style-src 'unsafe-inline'"],
    ["style-src data:", "style-src data: 'unsafe-inline'"],
    ["style-src https://example.com data:", "style-src https://example.com data: 'unsafe-inline'"],
    ["style-src https://example.com 'unsafe-inline'", "style-src https://example.com 'unsafe-inline'"],

    ["default-src 'unsafe-inline'", "default-src 'unsafe-inline'"],
    ["default-src https://example.com 'unsafe-inline'", "default-src https://example.com 'unsafe-inline'"],

    ["default-src 'none'", "default-src 'none'; style-src 'unsafe-inline'"],
    ["default-src https://example.com", "default-src https://example.com; style-src https://example.com 'unsafe-inline'"],
];

describe('test modify CSP', () => {
    csp_test_data.forEach(([src, expected]) => {
        it(src, () => {
            let result = modify_csp({
                name: 'Content-Security-Policy',
                value: src,
            });
            assert.equal(result.value, expected);
        });
    });
    it('other header', () => {
        let header = {
            name: 'h9U4yPiZTzYTfiHZgSWk',
            value: '¤frÃ;åÑ¯Nzô+ Õ¤&§¹öö±H6ÍWiØa (Ì^nD$i+ösâ[*',
        }
        assert.equal(modify_csp(header), header);
    })
});

const cors_test_data: Array<[string, WebRequest.HttpHeaders, {documentUrl?: string}, WebRequest.HttpHeaders]> = [
    [
        'no documentUrl',
        [
            {name: 'Some-Random-Header', value: 'Some value'},
        ],
        {
            documentUrl: undefined,
        },
        [
            {name: 'Some-Random-Header', value: 'Some value'},
        ],
    ],
    [
        'just add Access-Control-Allow-Origin',
        [
            {name: 'Some-Random-Header', value: 'Some value'},
        ],
        {
            documentUrl: 'https://example.com/example',
        },
        [
            {name: 'Some-Random-Header', value: 'Some value'},
            {name: 'Access-Control-Allow-Origin', value: 'https://example.com'},
        ],
    ],
    [
        'do nothing',
        [
            {name: 'Some-Random-Header', value: 'Some value'},
            {name: 'Access-Control-Allow-Origin', value: 'https://example.com'},
            {name: 'Some-Another-Random-Header', value: 'Some value'},
        ],
        {
            documentUrl: 'https://example.com/example',
        },
        [
            {name: 'Some-Random-Header', value: 'Some value'},
            {name: 'Access-Control-Allow-Origin', value: 'https://example.com'},
            {name: 'Some-Another-Random-Header', value: 'Some value'},
        ],
    ],
    [
        'modify',
        [
            {name: 'Some-Random-Header', value: 'Some value'},
            {name: 'Access-Control-Allow-Origin', value: 'https://example.org'},
            {name: 'Some-Another-Random-Header', value: 'Some value'},
        ],
        {
            documentUrl: 'https://example.com/example',
        },
        [
            {name: 'Some-Random-Header', value: 'Some value'},
            {name: 'Access-Control-Allow-Origin', value: 'https://example.com'},
            {name: 'Some-Another-Random-Header', value: 'Some value'},
        ],
    ],
    [
        'modify lowercase',
        [
            {name: 'Some-Random-Header', value: 'Some value'},
            {name: 'access-control-allow-origin', value: 'https://example.org'},
            {name: 'Some-Another-Random-Header', value: 'Some value'},
        ],
        {
            documentUrl: 'https://example.com/example',
        },
        [
            {name: 'Some-Random-Header', value: 'Some value'},
            {name: 'access-control-allow-origin', value: 'https://example.com'},
            {name: 'Some-Another-Random-Header', value: 'Some value'},
        ],
    ],
];

describe('test modify Access-Control-Allow-Origin', () => {
    cors_test_data.forEach(([name, src, details, expected]) => {
        it(name, () => {
            assert.deepEqual(modify_cors(src, details as WebRequest.OnHeadersReceivedDetailsType), expected);
        });
    })
});


const test_versions: Array<[string, string, boolean]> = [
    ['1.0.0', '2.0.0', true],
    ['1.0.0', '1.1.0', true],
    ['1.1.0', '1.1.1', true],

    ['1.2.3', '1.2.3', false],

    ['1.0.0', '0.1.1', false],
    ['1.1.0', '1.0.1', false],
    ['1.1.2', '1.1.1', false],

    ['1.0', '0.1.1', false],
    ['1.0', '1.0.1', true],
    ['1.0.1.1', '1.0.1', false],
    ['1.0.1.0', '1.0.1', false],
    ['1.0.0.1', '1.0.1', true],
];

describe('test version_lt', () => {
    test_versions.forEach(([target, ref, expected_result]) => {
        it(`${target} ${expected_result ? '<' : '>='} ${ref}`, () => {
            assert.equal(version_lt(target, ref), expected_result);
        });
    });
    let current_ver = JSON.parse(readFileSync('./manifest.json', 'utf-8'))['version'];
    it(`0.1.0 < ${current_ver} (current version)`, () => {
        assert.equal(version_lt('0.1.0', current_ver), true);
    });
    it('ensure that current version is parseable by version_lt', () => {
        assert(
            /^[0-9.]+$/.test(current_ver),
            'version_lt() only handles simple versions (i. e. dot-separated numbers). If you want to use alpha, beta, etc versions, you better use semver library.',
        );
    });
})
