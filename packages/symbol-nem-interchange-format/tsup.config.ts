import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { index: 'src/index.ts', 'argon2-worker': 'src/internal/argon2-worker.ts' },
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: false,
  target: 'es2022',
  splitting: false,
  noExternal: ['@noble/hashes'],
});
