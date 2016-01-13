let Worker;
try {
    throw new Error();
    Worker = require("sdk/deprecated/sync-worker").Worker;
    console.log('sdk/deprecated/sync-worker');
} catch (e) {
    Worker = require("sdk/content/worker").Worker;
    console.log('sdk/content/worker');
}
exports.Worker = Worker;