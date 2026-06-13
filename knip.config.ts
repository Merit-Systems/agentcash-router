import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  entry: [
    // src/next.ts is covered by the package.json `exports` map ("./next").
    'tests/**/*.test.ts',
    'tests/integration-429.ts',
    'tests/integration/test-*.ts',
  ],
  project: ['src/**/*.ts', 'tests/**/*.ts'],
  ignoreExportsUsedInFile: {
    interface: true,
  },
};

export default config;
