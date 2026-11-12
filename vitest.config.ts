import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['calc/test/**/*.test.ts', 'deco/test/**/*.test.ts', 'src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['calc/src/**/*.ts', 'deco/src/**/*.ts'],
      exclude: ['calc/src/index.ts', 'deco/src/index.ts'],
      reporter: ['text', 'json-summary'],
      thresholds: { branches: 100, functions: 100, lines: 100, statements: 100 },
    },
  },
});
