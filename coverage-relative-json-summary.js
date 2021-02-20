// eslint-disable-next-line import/no-extraneous-dependencies
const { ReportBase } = require('istanbul-lib-report');
const { writeFileSync } = require('fs');
const { relative } = require('path');

class RelativeJsonSummaryReport extends ReportBase {
    constructor() {
        super();

        this.data = {};
    }

    onDetail(node) {
        this.data[
            relative(
                process.cwd(),
                node.getFileCoverage().path,
            )
        ] = node.getCoverageSummary();
    }

    onEnd() {
        writeFileSync(
            'last-coverage-summary.json',
            `${JSON.stringify(this.data, null, 4)}\n`,
            { encoding: 'utf8' },
        );
    }
}
module.exports = RelativeJsonSummaryReport;
