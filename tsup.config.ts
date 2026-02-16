import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/client/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  clean: true,
  outDir: 'dist',
  // viem is a transitive dep of mpay — in devDeps for types but not peerDeps,
  // so tsup won't auto-externalize it. Externalize to avoid bundling.
  external: ['viem', 'viem/chains'],
});
