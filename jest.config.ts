/**
 * Jest Configuration
 *
 * Simplified configuration - no MSW, no separate integration config.
 * All tests use Jest mocks via the global mock in jest.setup.ts.
 */

import type { Config } from 'jest';
import nextJest from 'next/jest.js';

const createJestConfig = nextJest({
  dir: './',
});

const customJestConfig: Config = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testEnvironment: 'jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  // Run tests in component-level __tests__ folders and lib tests
  testMatch: [
    '<rootDir>/components/**/__tests__/**/*.test.{ts,tsx}',
    '<rootDir>/app/**/__tests__/**/*.test.{ts,tsx}',
    '<rootDir>/hooks/**/__tests__/**/*.test.{ts,tsx}',
    '<rootDir>/lib/**/__tests__/**/*.test.{ts,tsx}',
    '<rootDir>/__tests__/lib/**/*.test.{ts,tsx}',
  ],
  testPathIgnorePatterns: [
    '<rootDir>/.next/',
    '<rootDir>/node_modules/',
    '<rootDir>/e2e/', // Exclude Playwright E2E tests
  ],
  collectCoverageFrom: [
    'components/**/*.{js,jsx,ts,tsx}',
    'app/**/*.{js,jsx,ts,tsx}',
    'lib/**/*.{js,jsx,ts,tsx}',
    'hooks/**/*.{js,jsx,ts,tsx}',
    'stores/**/*.{js,jsx,ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
  ],
  coverageThreshold: {
    global: {
      branches: 1,
      functions: 1,
      lines: 1,
      statements: 1,
    },
  },
};

export default createJestConfig(customJestConfig);
