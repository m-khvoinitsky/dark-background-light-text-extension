module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true,
    webextensions: true,
  },
  extends: ['eslint:recommended', 'prettier'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  settings: {
    'import/resolver': {
      typescript: {},
    },
  },
  rules: {
    // most overrides are based on airbnb rule with some change
    camelcase: ['off'],
    'import/prefer-default-export': ['off'],
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
    // ESLint does not detects modules properly
    // in particular, it treats check-coverage as a module
    strict: 'off',
    'lines-around-directive': 'off',
  },
  overrides: [
    {
      files: ['*.ts'],
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
      files: ['./test/**'],
      rules: {
        'no-console': ['off'],
      },
    },
  ],
};
