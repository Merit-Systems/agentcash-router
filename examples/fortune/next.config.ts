import path from 'node:path';
import type { NextConfig } from 'next';

const config: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  // Root at the monorepo, not this app: silences the "multiple lockfiles"
  // warning AND keeps the `link:../..` router dependency resolvable — under
  // Turbopack (Next 16 default) this root scopes module resolution, so an
  // app-dir root makes the symlinked package unreachable (module-not-found).
  outputFileTracingRoot: path.resolve(__dirname, '../..'),
  turbopack: {
    root: path.resolve(__dirname, '../..'),
  },
};

export default config;
