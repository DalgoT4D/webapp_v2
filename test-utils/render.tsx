/**
 * Test Render Utilities
 *
 * Provides wrapper components for testing with proper providers.
 */

import React from 'react';
import { SWRConfig } from 'swr';

/**
 * TestWrapper - Wraps components with SWR provider for isolated testing
 *
 * Features:
 * - Fresh cache per test (provider: () => new Map())
 * - No deduping (dedupingInterval: 0)
 * - No polling (refreshInterval: 0)
 */
export const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <SWRConfig
    value={{
      provider: () => new Map(), // Fresh cache per test
      dedupingInterval: 0, // No deduping in tests
      refreshInterval: 0, // No polling in tests
    }}
  >
    {children}
  </SWRConfig>
);

/**
 * PollingTestWrapper - Wrapper that allows SWR polling for testing polling behavior
 *
 * Use this with jest.useFakeTimers() for testing polling scenarios.
 */
export const PollingTestWrapper = ({ children }: { children: React.ReactNode }) => (
  <SWRConfig
    value={{
      provider: () => new Map(),
      dedupingInterval: 0,
      // refreshInterval is NOT set, allowing components to use their own intervals
    }}
  >
    {children}
  </SWRConfig>
);
