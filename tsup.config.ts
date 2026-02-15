import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  clean: true,
  outDir: 'dist',
  // viem is a transitive dep of mpay (optional peer dep) — externalize so
  // tsup doesn't try to bundle it. Only loaded at runtime when MPP + custom RPC is used.
  external: ['viem', 'viem/chains'],
});
