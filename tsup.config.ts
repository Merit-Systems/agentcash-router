import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  clean: true,
  outDir: 'dist',
  // viem is a peer dep of mppx — in devDeps for types but not peerDeps,
  // so tsup won't auto-externalize it. Externalize to avoid bundling.
  external: ['viem', 'viem/chains'],
});
