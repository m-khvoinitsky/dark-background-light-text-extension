const { Ci, Cc } = require("chrome");

exports.gppmm = Cc["@mozilla.org/parentprocessmessagemanager;1"].getService(Ci.nsIProcessScriptLoader);
