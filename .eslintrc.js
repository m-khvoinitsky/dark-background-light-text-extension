module.exports = {
    parserOptions: {
        ecmaVersion: 2017,
        ecmaFeatures: {
            impliedStrict: true,
        },
    },
    env: {
        browser: true,
        es6: true,
        webextensions: true,
    },
    extends: 'eslint:recommended',
    rules: {
        'indent': [
            'error',
            4,
            {
                SwitchCase: 1,
            }
        ],
        'linebreak-style': [
            'error',
            'unix',
        ],
        'quotes': [
            'error',
            'single',
        ],
        'semi': [
            'error',
            'always',
        ],
        'eqeqeq': [
            'error',
        ],
        'comma-dangle': [
            'error',
            'always-multiline',
        ],
        'prefer-template': [
            'error',
        ],
        'no-unused-vars': [
            'warn',
        ],
        'no-var': [
            'warn',
        ]
    },
};
