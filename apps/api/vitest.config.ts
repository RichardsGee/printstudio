import { defineConfig } from 'vitest/config';

/**
 * Vitest config minimal. Tests rodam Node ESM nativo + path alias do
 * tsconfig. Sem DB real — apenas unit tests com mocks.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    globals: false,
    setupFiles: ['./test/setup.ts'],
  },
});
