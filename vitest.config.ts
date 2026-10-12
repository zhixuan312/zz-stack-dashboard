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
  },
});
