import type { NextConfig } from 'next';

const config: NextConfig = {};
// Deliberately minimal. Next 16 removed the `eslint` config key (builds no
// longer run ESLint — use the standalone `lint` script). The router computes
// its config eagerly at import, so env issues surface as build failures.

export default config;
