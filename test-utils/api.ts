/**
 * API Mock Helpers
 *
 * Provides typed mock references and helper functions for testing.
 * The global mock is set up in jest.setup.ts.
 */

import * as api from '@/lib/api';

// Export typed mock references
export const mockApiGet = api.apiGet as jest.Mock;
export const mockApiPost = api.apiPost as jest.Mock;
export const mockApiPut = api.apiPut as jest.Mock;
export const mockApiDelete = api.apiDelete as jest.Mock;

// Reset all mocks to default state
export const resetApiMocks = () => {
  jest.clearAllMocks();
};
