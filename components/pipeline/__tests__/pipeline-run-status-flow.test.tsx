/**
 * Pipeline Run Status Flow Test
 *
 * Verifies the status transition when a pipeline run is triggered:
 *   Click Run → Locked (optimistic) → Locked (backend) → Queued → Running → Success
 *
 * If this flow breaks, this test fails.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PipelineList } from '../pipeline-list';
import * as usePipelinesHook from '@/hooks/api/usePipelines';
import * as usePermissionsHook from '@/hooks/api/usePermissions';
import { Pipeline } from '@/types/pipeline';

jest.mock('@/hooks/api/usePipelines');
jest.mock('@/hooks/api/usePermissions');
// DO NOT mock useSyncLock — the real hook is needed for the optimistic flow

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@/lib/toast', () => ({
  toastSuccess: { generic: jest.fn(), deleted: jest.fn(), created: jest.fn(), updated: jest.fn() },
  toastError: { api: jest.fn(), delete: jest.fn(), save: jest.fn() },
}));
jest.mock('@/components/ui/confirmation-dialog', () => ({
  useConfirmationDialog: () => ({
    confirm: jest.fn().mockResolvedValue(true),
    DialogComponent: (): null => null,
  }),
}));
jest.mock('../pipeline-run-history', () => ({ PipelineRunHistory: (): null => null }));

const createPipeline = (overrides: Partial<Pipeline> = {}): Pipeline => ({
  name: 'Test Pipeline',
  cron: null,
  deploymentName: 'test-deployment',
  deploymentId: 'dep-1',
  lastRun: null,
  lock: null,
  status: true,
  queuedFlowRunWaitTime: null,
  ...overrides,
});

it('status flow: click → locked (optimistic) → locked (backend) → queued → running → success', async () => {
  const user = userEvent.setup();
  const mockMutate = jest.fn();

  (usePermissionsHook.useUserPermissions as jest.Mock).mockReturnValue({
    hasPermission: () => true,
  });

  jest
    .spyOn(usePipelinesHook, 'triggerPipelineRun')
    .mockImplementation(jest.fn().mockResolvedValue({}));

  const updatePipelines = (pipeline: Pipeline) => {
    (usePipelinesHook.usePipelines as jest.Mock).mockReturnValue({
      pipelines: [pipeline],
      isLoading: false,
      isError: null,
      mutate: mockMutate,
    });
  };

  // Start: idle pipeline, no lock, no lastRun → status is "—"
  updatePipelines(createPipeline());
  const { rerender } = render(<PipelineList />);
  expect(screen.getByTestId('run-status-dep-1').textContent).toBe('—');

  // Click Run → optimistic "Locked" (before backend responds)
  await user.click(screen.getByTestId('run-btn-dep-1'));
  await waitFor(() => {
    expect(screen.getByTestId('run-status-dep-1').textContent).toBe('Locked');
  });

  // Backend returns lock with status "locked"
  updatePipelines(
    createPipeline({
      lock: { lockedBy: 'user@test.com', lockedAt: new Date().toISOString(), status: 'locked' },
    })
  );
  rerender(<PipelineList />);
  expect(screen.getByTestId('run-status-dep-1').textContent).toBe('Locked');

  // Backend transitions to "queued"
  updatePipelines(
    createPipeline({
      lock: { lockedBy: 'user@test.com', lockedAt: new Date().toISOString(), status: 'queued' },
    })
  );
  rerender(<PipelineList />);
  expect(screen.getByTestId('run-status-dep-1').textContent).toBe('Queued');

  // Backend transitions to "running"
  updatePipelines(
    createPipeline({
      lock: { lockedBy: 'user@test.com', lockedAt: new Date().toISOString(), status: 'running' },
    })
  );
  rerender(<PipelineList />);
  expect(screen.getByTestId('run-status-dep-1').textContent).toBe('Running');

  // Run completes — lock cleared, lastRun shows success
  updatePipelines(
    createPipeline({
      lock: null,
      lastRun: {
        id: 'run-1',
        name: 'run',
        status: 'COMPLETED',
        state_name: 'Completed',
        startTime: new Date().toISOString(),
        expectedStartTime: '',
        orguser: 'user@test.com',
      },
    })
  );
  rerender(<PipelineList />);
  await waitFor(() => {
    expect(screen.getByTestId('run-status-dep-1').textContent).toBe('Success');
  });
});
