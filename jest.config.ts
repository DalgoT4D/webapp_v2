import type { Config } from 'jest';
import nextJest from 'next/jest.js';

const createJestConfig = nextJest({
  dir: './',
});

const customJestConfig: Config = {
  // setupFiles runs BEFORE the test environment (for polyfills)
  setupFiles: ['<rootDir>/jest.polyfills.ts'],
  // setupFilesAfterEnv runs AFTER the test environment (for jest-dom, mocks)
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testEnvironment: 'jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@components/(.*)$': '<rootDir>/components/$1',
    '^@hooks/(.*)$': '<rootDir>/hooks/$1',
    '^@lib/(.*)$': '<rootDir>/lib/$1',
    '^@stores/(.*)$': '<rootDir>/stores/$1',
  },
  // Run tests in both __tests__ directory and component-level __tests__ folders
  testMatch: [
    // Unit tests - co-located with components
    '<rootDir>/components/**/__tests__/**/*.test.ts',
    '<rootDir>/components/**/__tests__/**/*.test.tsx',
    '<rootDir>/app/**/__tests__/**/*.test.ts',
    '<rootDir>/app/**/__tests__/**/*.test.tsx',
    '<rootDir>/hooks/**/__tests__/**/*.test.ts',
    '<rootDir>/hooks/**/__tests__/**/*.test.tsx',
    // Unit tests - centralized
    '<rootDir>/__tests__/unit/**/*.test.ts',
    '<rootDir>/__tests__/unit/**/*.test.tsx',
    // Lib tests (utilities)
    '<rootDir>/__tests__/lib/**/*.test.ts',
    '<rootDir>/__tests__/lib/**/*.test.tsx',
    '<rootDir>/lib/**/__tests__/**/*.test.ts',
    '<rootDir>/lib/**/__tests__/**/*.test.tsx',
    // Integration tests
    '<rootDir>/__tests__/integration/**/*.test.ts',
    '<rootDir>/__tests__/integration/**/*.test.tsx',
  ],
  testPathIgnorePatterns: [
    '<rootDir>/.next/',
    '<rootDir>/node_modules/',
    '<rootDir>/e2e/', // Exclude Playwright E2E tests
    '<rootDir>/tests/', // Exclude old tests directory
  ],
  transform: {
    '^.+\\.(ts|tsx)$': ['babel-jest', { presets: ['next/babel'] }],
  },
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
  // Projects configuration for running unit and integration tests separately
  projects: [
    {
      displayName: 'unit',
      testEnvironment: 'jsdom',
      setupFiles: ['<rootDir>/jest.polyfills.ts'],
      setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
        '^@components/(.*)$': '<rootDir>/components/$1',
        '^@hooks/(.*)$': '<rootDir>/hooks/$1',
        '^@lib/(.*)$': '<rootDir>/lib/$1',
        '^@stores/(.*)$': '<rootDir>/stores/$1',
      },
      testMatch: [
        '<rootDir>/components/**/__tests__/**/*.test.ts',
        '<rootDir>/components/**/__tests__/**/*.test.tsx',
        '<rootDir>/app/**/__tests__/**/*.test.ts',
        '<rootDir>/app/**/__tests__/**/*.test.tsx',
        '<rootDir>/hooks/**/__tests__/**/*.test.ts',
        '<rootDir>/hooks/**/__tests__/**/*.test.tsx',
        '<rootDir>/__tests__/unit/**/*.test.ts',
        '<rootDir>/__tests__/unit/**/*.test.tsx',
        '<rootDir>/__tests__/lib/**/*.test.ts',
        '<rootDir>/__tests__/lib/**/*.test.tsx',
        '<rootDir>/lib/**/__tests__/**/*.test.ts',
        '<rootDir>/lib/**/__tests__/**/*.test.tsx',
      ],
      testPathIgnorePatterns: [
        '<rootDir>/.next/',
        '<rootDir>/node_modules/',
        '<rootDir>/__tests__/integration/',
      ],
      transform: {
        '^.+\\.(ts|tsx)$': ['babel-jest', { presets: ['next/babel'] }],
      },
    },
    {
      displayName: 'integration',
      testEnvironment: 'jsdom',
      testEnvironmentOptions: {
        // This tells jsdom to use Node.js module resolution for MSW
        customExportConditions: [''],
      },
      setupFiles: ['<rootDir>/jest.polyfills.ts'],
      setupFilesAfterEnv: ['<rootDir>/jest.setup.ts', '<rootDir>/__tests__/integration/setup.ts'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
        '^@components/(.*)$': '<rootDir>/components/$1',
        '^@hooks/(.*)$': '<rootDir>/hooks/$1',
        '^@lib/(.*)$': '<rootDir>/lib/$1',
        '^@stores/(.*)$': '<rootDir>/stores/$1',
      },
      testMatch: [
        '<rootDir>/__tests__/integration/**/*.test.ts',
        '<rootDir>/__tests__/integration/**/*.test.tsx',
      ],
      testPathIgnorePatterns: ['<rootDir>/.next/', '<rootDir>/node_modules/'],
      transform: {
        '^.+\\.(ts|tsx|mjs)$': ['babel-jest', { presets: ['next/babel'] }],
      },
      // Transform MSW and its dependencies (they use ESM)
      transformIgnorePatterns: [
        '/node_modules/(?!(msw|@mswjs|until-async|@bundled-es-modules|@open-draft)/)',
      ],
    },
  ],
};

export default createJestConfig(customJestConfig);
