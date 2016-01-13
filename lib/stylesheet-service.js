let { Cc, Ci } = require("chrome");

const stylesheet_service = Cc['@mozilla.org/content/style-sheet-service;1']
    .getService(Ci.nsIStyleSheetService);
const io_service = Cc['@mozilla.org/network/io-service;1']
    .getService(Ci.nsIIOService);

let { isTypeValid } = require('sdk/stylesheet/utils');
const SHEET_TYPE = {
    agent: stylesheet_service.AGENT_SHEET,
    user: stylesheet_service.USER_SHEET,
    author: stylesheet_service.AUTHOR_SHEET
};

exports.loadAndRegisterSheet = function loadAndRegisterSheet(uri, type) {
    if (!isTypeValid(type))
        return;
    let io_uri = io_service.newURI(uri, null, null);
    stylesheet_service.loadAndRegisterSheet(io_uri, SHEET_TYPE[type]);
};
exports.sheetRegistered = function sheetRegistered(uri, type) {
    if (!isTypeValid(type))
        return;
    let io_uri = io_service.newURI(uri, null, null);
    return stylesheet_service.sheetRegistered(io_uri, SHEET_TYPE[type])
};
exports.unregisterSheet = function unregisterSheet(uri, type) {
    if (!isTypeValid(type))
        return;
    let io_uri = io_service.newURI(uri, null, null);
    stylesheet_service.unregisterSheet(io_uri, SHEET_TYPE[type])
};