import js from '@eslint/js';
import globals from 'globals';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import svelte from 'eslint-plugin-svelte';
import prettier from 'eslint-config-prettier';

export default [
  {
    ignores: ['dist/', 'coverage/', '.nyc_output/', 'build.xpi'],
  },
  js.configs.recommended,
  ...svelte.configs['flat/base'],
  prettier,
  ...svelte.configs['flat/prettier'],
  {
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.webextensions,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      // most overrides are based on airbnb rule with some change
      camelcase: ['off'],
      'no-console': [
        'error',
        {
          allow: ['warn', 'error'],
        },
      ],
      'no-continue': ['off'],
      'no-else-return': ['off'],
      'no-lonely-if': ['off'],
      'no-mixed-operators': [
        'error',
        {
          allowSamePrecedence: true,
          groups: [
            ['%', '**'],
            ['%', '+'],
            ['%', '-'],
            ['%', '*'],
            ['%', '/'],
            ['/', '*'],
            ['&', '|', '<<', '>>', '>>>'],
            ['==', '!=', '===', '!=='],
            ['&&', '||'],
          ],
        },
      ],
      'no-multi-spaces': [
        'error',
        {
          ignoreEOLComments: true,
        },
      ],
      'no-multiple-empty-lines': [
        'error',
        {
          max: 2,
          maxBOF: 0,
          maxEOF: 0,
        },
      ],
      'no-plusplus': ['off'],
      'no-restricted-syntax': [
        'error',
        {
          message:
            'for..in loops iterate over the entire prototype chain, which is virtually never what you want. Use Object.{keys,values,entries}, and iterate over the resulting array.',
          selector: 'ForInStatement',
        },
        {
          message:
            'Labels are a form of GOTO; using them makes code confusing and hard to maintain and understand.',
          selector: 'LabeledStatement',
        },
        {
          message:
            '`with` is disallowed in strict mode because it makes code impossible to predict and optimize.',
          selector: 'WithStatement',
        },
      ],
      'no-use-before-define': [
        'error',
        {
          classes: true,
          functions: false,
          variables: true,
        },
      ],
      'nonblock-statement-body-position': ['off'],
      'prefer-destructuring': [
        'off',
        {
          array: false,
          object: true,
        },
      ],
      'require-await': 'error',
      strict: 'off',
      'lines-around-directive': 'off',
    },
  },
  {
    // svelte files keep svelte-eslint-parser, set by the svelte flat configs
    files: ['**/*.ts', '**/*.mts', '**/*.js', '**/*.mjs'],
    languageOptions: {
      parser: tsParser,
    },
  },
  {
    files: ['**/*.ts', '**/*.mts'],
    rules: {
      'consistent-return': ['off'],
      'no-redeclare': ['off'],
      'no-undef': ['off'],
      'no-unused-vars': ['off'],
      'no-useless-return': ['off'],
      'no-dupe-class-members': 'off',
      '@typescript-eslint/no-dupe-class-members': ['error'],

      'lines-between-class-members': 'off',
    },
  },
  {
    files: ['**/*.svelte'],
    languageOptions: {
      parserOptions: {
        parser: tsParser,
      },
    },
    rules: {
      'no-undef': ['off'],
      'no-unused-vars': ['off'],
      // unsound here: it cannot see that `$:` blocks re-run, nor that an
      // instance script runs once per component instance
      'no-useless-assignment': ['off'],
    },
  },
  {
    // plain CommonJS scripts, not part of any bundle
    files: [
      'check-coverage',
      'coverage-relative-json-summary.js',
      'test/test-pages/**/*.js',
    ],
    languageOptions: {
      sourceType: 'commonjs',
      parser: undefined,
      globals: globals.node,
    },
  },
  {
    files: ['test/**'],
    rules: {
      'no-console': ['off'],
    },
  },
];
