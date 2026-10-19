import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/**/*.test.{ts,tsx}'],
    // Meridian's own setup, as the release wrote it, then what only this console's tests need.
    setupFiles: ['./tests/setup.ts', './tests/setup.console.ts'],
    testTimeout: 20_000,
    // `ZZ_TEST_REPORT=<file>` makes a run also write every test file's result as JSON to that file, so the gate's own
    // run is the per-file evidence a review quotes, and no second whole-suite run is made to get it. Unset, a run
    // writes nothing: a run of a few files must never overwrite the record of a whole one.
    ...(process.env.ZZ_TEST_REPORT
      ? { reporters: ['default', 'json'], outputFile: { json: process.env.ZZ_TEST_REPORT } }
      : {}),
  },
});
