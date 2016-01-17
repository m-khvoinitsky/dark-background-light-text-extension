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
exports['test urls'] = () => {
    [
        'about:config',
        'https://www.bla.www.co.uk.shit.kokoko.website.co.uk/en-US/products/firefox?as=u&utm_source=inproduct#asdfasdf=qwer',
        'https://dick.corp.wargaming.local/en-US/products/firefox?as=u&utm_source=inproduct#asdfasdf=qwer',
        'https://dick/en-US/products/firefox?as=u&utm_source=inproduct#asdfasdf=qwer',
        'https://support.mozilla.org/en-US/products/firefox?as=u&utm_source=inproduct#asdfasdf=qwer',
        'resource:///chrome/browser/content/branding/aboutDialog.css',
        'file:///home/misha/dark-background-light-text/test/test-pages/target-blank/1st.html'
    ].forEach(path => console.log(path, main.generate_urls(path)));
};
