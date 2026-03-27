// hooks/api/__tests__/useCanvasHooks.test.ts
/**
 * Tests for Canvas API hooks
 *
 * Note: These are structural tests to verify the hooks return the expected shape.
 * Integration tests with actual API calls should be done separately.
 */

import { renderHook, waitFor } from '@testing-library/react';
import { TableType } from '@/constants/explore';
import { CANVAS_GRAPH_KEY } from '../useCanvasGraph';

// Mock SWR with proper structure
jest.mock('swr', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    data: { nodes: [], edges: [] },
    error: null,
    isLoading: false,
    mutate: jest.fn(),
  })),
  useSWRConfig: () => ({ mutate: jest.fn() }),
}));

// Mock API
jest.mock('@/lib/api', () => ({
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
        setCanvasLockStatus: jest.fn(),
        setViewOnlyMode: jest.fn(),
      });
    }
    return {
      setCanvasLockStatus: jest.fn(),
      setViewOnlyMode: jest.fn(),
    };
  }),
}));

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
});

describe('buildTreeFromSources utility', () => {
  it('is exported from useCanvasSources', async () => {
    const module = await import('../useCanvasSources');
    expect(module.buildTreeFromSources).toBeDefined();
    expect(typeof module.buildTreeFromSources).toBe('function');
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
        output_cols: [],
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
        output_cols: [],
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
        output_cols: [],
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
