import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    include: ['src/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
