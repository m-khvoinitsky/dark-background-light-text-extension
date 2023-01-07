import { strict as assert } from 'assert';
import { describe } from 'mocha';
import { lint, LintResult } from 'stylelint';
import type { RenderOptions } from '../src/common/types';
import { methods } from '../src/methods/methods-with-stylesheets';

function format_error(results: LintResult[], source: string): string {
  const result_lines: string[] = [];
  for (const result of results) {
    result_lines.push(`${result.warnings.length} errors`);
    for (const error of result.warnings) {
      result_lines.push(
        `\n\n${error.line}:${error.column}: ${error.severity}: ${error.text}\n`,
      );
      source.split('\n').forEach((line, line_number, splitted) => {
        const pad = splitted.length.toString().length;
        if (line_number - error.line >= -6 && line_number - error.line < 5) {
          const line_number_1 = line_number + 1;
          result_lines.push(
            `${line_number_1.toString().padStart(pad, ' ')}| ${
              error.line === line_number_1 ? '>' : ' '
            } ${line}`,
          );
          if (line_number_1 === error.line) {
            result_lines.push(
              `${' '.repeat(pad)}|  ${' '.repeat(error.column)}^`,
            );
          }
        }
      });
    }
    for (const error of result.invalidOptionWarnings) {
      result_lines.push(error.text);
    }
  }
  return result_lines.join('\n');
}

describe('Test if valid CSS are rendered', () => {
  new Set(
    Object.values(methods)
      .map((m) => m.stylesheets || [])
      .flat(),
  ).forEach((renderer) => {
    const options: RenderOptions = {
      default_foreground_color: '#123456',
      default_background_color: '#123456',
      default_link_color: '#123456',
      default_visited_color: '#123456',
      default_active_color: '#123456',
      default_selection_color: '#123456',
      is_toplevel: true,
      is_darkbg: true,
    };
    for (const [is_toplevel, is_darkbg] of [
      [true, true],
      [false, false],
      [true, false],
      [false, true],
    ]) {
      options.is_toplevel = is_toplevel;
      options.is_darkbg = is_darkbg;
      const options_copy = { ...options };
      it(`${renderer.name} ${JSON.stringify({
        is_toplevel,
        is_darkbg,
      })}`, async () => {
        const rendered = renderer.render(options_copy);
        const result_object = await lint({
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
                  ignore: ['selectors-within-list'],
                },
              ],
              'at-rule-disallowed-list': [
                'document', // obsolete
              ],
              'rule-empty-line-before': null,
              indentation: 2,
              // forbid comments in rendered stylesheet
              'comment-pattern': '(?!)',
              'selector-not-notation': 'simple',
              'no-empty-first-line': null,
              'selector-class-pattern': null,
              'selector-id-pattern': null,
              'selector-no-vendor-prefix': null,
              'property-no-vendor-prefix': null,
            },
          },
          code: rendered,
          formatter: 'string',
        });
        assert(
          !result_object.errored,
          `${format_error(result_object.results, rendered)}\n\n${
            '' /* result_object.output */
          }`,
        );
      });
    }
  });
});
