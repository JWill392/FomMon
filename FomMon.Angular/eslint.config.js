// eslint.config.js
import typescriptEslint from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';

export default [
    {
        files: ['**/*.ts'],
        languageOptions: {
            parser: typescriptParser,
            parserOptions: {
                project: './tsconfig.json',
            },
        },
        plugins: {
            '@typescript-eslint': typescriptEslint,
        },
        rules: {
            // Prevent direct equality on FeatureIdentifier
            'no-restricted-syntax': [
                'error',
                {
                    selector:
                        'BinaryExpression[operator=/^[!=]==?$/] > Identifier[name=/featureId|FeatureIdentifier/i]',
                    message: 'Use fidEquals() to compare FeatureIdentifier objects instead of === or ==',
                },
                {
                    selector:
                        'BinaryExpression[operator=/^[!=]==?$/] > MemberExpression > Identifier[property.name="featureId"]',
                    message: 'Use fidEquals() to compare FeatureIdentifier objects instead of === or ==',
                },
            ],
        },
    },
];