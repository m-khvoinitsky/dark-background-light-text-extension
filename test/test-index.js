/*var main = require("../");

exports["test main"] = function(assert) {
  assert.pass("Unit test running!");
};

exports["test main async"] = function(assert, done) {
  assert.pass("async Unit test running!");
  done();
};

exports["test dummy"] = function(assert, done) {
  main.dummy("foo", function(text) {
    assert.ok((text === "foo"), "Is the text actually 'foo'");
    done();
  });
};

require("sdk/test").run(exports);
*/

const main = require('../lib/index');
exports['test urls'] = assert => {
    let test_urls = {
        'about:config': ['about:config'],
        'https://www.bla.www.co.uk.shit.kokoko.website.co.uk/en-US/products/firefox?as=u&utm_source=inproduct#asdfasdf=qwer': [
            "website.co.uk",
            "kokoko.website.co.uk",
            "shit.kokoko.website.co.uk",
            "uk.shit.kokoko.website.co.uk",
            "co.uk.shit.kokoko.website.co.uk",
            "www.co.uk.shit.kokoko.website.co.uk",
            "bla.www.co.uk.shit.kokoko.website.co.uk",
            "bla.www.co.uk.shit.kokoko.website.co.uk/en-US",
            "bla.www.co.uk.shit.kokoko.website.co.uk/en-US/products",
            "bla.www.co.uk.shit.kokoko.website.co.uk/en-US/products/firefox"
        ],
        'https://www.bla.www.co.uk.shit.kokoko.website.co.uk:8080/en-US/products/firefox?as=u&utm_source=inproduct#asdfasdf=qwer': [
            "website.co.uk",
            "kokoko.website.co.uk",
            "shit.kokoko.website.co.uk",
            "uk.shit.kokoko.website.co.uk",
            "co.uk.shit.kokoko.website.co.uk",
            "www.co.uk.shit.kokoko.website.co.uk",
            "bla.www.co.uk.shit.kokoko.website.co.uk",
            "bla.www.co.uk.shit.kokoko.website.co.uk:8080",
            "bla.www.co.uk.shit.kokoko.website.co.uk:8080/en-US",
            "bla.www.co.uk.shit.kokoko.website.co.uk:8080/en-US/products",
            "bla.www.co.uk.shit.kokoko.website.co.uk:8080/en-US/products/firefox"
        ],
        'https://dick.corp.company.local/en-US/products/firefox?as=u&utm_source=inproduct#asdfasdf=qwer': [
            "company.local",
            "corp.company.local",
            "dick.corp.company.local",
            "dick.corp.company.local/en-US",
            "dick.corp.company.local/en-US/products",
            "dick.corp.company.local/en-US/products/firefox"
        ],
        'https://dick/en-US/products/firefox?as=u&utm_source=inproduct#asdfasdf=qwer': [
            "dick",
            "dick/en-US",
            "dick/en-US/products",
            "dick/en-US/products/firefox"
        ],
        'https://support.mozilla.org/en-US/products/firefox?as=u&utm_source=inproduct#asdfasdf=qwer': [
            "mozilla.org",
            "support.mozilla.org",
            "support.mozilla.org/en-US",
            "support.mozilla.org/en-US/products",
            "support.mozilla.org/en-US/products/firefox"
        ],
        'resource:///chrome/browser/content/branding/aboutDialog.css': [
            "resource://",
            "resource:///chrome",
            "resource:///chrome/browser",
            "resource:///chrome/browser/content",
            "resource:///chrome/browser/content/branding",
            "resource:///chrome/browser/content/branding/aboutDialog.css"
        ],
        'file:///home/misha/dark-background-light-text/test/test-pages/target-blank/1st.html': [
            "file://",
            "file:///home",
            "file:///home/misha",
            "file:///home/misha/dark-background-light-text",
            "file:///home/misha/dark-background-light-text/test",
            "file:///home/misha/dark-background-light-text/test/test-pages",
            "file:///home/misha/dark-background-light-text/test/test-pages/target-blank",
            "file:///home/misha/dark-background-light-text/test/test-pages/target-blank/1st.html"
        ],
        'resource://jid1-qofqdk4qzufgwq-at-jetpack/data/preferences.html': [
            "resource://jid1-qofqdk4qzufgwq-at-jetpack",
            "resource://jid1-qofqdk4qzufgwq-at-jetpack/data",
            "resource://jid1-qofqdk4qzufgwq-at-jetpack/data/preferences.html"
        ],
        'chrome://browser/content/browser.xul': [
            "chrome://browser",
            "chrome://browser/content",
            "chrome://browser/content/browser.xul"
        ],
        'chrome://browser/content/browser_.xul': [
            "chrome://browser",
            "chrome://browser/content",
            "chrome://browser/content/browser_.xul"
        ],
        'http://78.47.123.12/test/kokoko': [
            '78.47.123.12',
            '78.47.123.12/test',
            '78.47.123.12/test/kokoko'
        ],
        'http://78.47.123.12:8080/test/kokoko': [
            '78.47.123.12:8080',
            '78.47.123.12:8080/test',
            '78.47.123.12:8080/test/kokoko'
        ],
        'http://openwrt/cgi-bin/luci': [
            'openwrt',
            'openwrt/cgi-bin',
            'openwrt/cgi-bin/luci'
        ],
        'http://openwrt:8080/cgi-bin/luci': [
            'openwrt',
            'openwrt:8080',
            'openwrt:8080/cgi-bin',
            'openwrt:8080/cgi-bin/luci'
        ],
        'http://[fdfe:5b0f:4148::1]/cgi-bin/luci': [
            '[fdfe:5b0f:4148::1]',
            '[fdfe:5b0f:4148::1]/cgi-bin',
            '[fdfe:5b0f:4148::1]/cgi-bin/luci'
        ],
        'http://[fdfe:5b0f:4148::1]:8080/cgi-bin/luci': [
            '[fdfe:5b0f:4148::1]',
            '[fdfe:5b0f:4148::1]:8080',
            '[fdfe:5b0f:4148::1]:8080/cgi-bin',
            '[fdfe:5b0f:4148::1]:8080/cgi-bin/luci'
        ]
    };

    console.log('\nStart url test\n');
    Object.keys(test_urls).forEach(path => {
        try {
            let ret = main.generate_urls(path);
            if (test_urls[path].every((url, i, arr) => (url === ret.list[i]))) {
                console.log('PASSED:', path);
            } else {
                console.log('FAILED:', path);
                console.log('expected', test_urls[path]);
                console.log('got', ret.list);
            }
        } catch (e) {
            console.log('FAILED (exception):', path);
            console.log(e, e.message);
        }
    });
    console.log('\nEnd url test\n');
};
