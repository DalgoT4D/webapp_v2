/**
 * MSW Server Setup
 *
 * This creates a mock server for Node.js environment (Jest tests).
 * Import this in your test setup files.
 */

import { setupServer } from 'msw/node';
import { handlers } from './handlers';

// Create the mock server with default handlers
export const server = setupServer(...handlers);
