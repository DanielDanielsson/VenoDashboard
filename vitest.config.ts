import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@content': path.resolve(__dirname, 'content'),
      '@ui': path.resolve(__dirname, 'ui')
    }
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'ui/**/*.spec.ts', 'ui/**/*.spec.tsx'],
    setupFiles: ['./tests/setup.ts']
  }
});
