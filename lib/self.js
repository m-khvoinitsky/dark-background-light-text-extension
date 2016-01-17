/*
* sdk/self is not works inside a process script
* because require('@loader/options') fails.
* It is a slightly modified version of sdk/self
* Unfortunately, it seems that there is no way to write this file witout
* including some addon specific information (like id).
* Also, behavior with modified preferences-branch in package.json is
* undefined.
* */

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const { CC } = require('chrome');
const { get } = require("sdk/preferences/service");
const { readURISync } = require('sdk/net/url');

const id = 'jid1-QoFqdK4qzUfGWQ@jetpack';

const readPref = key => get("extensions." + id + ".sdk." + key);

const name = readPref("name");
const version = readPref("version");
const loadReason = readPref("load.reason");
const rootURI = readPref("rootURI");
const baseURI = readPref("baseURI");
const addonDataURI = baseURI + "data/";
const permissions = JSON.parse(readURISync(rootURI + 'package.json')).permissions || {};
const isPacked = rootURI && rootURI.indexOf("jar:") === 0;

const isPrivateBrowsingSupported = 'private-browsing' in permissions &&
    permissions['private-browsing'] === true;


const uri = ('includes' in String.prototype) ?
    (path="") => path.includes(":") ? path : addonDataURI + path.replace(/^\.\//, "") : // Gecko 40+
    (path="") => path.contains(":") ? path : addonDataURI + path.replace(/^\.\//, "");  // Gecko 18-39

// Some XPCOM APIs require valid URIs as an argument for certain operations
// (see `nsILoginManager` for example). This property represents add-on
// associated unique URI string that can be used for that.
exports.uri = 'addon:' + id;
exports.id = id;
exports.preferencesBranch = id;
exports.name = name;
exports.loadReason = loadReason;
exports.version = version;
exports.packed = isPacked;
exports.data = Object.freeze({
    url: uri,
    load: function read(path) {
        return readURISync(uri(path));
    }
});
exports.isPrivateBrowsingSupported = isPrivateBrowsingSupported;
