import type { NextConfig } from 'next';

const config: NextConfig = {
  // The router computes its config eagerly at import — surface any env issues
  // as build failures instead of runtime 500s.
  eslint: { ignoreDuringBuilds: true },
};

export default config;
