/**
 * @fileoverview Vitest configuration for Wealth AI unit tests.
 *
 * Configures the test environment, path aliases, coverage reporting,
 * and global setup for all unit and integration tests.
 *
 * @module vitest.config
 */

import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    /** Use Node.js environment for server-side code testing. */
    environment: 'node',

    /** Global test setup file. */
    setupFiles: [],

    /** Test file patterns. */
    include: ['src/__tests__/**/*.test.ts', 'src/__tests__/**/*.test.tsx'],

    /** Excluded directories. */
    exclude: ['node_modules', '.next', 'e2e'],

    /** Coverage configuration. */
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      include: [
        'src/services/**',
        'src/repositories/**',
        'src/lib/crypto/**',
        'src/lib/security/**',
        'src/lib/types/**',
        'src/lib/validation.ts',
      ],
      exclude: [
        'src/__tests__/**',
        'node_modules/**',
      ],
      thresholds: {
        statements: 70,
        branches: 60,
        functions: 70,
        lines: 70,
      },
    },

    /** Timeout for individual tests. */
    testTimeout: 10000,

    /** Enable global test functions (describe, it, expect). */
    globals: true,
  },

  /** Path aliases matching tsconfig.json. */
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
