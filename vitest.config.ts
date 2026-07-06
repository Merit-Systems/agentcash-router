import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    setupFiles: ['./tests/setup.ts'],
    passWithNoTests: true,
    typecheck: {
      // Type-level tests for the builder's compile-time invariants.
      // `*.test-d.ts` files are typechecked (tsc), not executed.
      enabled: true,
      include: ['tests/**/*.test-d.ts'],
      tsconfig: './tsconfig.typetest.json',
    },
  },
});
