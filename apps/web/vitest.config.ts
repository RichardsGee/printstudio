import { defineConfig } from 'vitest/config';

/**
 * Unit tests puros (sem DOM, sem Next). Por enquanto só lib/.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    globals: false,
  },
});
