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
            'always',
        ],
        'prefer-template': [
            'error',
        ]
    },
};
