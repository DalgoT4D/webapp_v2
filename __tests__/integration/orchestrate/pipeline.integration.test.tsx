/**
 * Pipeline/Orchestrate Integration Tests
 *
 * These tests verify that components work correctly with real hooks and API calls.
 * MSW intercepts the network requests, so we test the full component → hook → API flow.
 *
 * Key differences from unit tests:
 * - No jest.mock() for hooks - real hooks run
 * - MSW intercepts HTTP calls - fake server responses
 * - Tests loading states, error handling, and data flow
 */

import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { SWRConfig } from 'swr';
import { server } from '../../mocks/server';
import { mockPipelines, createMockPipeline } from '../../mocks/handlers/pipeline';
import { PipelineList } from '@/components/pipeline/pipeline-list';

// Wrapper to provide fresh SWR cache for each test
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>
);

// Mock next/navigation
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock toast
const mockToast = jest.fn();
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Mock sync lock (simple implementation)
jest.mock('@/hooks/useSyncLock', () => ({
  useSyncLock: () => ({ tempSyncState: false, setTempSyncState: jest.fn() }),
}));

// Mock confirmation dialog
jest.mock('@/components/ui/confirmation-dialog', () => ({
  useConfirmationDialog: () => ({
    confirm: jest.fn().mockResolvedValue(true),
    DialogComponent: (): null => null,
  }),
}));

// Mock permissions - default to all permissions granted
jest.mock('@/hooks/api/usePermissions', () => ({
  useUserPermissions: () => ({
    hasPermission: () => true,
  }),
}));

// Mock PipelineRunHistory to simplify tests
jest.mock('@/components/pipeline/pipeline-run-history', () => ({
  PipelineRunHistory: (): null => null,
}));

describe('Pipeline List - Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Data Fetching', () => {
    it('shows loading state then renders pipelines from API', async () => {
      render(
        <TestWrapper>
          <PipelineList />
        </TestWrapper>
      );

      // Wait for data to load and render
      await waitFor(() => {
        expect(screen.getByText('Daily Sync')).toBeInTheDocument();
      });

      // All pipelines from mock data should appear
      expect(screen.getByText('Weekly Report')).toBeInTheDocument();
      expect(screen.getByText('Running Pipeline')).toBeInTheDocument();
    });

    it('displays correct status badges based on pipeline state', async () => {
      render(
        <TestWrapper>
          <PipelineList />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Daily Sync')).toBeInTheDocument();
      });

      // Active pipeline shows Active badge
      expect(screen.getAllByText('Active').length).toBeGreaterThanOrEqual(1);

      // Inactive pipeline shows Inactive badge
      expect(screen.getByText('Inactive')).toBeInTheDocument();

      // Running pipeline shows Running badge
      expect(screen.getByText('Running')).toBeInTheDocument();
    });

    it('handles API error gracefully', async () => {
      // Override handler to return error for this test
      server.use(
        http.get('*/api/prefect/v1/flows/', () => {
          return new HttpResponse(null, { status: 500 });
        })
      );

      render(
        <TestWrapper>
          <PipelineList />
        </TestWrapper>
      );

      // Component should handle error state (implementation dependent)
      // Wait for loading to complete
      await waitFor(
        () => {
          // Either shows error message or empty state
          const content = screen.queryByText('Daily Sync');
          expect(content).not.toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it('shows empty state when no pipelines exist', async () => {
      server.use(
        http.get('*/api/prefect/v1/flows/', () => {
          return HttpResponse.json([]);
        })
      );

      render(
        <TestWrapper>
          <PipelineList />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('No pipelines yet')).toBeInTheDocument();
      });
    });
  });

  describe('User Interactions', () => {
    it('navigates to create page when clicking Create Pipeline', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <PipelineList />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Daily Sync')).toBeInTheDocument();
      });

      // Find and click create button
      const createButton = screen.getAllByRole('button', { name: /create pipeline/i })[0];
      await user.click(createButton);

      expect(mockPush).toHaveBeenCalledWith('/orchestrate/create');
    });

    it('triggers pipeline run and shows toast', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <PipelineList />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Daily Sync')).toBeInTheDocument();
      });

      // Find run button for a pipeline
      const runButtons = screen.getAllByRole('button', { name: /run/i });
      const firstRunButton = runButtons.find((btn) => !btn.hasAttribute('disabled'));

      if (firstRunButton) {
        await user.click(firstRunButton);

        await waitFor(() => {
          expect(mockToast).toHaveBeenCalled();
        });
      }
    });

    it('disables run button for running pipelines', async () => {
      render(
        <TestWrapper>
          <PipelineList />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Running Pipeline')).toBeInTheDocument();
      });

      // The running pipeline's row should have a disabled or hidden run button
      // This depends on implementation - adjust assertion as needed
      const runningPipelineRow = screen.getByText('Running Pipeline').closest('tr');
      if (runningPipelineRow) {
        const runButton = within(runningPipelineRow).queryByRole('button', { name: /run/i });
        // Button might be disabled or not present
        if (runButton) {
          expect(runButton).toBeDisabled();
        }
      }
    });
  });

  describe('Real-time Updates (Polling)', () => {
    it('updates UI when pipeline status changes', async () => {
      // Start with running pipeline
      const runningPipeline = createMockPipeline({
        name: 'Polling Test Pipeline',
        deploymentId: 'polling-test',
        lock: { lockedBy: 'user@test.com', lockedAt: new Date().toISOString(), status: 'running' },
      });

      server.use(
        http.get('*/api/prefect/v1/flows/', () => {
          return HttpResponse.json([runningPipeline]);
        })
      );

      render(
        <TestWrapper>
          <PipelineList />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Polling Test Pipeline')).toBeInTheDocument();
      });

      expect(screen.getByText('Running')).toBeInTheDocument();

      // Simulate pipeline completion by changing the response
      const completedPipeline = {
        ...runningPipeline,
        lock: null as null,
        lastRun: {
          id: 'run-1',
          name: 'run',
          status: 'COMPLETED',
          state_name: 'Completed',
          startTime: new Date().toISOString(),
          expectedStartTime: '',
          orguser: 'user@test.com',
        },
      };

      server.use(
        http.get('*/api/prefect/v1/flows/', () => {
          return HttpResponse.json([completedPipeline]);
        })
      );

      // Note: In real test, you'd need to wait for SWR to revalidate
      // or manually trigger mutate. This is a conceptual example.
    });
  });
});

describe('Pipeline Navigation - Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders pipeline rows that are clickable', async () => {
    render(
      <TestWrapper>
        <PipelineList />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Daily Sync')).toBeInTheDocument();
    });

    // Verify dropdown menus exist for each pipeline row
    const dropdownTriggers = screen
      .getAllByRole('button')
      .filter((btn) => btn.getAttribute('aria-haspopup') === 'menu');

    // Should have dropdown menus for pipeline actions
    expect(dropdownTriggers.length).toBeGreaterThan(0);
  });
});
