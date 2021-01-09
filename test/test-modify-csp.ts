import { strict as assert } from 'assert';
import { describe } from 'mocha';
import { modify_csp } from '../src/background/lib';

const test_data = [
    ["frame-src whatever", "frame-src whatever"],

    ["style-src 'none'", "style-src data:"],
    ["style-src https://example.com", "style-src https://example.com data:"],
    ["style-src data:", "style-src data:"],
    ["style-src https://example.com data:", "style-src https://example.com data:"],

    ["default-src data:", "default-src data:"],
    ["default-src https://example.com data:", "default-src https://example.com data:"],

    ["default-src 'none'", "default-src 'none'; style-src data:"],
    ["default-src https://example.com", "default-src https://example.com; style-src https://example.com data:"],
];

describe('test modify CSP', () => {
    test_data.forEach(([src, expected]) => {
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
