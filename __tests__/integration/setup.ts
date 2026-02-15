/**
 * Integration Test Setup
 *
 * This file is loaded before integration tests run.
 * It sets up the MSW server to intercept network requests.
 */

import { server } from '../mocks/server';

// Start server before all tests
beforeAll(() => {
  server.listen({
    onUnhandledRequest: 'warn', // Warn about unhandled requests
  });
});

// Reset handlers after each test (removes runtime handlers)
afterEach(() => {
  server.resetHandlers();
});

// Clean up after all tests
afterAll(() => {
  server.close();
});
