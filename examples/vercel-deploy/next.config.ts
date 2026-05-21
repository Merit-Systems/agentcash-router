import type { NextConfig } from 'next';

// Derive BASE_URL from Vercel system env vars when not explicitly set.
// @agentcash/router requires BASE_URL at build time — without this, a fresh
// Vercel deploy with only the wallet/CDP envs set would fail with `missing_base_url`.
//
// Precedence:
//   1. Explicit BASE_URL                                  (always wins)
//   2. VERCEL_PROJECT_PRODUCTION_URL → https://<that>      (the stable production alias — correct)
//   3. VERCEL_URL → https://<that>                         (per-deployment URL — last-resort fallback)
//
// Setting an explicit BASE_URL is recommended for custom domains.
if (!process.env.BASE_URL) {
  const productionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const deploymentUrl = process.env.VERCEL_URL;
  if (productionUrl) {
    process.env.BASE_URL = `https://${productionUrl}`;
  } else if (deploymentUrl) {
    process.env.BASE_URL = `https://${deploymentUrl}`;
  }
}

const config: NextConfig = {
  // The router computes its config eagerly at import — surface any env issues
  // as build failures instead of runtime 500s.
  eslint: { ignoreDuringBuilds: true },
  env: {
    NEXT_PUBLIC_BASE_URL: process.env.BASE_URL ?? '',
  },
};

export default config;
