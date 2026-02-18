/**
 * API Mock Helpers
 *
 * Provides typed mock references and helper functions for testing.
 * The global mock is set up in jest.setup.ts.
 */

import * as api from '@/lib/api';
import {
  mockPipelines,
  mockTasks,
  mockConnections,
  mockPipelineDetail,
  mockRunHistory,
  mockLogs,
} from './data/pipeline';

// Export typed mock references
export const mockApiGet = api.apiGet as jest.Mock;
export const mockApiPost = api.apiPost as jest.Mock;
export const mockApiPut = api.apiPut as jest.Mock;
export const mockApiDelete = api.apiDelete as jest.Mock;

// Reset all mocks to default state
export const resetApiMocks = () => {
  jest.clearAllMocks();
};

// Setup default mock responses for common endpoints
export const setupDefaultMocks = (
  overrides: {
    pipelines?: any[];
    tasks?: any[];
    connections?: any[];
    pipelineDetail?: any;
    runHistory?: any[];
    logs?: any;
  } = {}
) => {
  mockApiGet.mockImplementation((url: string) => {
    // List all pipelines
    if (url === '/api/prefect/v1/flows/') {
      return Promise.resolve(overrides.pipelines ?? mockPipelines);
    }
    // List transform tasks
    if (url === '/api/prefect/tasks/transform/') {
      return Promise.resolve(overrides.tasks ?? mockTasks);
    }
    // List connections
    if (url === '/api/airbyte/v1/connections') {
      return Promise.resolve(overrides.connections ?? mockConnections);
    }
    // Get single pipeline detail
    if (url.match(/\/api\/prefect\/v1\/flows\/[\w-]+$/)) {
      return Promise.resolve(overrides.pipelineDetail ?? mockPipelineDetail);
    }
    // Get run history
    if (url.match(/\/api\/prefect\/v1\/flows\/[\w-]+\/flow_runs\/history/)) {
      return Promise.resolve(overrides.runHistory ?? mockRunHistory);
    }
    // Get logs
    if (url.match(/\/api\/prefect\/flow_runs\/[\w-]+\/logs/)) {
      return Promise.resolve(overrides.logs ?? mockLogs);
    }
    return Promise.reject(new Error(`Unmocked GET: ${url}`));
  });

  mockApiPost.mockResolvedValue({ success: true });
  mockApiPut.mockResolvedValue({ success: true });
  mockApiDelete.mockResolvedValue({ success: true });
};
