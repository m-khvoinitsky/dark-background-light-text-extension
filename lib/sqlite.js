let { Cu } = require("chrome");
Cu.import("resource://gre/modules/Sqlite.jsm");

exports.sqlite = Sqlite.openConnection;
