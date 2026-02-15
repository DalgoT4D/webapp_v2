/**
 * Jest Configuration for Integration Tests
 *
 * This is a separate config for integration tests that properly handles
 * MSW and other ESM dependencies.
 */

import type { Config } from 'jest';

const config: Config = {
  displayName: 'integration',
  testEnvironment: 'jsdom',
  testEnvironmentOptions: {
    customExportConditions: [''],
  },
  // Setup files - order matters!
  setupFiles: ['<rootDir>/jest.polyfills.ts'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts', '<rootDir>/__tests__/integration/setup.ts'],
  // Module resolution
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@components/(.*)$': '<rootDir>/components/$1',
    '^@hooks/(.*)$': '<rootDir>/hooks/$1',
    '^@lib/(.*)$': '<rootDir>/lib/$1',
    '^@stores/(.*)$': '<rootDir>/stores/$1',
  },
  // Only run integration tests
  testMatch: [
    '<rootDir>/__tests__/integration/**/*.test.ts',
    '<rootDir>/__tests__/integration/**/*.test.tsx',
  ],
  testPathIgnorePatterns: ['<rootDir>/.next/', '<rootDir>/node_modules/'],
  // Transform TypeScript and ESM modules
  transform: {
    '^.+\\.(ts|tsx|js|jsx|mjs)$': ['babel-jest', { presets: ['next/babel'] }],
  },
  // Transform MSW and its ESM dependencies
  transformIgnorePatterns: [
    '/node_modules/(?!(msw|@mswjs|until-async|@bundled-es-modules|@open-draft|strict-event-emitter|outvariant)/)',
  ],
  // Resolve ESM modules
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'mjs', 'json', 'node'],
};

export default config;
