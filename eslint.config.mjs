import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-require-imports': 'off', // We use require() for lazy-loading optional peer deps
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-unsafe-function-type': 'off', // x402 server is untyped (Record<string, Function>)
      'no-empty': ['error', { allowEmptyCatch: true }], // Fire-and-forget catch blocks are intentional
    },
  },
  {
    ignores: ['dist/', 'node_modules/', 'tsup.config.ts', 'vitest.config.ts'],
  },
);
