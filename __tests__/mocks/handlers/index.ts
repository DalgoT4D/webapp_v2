/**
 * Combined MSW Handlers
 *
 * Export all handlers from feature-specific files.
 * Add new handler files here as you create them.
 */

import { pipelineHandlers } from './pipeline';

export const handlers = [
  ...pipelineHandlers,
  // Add more handlers as needed:
  // ...chartHandlers,
  // ...dashboardHandlers,
  // ...authHandlers,
];
