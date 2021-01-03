import { strict as assert } from 'assert';
import { describe } from 'mocha';
import { RenderOptions } from '../src/common/types';
import { methods } from '../src/methods/methods-with-stylesheets';
import { lint, LintResult, SyntaxType } from 'stylelint';

function format_error(results: LintResult[], source: string): string {
    let result_lines: string[] = [];
    for (let result of results) {
        result_lines.push(`${result.warnings.length} errors`);
        for (let error of result.warnings) {
            result_lines.push(`\n\n${error.line}:${error.column}: ${error.severity}: ${error.text}\n`);
            source.split('\n').forEach((line, line_number, splitted) => {
                let pad = splitted.length.toString().length;
                if ((line_number - error.line) >= -6 && (line_number - error.line) < 5) {
                    let line_number_1 = line_number + 1;
                    result_lines.push(`${line_number_1.toString().padStart(pad, ' ')}| ${error.line === line_number_1 ? '>' : ' '} ${line}`);
                    if (line_number_1 === error.line) {
                        result_lines.push(`${' '.repeat(pad)}|  ${' '.repeat(error.column)}^`);
                    }
                }
            });
        }
        for (let error of result.invalidOptionWarnings) {
            result_lines.push(error.text);
        }
    }
    return result_lines.join('\n');
}

describe('Test if valid CSS are rendered', () => {
    new Set(Object.values(methods).map(m => m.stylesheets || []).flat()).forEach(renderer => {
        let options: RenderOptions = {
            default_foreground_color: '#123456',
            default_background_color: '#123456',
            default_link_color: '#123456',
            default_visited_color: '#123456',
            default_active_color: '#123456',
            default_selection_color: '#123456',
            is_toplevel: true,
            is_darkbg: true,
        };
        for (let [is_toplevel, is_darkbg] of [
            [true, true],
            [false, false],
            [true, false],
            [false, true],
        ]) {
            options.is_toplevel = is_toplevel
            options.is_darkbg = is_darkbg
            it(`${renderer.name} ${JSON.stringify({is_toplevel, is_darkbg})}`, async () => {
                let rendered = renderer.render(options);
                let result_object = await lint({
                    config: {
                        extends: 'stylelint-config-standard',
                        rules: {
                            'color-hex-length': [
                                'long',
                                {
                                    string: 'long',
                                },
                            ],
                            'no-descending-specificity': [
                                true,
                                {
                                    'ignore': [
                                        'selectors-within-list',
                                    ],
                                },
                            ],
                            'rule-empty-line-before': null,
                            'indentation': 2,
                            // forbid comments in rendered stylesheet
                            'comment-pattern': '(?!)',
                        },
                    },
                    code: rendered,
                    syntax: 'css' as SyntaxType,
                    formatter: 'string',
                });
                assert(
                    !result_object.errored,
                    `${format_error(result_object.results, rendered)}\n\n${''/*result_object.output*/}`,
                );
            })
        }
    });
})
