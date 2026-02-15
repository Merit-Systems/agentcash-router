import path from 'node:path';
import type { NextConfig } from 'next';

const config: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Silence "multiple lockfiles" warning — this example lives inside the
  // router monorepo so Next.js sees both lockfiles and guesses the wrong root.
  outputFileTracingRoot: path.resolve(__dirname),
};

export default config;
