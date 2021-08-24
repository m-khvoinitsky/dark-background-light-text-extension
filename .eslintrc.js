module.exports = {
    env: {
        browser: true,
        es2021: true,
        node: true,
        webextensions: true,
    },
    extends: [
        'airbnb-base',
    ],
    parser: '@typescript-eslint/parser',
    parserOptions: {
        ecmaVersion: 12,
        sourceType: 'module',
    },
    plugins: [
        '@typescript-eslint',
    ],
    settings: {
        'import/resolver': {
            typescript: {},
        },
    },
    rules: {
        // most overrides are based on airbnb rule with some change
        camelcase: [
            'off',
        ],
        curly: [
            'error',
            'all',
        ],
        'import/extensions': [
            'error',
            'ignorePackages',
            {
                js: 'never',
                jsx: 'never',
                mjs: 'never',
                ts: 'never',
            },
        ],
        'import/no-extraneous-dependencies': [
            'error',
            {
                devDependencies: true,
                optionalDependencies: false,
            },
        ],
        'import/prefer-default-export': [
            'off',
        ],
        indent: [
            'error',
            4,
            {
                ArrayExpression: 1,
                CallExpression: {
                    arguments: 1,
                },
                FunctionDeclaration: {
                    body: 1,
                    parameters: 1,
                },
                FunctionExpression: {
                    body: 1,
                    parameters: 1,
                },
                ImportDeclaration: 1,
                ObjectExpression: 1,
                SwitchCase: 1,
                VariableDeclarator: 1,
                flatTernaryExpressions: false,
                ignoreComments: false,
                ignoredNodes: [
                    'JSXElement',
                    'JSXElement > *',
                    'JSXAttribute',
                    'JSXIdentifier',
                    'JSXNamespacedName',
                    'JSXMemberExpression',
                    'JSXSpreadAttribute',
                    'JSXExpressionContainer',
                    'JSXOpeningElement',
                    'JSXClosingElement',
                    'JSXFragment',
                    'JSXOpeningFragment',
                    'JSXClosingFragment',
                    'JSXText',
                    'JSXEmptyExpression',
                    'JSXSpreadChild',
                ],
                outerIIFEBody: 1,
            },
        ],
        'lines-between-class-members': [
            'error',
            'always',
            {
                exceptAfterSingleLine: true,
            },
        ],
        'no-console': [
            'error',
            {
                allow: [
                    'warn',
                    'error',
                ],
            },
        ],
        'no-continue': [
            'off',
        ],
        'no-else-return': [
            'off',
        ],
        'no-lonely-if': [
            'off',
        ],
        'no-mixed-operators': [
            'error',
            {
                allowSamePrecedence: true,
                groups: [
                    [
                        '%',
                        '**',
                    ],
                    [
                        '%',
                        '+',
                    ],
                    [
                        '%',
                        '-',
                    ],
                    [
                        '%',
                        '*',
                    ],
                    [
                        '%',
                        '/',
                    ],
                    [
                        '/',
                        '*',
                    ],
                    [
                        '&',
                        '|',
                        '<<',
                        '>>',
                        '>>>',
                    ],
                    [
                        '==',
                        '!=',
                        '===',
                        '!==',
                    ],
                    [
                        '&&',
                        '||',
                    ],
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
        'no-plusplus': [
            'off',
        ],
        'no-restricted-syntax': [
            'error',
            {
                message: 'for..in loops iterate over the entire prototype chain, which is virtually never what you want. Use Object.{keys,values,entries}, and iterate over the resulting array.',
                selector: 'ForInStatement',
            },
            {
                message: 'Labels are a form of GOTO; using them makes code confusing and hard to maintain and understand.',
                selector: 'LabeledStatement',
            },
            {
                message: '`with` is disallowed in strict mode because it makes code impossible to predict and optimize.',
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
        'nonblock-statement-body-position': [
            'off',
        ],
        'prefer-destructuring': [
            'off',
            {
                array: false,
                object: true,
            },
        ],
        'require-await': 'error',
        // eslint does not detects modules properly
        // in particular, it treats check-coverage as a module
        strict: 'off',
        'lines-around-directive': 'off',
    },
    overrides: [
        {
            files: [
                '*.ts',
            ],
            rules: {
                'consistent-return': [
                    'off',
                ],
                'no-redeclare': [
                    'off',
                ],
                'no-undef': [
                    'off',
                ],
                'no-unused-vars': [
                    'off',
                ],
                'no-useless-return': [
                    'off',
                ],
                'no-dupe-class-members': 'off',
                '@typescript-eslint/no-dupe-class-members': ['error'],

                'lines-between-class-members': 'off',
                '@typescript-eslint/lines-between-class-members': ['error'],
            },
        },
        {
            files: [
                './test/**',
            ],
            rules: {
                'no-console': [
                    'off',
                ],
            },
        },
    ],
};
