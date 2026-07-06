import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  entry: [
    'tests/**/*.test.ts',
    'tests/**/*.test-d.ts',
    'tests/integration-429.ts',
    'tests/integration/test-*.ts',
  ],
  project: ['src/**/*.ts', 'tests/**/*.ts'],
  ignoreExportsUsedInFile: {
    interface: true,
  },
};

export default config;
