// hooks/api/__tests__/useCanvasHooks.test.ts
/**
 * Tests for Canvas API hooks
 *
 * Note: These are structural tests to verify the hooks return the expected shape.
 * Integration tests with actual API calls should be done separately.
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { TableType } from '@/constants/explore';
import { CANVAS_GRAPH_KEY } from '../useCanvasGraph';

const mockSetCanvasLockStatus = jest.fn();
const mockSetViewOnlyMode = jest.fn();

// Mock SWR with proper structure
jest.mock('swr', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    data: { nodes: [] as unknown[], edges: [] as unknown[] },
    error: null as unknown,
    isLoading: false,
    mutate: jest.fn(),
  })),
  useSWRConfig: () => ({ mutate: jest.fn() }),
}));

// Mock API
jest.mock('@/lib/api', () => ({
  ApiError: class MockApiError extends Error {
    status: number;
    data: unknown;

    constructor(message: string, status: number, data: unknown) {
      super(message);
      this.status = status;
      this.data = data;
    }
  },
  apiGet: jest.fn().mockResolvedValue({}),
  apiPost: jest.fn().mockResolvedValue({}),
  apiPut: jest.fn().mockResolvedValue({}),
  apiDelete: jest.fn().mockResolvedValue({}),
}));

// Mock transform store
jest.mock('@/stores/transformStore', () => ({
  useTransformStore: jest.fn((selector) => {
    if (typeof selector === 'function') {
      return selector({
        setCanvasLockStatus: mockSetCanvasLockStatus,
        setViewOnlyMode: mockSetViewOnlyMode,
      });
    }
    return {
      setCanvasLockStatus: mockSetCanvasLockStatus,
      setViewOnlyMode: mockSetViewOnlyMode,
    };
  }),
}));

beforeEach(() => {
  const api = jest.requireMock('@/lib/api') as {
    apiGet: jest.Mock;
    apiPost: jest.Mock;
    apiPut: jest.Mock;
    apiDelete: jest.Mock;
  };
  api.apiGet.mockReset().mockResolvedValue({});
  api.apiPost.mockReset().mockResolvedValue({});
  api.apiPut.mockReset().mockResolvedValue({});
  api.apiDelete.mockReset().mockResolvedValue({});
  mockSetCanvasLockStatus.mockClear();
  mockSetViewOnlyMode.mockClear();
});

describe('CANVAS_GRAPH_KEY export', () => {
  it('exports the correct SWR key for graph endpoint', () => {
    expect(CANVAS_GRAPH_KEY).toBe('/api/transform/v2/dbt_project/graph/');
  });
});

describe('useCanvasGraph hook structure', () => {
  it('returns expected properties', async () => {
    // Dynamic import to use mocks
    const { useCanvasGraph } = await import('../useCanvasGraph');
    const { result } = renderHook(() => useCanvasGraph());

    expect(result.current).toHaveProperty('nodes');
    expect(result.current).toHaveProperty('edges');
    expect(result.current).toHaveProperty('isLoading');
    expect(result.current).toHaveProperty('error');
    expect(result.current).toHaveProperty('refresh');
    expect(result.current).toHaveProperty('syncAndRefresh');
  });

  it('returns empty arrays when no data', async () => {
    const { useCanvasGraph } = await import('../useCanvasGraph');
    const { result } = renderHook(() => useCanvasGraph());

    expect(Array.isArray(result.current.nodes)).toBe(true);
    expect(Array.isArray(result.current.edges)).toBe(true);
  });
});

describe('useCanvasOperations hook structure', () => {
  it('returns expected operation functions', async () => {
    const { useCanvasOperations } = await import('../useCanvasOperations');
    const { result } = renderHook(() => useCanvasOperations());

    expect(typeof result.current.addNodeToCanvas).toBe('function');
    expect(typeof result.current.createOperation).toBe('function');
    expect(typeof result.current.editOperation).toBe('function');
    expect(typeof result.current.deleteOperationNode).toBe('function');
    expect(typeof result.current.deleteModelNode).toBe('function');
    expect(typeof result.current.terminateChain).toBe('function');
  });

  it('returns loading state flags', async () => {
    const { useCanvasOperations } = await import('../useCanvasOperations');
    const { result } = renderHook(() => useCanvasOperations());

    expect(typeof result.current.isCreating).toBe('boolean');
    expect(typeof result.current.isEditing).toBe('boolean');
    expect(typeof result.current.isDeleting).toBe('boolean');
    expect(typeof result.current.isTerminating).toBe('boolean');
  });
});

describe('useCanvasSources hook structure', () => {
  it('returns expected properties', async () => {
    const { useCanvasSources } = await import('../useCanvasSources');
    const { result } = renderHook(() => useCanvasSources());

    expect(result.current).toHaveProperty('sourcesModels');
    expect(result.current).toHaveProperty('isLoading');
    expect(result.current).toHaveProperty('error');
    expect(result.current).toHaveProperty('refresh');
    expect(result.current).toHaveProperty('syncSources');
  });

  it('has sourcesModels property', async () => {
    const { useCanvasSources } = await import('../useCanvasSources');
    const { result } = renderHook(() => useCanvasSources());

    // sourcesModels property should exist
    expect(result.current).toHaveProperty('sourcesModels');
  });
});

describe('useCanvasLock hook structure', () => {
  it('returns expected properties', async () => {
    const { useCanvasLock } = await import('../useCanvasLock');
    const { result } = renderHook(() => useCanvasLock({ autoAcquire: false }));

    // Based on actual UseCanvasLockReturn interface
    expect(result.current).toHaveProperty('lockStatus');
    expect(result.current).toHaveProperty('hasLock');
    expect(result.current).toHaveProperty('isLockedByOther');
    expect(result.current).toHaveProperty('isAcquiring');
    expect(result.current).toHaveProperty('isReleasing');
    expect(result.current).toHaveProperty('acquireLock');
    expect(result.current).toHaveProperty('releaseLock');
    expect(result.current).toHaveProperty('refreshLock');
  });

  it('returns lock manipulation functions', async () => {
    const { useCanvasLock } = await import('../useCanvasLock');
    const { result } = renderHook(() => useCanvasLock({ autoAcquire: false }));

    expect(typeof result.current.acquireLock).toBe('function');
    expect(typeof result.current.releaseLock).toBe('function');
    expect(typeof result.current.refreshLock).toBe('function');
  });

  it('normalizes a successful backend lock response as owned', async () => {
    const { apiPost } = jest.requireMock('@/lib/api') as { apiPost: jest.Mock };
    apiPost.mockResolvedValueOnce({
      lock_token: 'lock-token',
      expires_at: '2026-08-19T12:00:00Z',
      locked_by: 'engineer@example.com',
    });
    const { useCanvasLock } = await import('../useCanvasLock');
    const { result, unmount } = renderHook(() => useCanvasLock({ autoAcquire: false }));

    await act(async () => {
      await result.current.acquireLock();
    });

    expect(result.current.hasLock).toBe(true);
    expect(result.current.lockStatus).toMatchObject({
      lock_id: 'lock-token',
      is_locked: true,
      locked_by_current_user: true,
      locked_by: 'engineer@example.com',
    });
    unmount();
  });

  it('drops to view-only immediately when refresh reports an expired lock', async () => {
    const { ApiError, apiPost, apiPut } = jest.requireMock('@/lib/api') as {
      ApiError: new (message: string, status: number, data: unknown) => Error;
      apiPost: jest.Mock;
      apiPut: jest.Mock;
    };
    const onLockLost = jest.fn();
    apiPost.mockResolvedValueOnce({
      lock_token: 'lock-token',
      expires_at: '2026-08-19T12:00:00Z',
      locked_by: 'engineer@example.com',
    });
    apiPut.mockRejectedValueOnce(new ApiError('Lock has expired', 410, {}));
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { useCanvasLock } = await import('../useCanvasLock');
    const { result, unmount } = renderHook(() => useCanvasLock({ autoAcquire: false, onLockLost }));

    await act(async () => {
      await result.current.acquireLock();
      await result.current.refreshLock();
    });

    expect(result.current.hasLock).toBe(false);
    expect(result.current.lockStatus).toBeNull();
    expect(mockSetCanvasLockStatus).toHaveBeenLastCalledWith(null);
    expect(mockSetViewOnlyMode).toHaveBeenLastCalledWith(true);
    expect(onLockLost).toHaveBeenCalledTimes(1);
    consoleError.mockRestore();
    unmount();
  });

  it('retains lock ownership across a transient refresh failure', async () => {
    const { ApiError, apiPost, apiPut } = jest.requireMock('@/lib/api') as {
      ApiError: new (message: string, status: number, data: unknown) => Error;
      apiPost: jest.Mock;
      apiPut: jest.Mock;
    };
    const onLockLost = jest.fn();
    apiPost.mockResolvedValueOnce({
      lock_token: 'lock-token',
      expires_at: '2026-08-19T12:00:00Z',
      locked_by: 'engineer@example.com',
    });
    apiPut.mockRejectedValueOnce(new ApiError('Temporary server failure', 500, {}));
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { useCanvasLock } = await import('../useCanvasLock');
    const { result, unmount } = renderHook(() => useCanvasLock({ autoAcquire: false, onLockLost }));

    await act(async () => {
      await result.current.acquireLock();
      await result.current.refreshLock();
    });

    expect(result.current.hasLock).toBe(true);
    expect(onLockLost).not.toHaveBeenCalled();
    consoleError.mockRestore();
    unmount();
  });
});

describe('useCanvasLayout', () => {
  it('serializes saves and coalesces a newer queued position for the same node', async () => {
    const { apiPut } = jest.requireMock('@/lib/api') as { apiPut: jest.Mock };
    let resolveFirst: (value: unknown) => void = () => undefined;
    apiPut
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          })
      )
      .mockResolvedValueOnce({
        updated: 1,
        nodes: [{ uuid: 'node-1', position: { x: 30, y: 40 } }],
      });

    const { useCanvasLayout } = await import('../useCanvasLayout');
    const { result } = renderHook(() => useCanvasLayout());

    let firstSave: Promise<unknown>;
    let secondSave: Promise<unknown>;
    let thirdSave: Promise<unknown>;
    await act(async () => {
      firstSave = result.current.savePositions([{ uuid: 'node-1', position: { x: 10, y: 20 } }]);
      secondSave = result.current.savePositions([{ uuid: 'node-1', position: { x: 20, y: 30 } }]);
      thirdSave = result.current.savePositions([{ uuid: 'node-1', position: { x: 30, y: 40 } }]);
    });

    expect(apiPut).toHaveBeenCalledTimes(1);
    resolveFirst({
      updated: 1,
      nodes: [{ uuid: 'node-1', position: { x: 10, y: 20 } }],
    });

    await waitFor(() => expect(apiPut).toHaveBeenCalledTimes(2));
    expect(apiPut.mock.calls[1][1]).toEqual({
      nodes: [{ uuid: 'node-1', position: { x: 30, y: 40 } }],
    });

    await act(async () => {
      await Promise.all([firstSave!, secondSave!, thirdSave!]);
    });
  });

  it('retries the latest failed positions and clears the save error', async () => {
    const { apiPut } = jest.requireMock('@/lib/api') as { apiPut: jest.Mock };
    const update = { uuid: 'node-1', position: { x: 125, y: 175 } };
    apiPut.mockRejectedValueOnce(new Error('Layout save failed')).mockResolvedValueOnce({
      updated: 1,
      nodes: [update],
    });
    const { useCanvasLayout } = await import('../useCanvasLayout');
    const { result } = renderHook(() => useCanvasLayout());

    await act(async () => {
      await expect(result.current.savePositions([update])).rejects.toThrow('Layout save failed');
    });
    expect(result.current.error?.message).toBe('Layout save failed');

    await act(async () => {
      await expect(result.current.retryFailed()).resolves.toEqual([update]);
    });

    expect(apiPut).toHaveBeenCalledTimes(2);
    expect(apiPut).toHaveBeenLastCalledWith('/api/transform/v2/dbt_project/graph/layout/', {
      nodes: [update],
    });
    expect(result.current.error).toBeNull();
  });
});

describe('buildTreeFromSources utility', () => {
  it('is exported from useCanvasSources', async () => {
    const canvasSourcesModule = await import('../useCanvasSources');
    expect(canvasSourcesModule.buildTreeFromSources).toBeDefined();
    expect(typeof canvasSourcesModule.buildTreeFromSources).toBe('function');
  });

  it('returns empty array for empty input', async () => {
    const { buildTreeFromSources } = await import('../useCanvasSources');
    const result = buildTreeFromSources([]);
    expect(result).toEqual([]);
  });

  it('groups models by schema and source_name', async () => {
    const { buildTreeFromSources } = await import('../useCanvasSources');
    const models = [
      {
        id: '1',
        uuid: '1',
        name: 'model_a',
        schema: 'public',
        type: TableType.MODEL,
        display_name: 'Model A',
        source_name: 'src',
        sql_path: '',
        output_cols: [] as string[],
      },
      {
        id: '2',
        uuid: '2',
        name: 'model_b',
        schema: 'public',
        type: TableType.MODEL,
        display_name: 'Model B',
        source_name: 'src',
        sql_path: '',
        output_cols: [] as string[],
      },
      {
        id: '3',
        uuid: '3',
        name: 'model_c',
        schema: 'staging',
        type: TableType.MODEL,
        display_name: 'Model C',
        source_name: 'src',
        sql_path: '',
        output_cols: [] as string[],
      },
    ];

    const result = buildTreeFromSources(models);

    // Should have schema nodes at the top level (not wrapped in root)
    expect(result.length).toBe(2); // public and staging

    // Find schemas
    const publicSchema = result.find((n) => n.id === 'public');
    const stagingSchema = result.find((n) => n.id === 'staging');

    expect(publicSchema).toBeDefined();
    expect(stagingSchema).toBeDefined();

    // Public schema should have 'src' source with 2 models
    expect(publicSchema?.children?.length).toBe(1); // src source
    expect(publicSchema?.children?.[0].children?.length).toBe(2); // 2 models

    // Staging schema should have 'src' source with 1 model
    expect(stagingSchema?.children?.length).toBe(1); // src source
    expect(stagingSchema?.children?.[0].children?.length).toBe(1); // 1 model
  });
});
