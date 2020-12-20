import { deepStrictEqual } from 'assert';
import { describe } from 'mocha';
import { generate_urls, hint_marker } from '../src/common/generate-urls';

const test_urls = {
    'about:config': [
        hint_marker,
        'about:config',
        'about:',
    ],
    'about:preferences': [
        hint_marker,
        'about:preferences',
        'about:',
    ],
    'https://www.bla.www.co.uk.fgehsu.kokoko.website.co.uk/en-US/products/firefox?as=u&utm_source=inproduct#asdfasdf=qwer': [
        "www.bla.www.co.uk.fgehsu.kokoko.website.co.uk/en-US/products/firefox",
        "www.bla.www.co.uk.fgehsu.kokoko.website.co.uk/en-US/products",
        "www.bla.www.co.uk.fgehsu.kokoko.website.co.uk/en-US",
        hint_marker,
        "www.bla.www.co.uk.fgehsu.kokoko.website.co.uk",
        "bla.www.co.uk.fgehsu.kokoko.website.co.uk",
        "www.co.uk.fgehsu.kokoko.website.co.uk",
        "co.uk.fgehsu.kokoko.website.co.uk",
        "uk.fgehsu.kokoko.website.co.uk",
        "fgehsu.kokoko.website.co.uk",
        "kokoko.website.co.uk",
        "website.co.uk",
    ],
    'https://user:pass@www.bla.www.co.uk.fgehsu.kokoko.website.co.uk/en-US/products/firefox?as=u&utm_source=inproduct#asdfasdf=qwer': [
        "www.bla.www.co.uk.fgehsu.kokoko.website.co.uk/en-US/products/firefox",
        "www.bla.www.co.uk.fgehsu.kokoko.website.co.uk/en-US/products",
        "www.bla.www.co.uk.fgehsu.kokoko.website.co.uk/en-US",
        hint_marker,
        "www.bla.www.co.uk.fgehsu.kokoko.website.co.uk",
        "bla.www.co.uk.fgehsu.kokoko.website.co.uk",
        "www.co.uk.fgehsu.kokoko.website.co.uk",
        "co.uk.fgehsu.kokoko.website.co.uk",
        "uk.fgehsu.kokoko.website.co.uk",
        "fgehsu.kokoko.website.co.uk",
        "kokoko.website.co.uk",
        "website.co.uk",
    ],
    'https://www.bla.www.co.uk.fgehsu.kokoko.website.co.uk:8080/en-US/products/firefox?as=u&utm_source=inproduct#asdfasdf=qwer': [
        "www.bla.www.co.uk.fgehsu.kokoko.website.co.uk:8080/en-US/products/firefox",
        "www.bla.www.co.uk.fgehsu.kokoko.website.co.uk:8080/en-US/products",
        "www.bla.www.co.uk.fgehsu.kokoko.website.co.uk:8080/en-US",
        hint_marker,
        "www.bla.www.co.uk.fgehsu.kokoko.website.co.uk:8080",
        "www.bla.www.co.uk.fgehsu.kokoko.website.co.uk",
        "bla.www.co.uk.fgehsu.kokoko.website.co.uk",
        "www.co.uk.fgehsu.kokoko.website.co.uk",
        "co.uk.fgehsu.kokoko.website.co.uk",
        "uk.fgehsu.kokoko.website.co.uk",
        "fgehsu.kokoko.website.co.uk",
        "kokoko.website.co.uk",
        "website.co.uk",
    ],
    'https://user:pass@www.bla.www.co.uk.fgehsu.kokoko.website.co.uk:8080/en-US/products/firefox?as=u&utm_source=inproduct#asdfasdf=qwer': [
        "www.bla.www.co.uk.fgehsu.kokoko.website.co.uk:8080/en-US/products/firefox",
        "www.bla.www.co.uk.fgehsu.kokoko.website.co.uk:8080/en-US/products",
        "www.bla.www.co.uk.fgehsu.kokoko.website.co.uk:8080/en-US",
        hint_marker,
        "www.bla.www.co.uk.fgehsu.kokoko.website.co.uk:8080",
        "www.bla.www.co.uk.fgehsu.kokoko.website.co.uk",
        "bla.www.co.uk.fgehsu.kokoko.website.co.uk",
        "www.co.uk.fgehsu.kokoko.website.co.uk",
        "co.uk.fgehsu.kokoko.website.co.uk",
        "uk.fgehsu.kokoko.website.co.uk",
        "fgehsu.kokoko.website.co.uk",
        "kokoko.website.co.uk",
        "website.co.uk",
    ],
    'https://jfgeh.corp.company.local/en-US/products/firefox?as=u&utm_source=inproduct#asdfasdf=qwer': [
        "jfgeh.corp.company.local/en-US/products/firefox",
        "jfgeh.corp.company.local/en-US/products",
        "jfgeh.corp.company.local/en-US",
        hint_marker,
        "jfgeh.corp.company.local",
        "corp.company.local",
        "company.local",
    ],
    'https://jfgeh/en-US/products/firefox?as=u&utm_source=inproduct#asdfasdf=qwer': [
        "jfgeh/en-US/products/firefox",
        "jfgeh/en-US/products",
        "jfgeh/en-US",
        hint_marker,
        "jfgeh",
    ],
    'https://support.mozilla.org/en-US/products/firefox?as=u&utm_source=inproduct#asdfasdf=qwer': [
        "support.mozilla.org/en-US/products/firefox",
        "support.mozilla.org/en-US/products",
        "support.mozilla.org/en-US",
        hint_marker,
        "support.mozilla.org",
        "mozilla.org",
    ],
    'https://support.mozilla.org/': [
        hint_marker,
        "support.mozilla.org",
        "mozilla.org",
    ],
    'https://support.mozilla.org': [
        hint_marker,
        "support.mozilla.org",
        "mozilla.org",
    ],
    'moz-extension://11256f55-552a-40ee-9c36-75a0be32137f/ui/preferences.html': [
        'moz-extension://11256f55-552a-40ee-9c36-75a0be32137f/ui/preferences.html',
        'moz-extension://11256f55-552a-40ee-9c36-75a0be32137f/ui',
        hint_marker,
        'moz-extension://11256f55-552a-40ee-9c36-75a0be32137f',
        'moz-extension://',
    ],
    'chrome-extension://mloybvmrdjplqsjvwgckcuevcfryxqqv/something/dashboard.html#settings.html': [
        'chrome-extension://mloybvmrdjplqsjvwgckcuevcfryxqqv/something/dashboard.html',
        'chrome-extension://mloybvmrdjplqsjvwgckcuevcfryxqqv/something',
        hint_marker,
        'chrome-extension://mloybvmrdjplqsjvwgckcuevcfryxqqv',
        'chrome-extension://',
    ],
    'file:///home/user/dark-background-light-text/test/test-pages/target-blank/1st.html': [
        "file:///home/user/dark-background-light-text/test/test-pages/target-blank/1st.html",
        "file:///home/user/dark-background-light-text/test/test-pages/target-blank",
        "file:///home/user/dark-background-light-text/test/test-pages",
        "file:///home/user/dark-background-light-text/test",
        "file:///home/user/dark-background-light-text",
        "file:///home/user",
        hint_marker,
        "file:///home",
        "file://",
    ],
    'file:///c:/Users/Public/Documents/dark-background-light-text/test/test-pages/target-blank/1st.html': [
        "file:///c:/Users/Public/Documents/dark-background-light-text/test/test-pages/target-blank/1st.html",
        "file:///c:/Users/Public/Documents/dark-background-light-text/test/test-pages/target-blank",
        "file:///c:/Users/Public/Documents/dark-background-light-text/test/test-pages",
        "file:///c:/Users/Public/Documents/dark-background-light-text/test",
        "file:///c:/Users/Public/Documents/dark-background-light-text",
        "file:///c:/Users/Public/Documents",
        "file:///c:/Users/Public",
        "file:///c:/Users",
        hint_marker,
        "file:///c:",
        "file://",
    ],
    'http://172.123.10.1/test/kokoko': [
        '172.123.10.1/test/kokoko',
        '172.123.10.1/test',
        hint_marker,
        '172.123.10.1',
    ],
    'http://user:pass@172.123.10.1/test/kokoko': [
        '172.123.10.1/test/kokoko',
        '172.123.10.1/test',
        hint_marker,
        '172.123.10.1',
    ],
    'http://172.123.10.1:8080/test/kokoko': [
        '172.123.10.1:8080/test/kokoko',
        '172.123.10.1:8080/test',
        hint_marker,
        '172.123.10.1:8080',
        '172.123.10.1',
    ],
    'http://user:pass@172.123.10.1:8080/test/kokoko': [
        '172.123.10.1:8080/test/kokoko',
        '172.123.10.1:8080/test',
        hint_marker,
        '172.123.10.1:8080',
        '172.123.10.1',
    ],
    'http://openwrt/cgi-bin/luci': [
        'openwrt/cgi-bin/luci',
        'openwrt/cgi-bin',
        hint_marker,
        'openwrt',
    ],
    'http://openwrt:8080/cgi-bin/luci': [
        'openwrt:8080/cgi-bin/luci',
        'openwrt:8080/cgi-bin',
        hint_marker,
        'openwrt:8080',
        'openwrt',
    ],
    'http://[fdfe:5b0f:4148::1]/cgi-bin/luci': [
        '[fdfe:5b0f:4148::1]/cgi-bin/luci',
        '[fdfe:5b0f:4148::1]/cgi-bin',
        hint_marker,
        '[fdfe:5b0f:4148::1]',
    ],
    'http://user:pass@[fdfe:5b0f:4148::1]/cgi-bin/luci': [
        '[fdfe:5b0f:4148::1]/cgi-bin/luci',
        '[fdfe:5b0f:4148::1]/cgi-bin',
        hint_marker,
        '[fdfe:5b0f:4148::1]',
    ],
    'http://[fdfe:5b0f:4148::1]:8080/cgi-bin/luci': [
        '[fdfe:5b0f:4148::1]:8080/cgi-bin/luci',
        '[fdfe:5b0f:4148::1]:8080/cgi-bin',
        hint_marker,
        '[fdfe:5b0f:4148::1]:8080',
        '[fdfe:5b0f:4148::1]',
    ],
    'http://user:pass@[fdfe:5b0f:4148::1]:8080/cgi-bin/luci': [
        '[fdfe:5b0f:4148::1]:8080/cgi-bin/luci',
        '[fdfe:5b0f:4148::1]:8080/cgi-bin',
        hint_marker,
        '[fdfe:5b0f:4148::1]:8080',
        '[fdfe:5b0f:4148::1]',
    ],
};

const really_bad_urls = [
    'asdf',
];

describe('generate_urls', () => {
    Object.entries(test_urls).forEach(([url, result]) => {
        it(url, () => {
            deepStrictEqual(generate_urls(url), result.filter(s => s !== hint_marker));
            deepStrictEqual(generate_urls(url, true), result);
        })
    })
    really_bad_urls.forEach((url) => {
        it(url, () => {
            // in case if URL is really bad, original URL itself is returned
            // TODO: mock console.error here
            deepStrictEqual(generate_urls(url), [url]);
            deepStrictEqual(generate_urls(url, true), [hint_marker, url]);
        })
    })
})
