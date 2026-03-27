// hooks/api/useColumnData.ts
'use client';

import useSWR from 'swr';
import { useMemo, useCallback } from 'react';
import { apiGet } from '@/lib/api';
import type { ColumnData } from '@/types/transform';

// ============================================
// useColumnData
// ============================================

interface UseColumnDataOptions {
  /** Node UUID to fetch columns for */
  nodeUuid?: string;
  /** Skip fetch if no node */
  enabled?: boolean;
}

interface UseColumnDataReturn {
  /** Column names */
  columns: string[];
  /** Column info with types */
  columnInfo: ColumnData[];
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
  /** Refresh columns */
  refresh: () => Promise<void>;
}

export function useColumnData(options: UseColumnDataOptions = {}): UseColumnDataReturn {
  const { nodeUuid, enabled = true } = options;

  const shouldFetch = enabled && !!nodeUuid;

  const { data, error, isLoading, mutate } = useSWR<string[] | ColumnData[]>(
    shouldFetch ? `/api/transform/v2/dbt_project/nodes/${nodeUuid}/columns/` : null,
    apiGet,
    {
      revalidateOnFocus: false,
    }
  );

  // Handle both formats: string[] or ColumnData[]
  const { columns, columnInfo } = useMemo(() => {
    if (!data || data.length === 0) return { columns: [], columnInfo: [] };

    // Check if it's string[] or ColumnData[]
    if (typeof data[0] === 'string') {
      return {
        columns: data as string[],
        columnInfo: (data as string[]).map((name) => ({
          name,
          data_type: 'unknown',
        })),
      };
    }

    const info = data as ColumnData[];
    return {
      columns: info.map((c) => c.name),
      columnInfo: info,
    };
  }, [data]);

  const refresh = useCallback(async () => {
    await mutate();
  }, [mutate]);

  return {
    columns,
    columnInfo,
    isLoading,
    error: error ?? null,
    refresh,
  };
}

// ============================================
// useDataTypes
// ============================================

interface UseDataTypesReturn {
  /** Available data types */
  dataTypes: string[];
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
}

export function useDataTypes(): UseDataTypesReturn {
  const { data, error, isLoading } = useSWR<string[]>(
    '/api/transform/dbt_project/data_type/',
    apiGet,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000, // Cache for 1 minute
    }
  );

  const dataTypes = useMemo(() => {
    return data?.sort((a, b) => a.localeCompare(b)) ?? [];
  }, [data]);

  return {
    dataTypes,
    isLoading,
    error: error ?? null,
  };
}

// ============================================
// useModelDirectories
// ============================================

interface DirectoriesResponse {
  directories: string[];
}

interface DirectoryOption {
  value: string;
  label: string;
}

interface UseModelDirectoriesReturn {
  /** Available directories */
  directories: DirectoryOption[];
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
}

export function useModelDirectories(): UseModelDirectoriesReturn {
  const { data, error, isLoading } = useSWR<DirectoriesResponse>(
    '/api/transform/v2/dbt_project/models_directories/',
    apiGet,
    {
      revalidateOnFocus: false,
    }
  );

  const directories = useMemo<DirectoryOption[]>(() => {
    if (!data?.directories) {
      // Default directories if API returns empty or fails
      return [
        { value: '', label: '/' },
        { value: 'intermediate', label: 'intermediate/' },
        { value: 'production', label: 'production/' },
      ];
    }

    return data.directories.map((dir) => ({
      value: dir,
      label: dir === '' ? '/' : `${dir}/`,
    }));
  }, [data]);

  return {
    directories,
    isLoading,
    error: error ?? null,
  };
}

// ============================================
// useMultiNodeColumns - For operations with multiple inputs (Join, Union)
// ============================================

interface UseMultiNodeColumnsOptions {
  /** Primary node UUID */
  primaryNodeUuid?: string;
  /** Secondary node UUIDs */
  secondaryNodeUuids?: string[];
  /** Skip fetch */
  enabled?: boolean;
}

interface UseMultiNodeColumnsReturn {
  /** Primary node columns */
  primaryColumns: string[];
  /** Secondary nodes columns (keyed by UUID) */
  secondaryColumns: Record<string, string[]>;
  /** Loading state */
  isLoading: boolean;
}

export function useMultiNodeColumns(
  options: UseMultiNodeColumnsOptions = {}
): UseMultiNodeColumnsReturn {
  const { primaryNodeUuid, secondaryNodeUuids = [], enabled = true } = options;

  const { columns: primaryColumns, isLoading: primaryLoading } = useColumnData({
    nodeUuid: primaryNodeUuid,
    enabled: enabled && !!primaryNodeUuid,
  });

  // For secondary nodes, we'll need to fetch each one
  // This is a simplified version - in practice you might want to batch these
  const secondaryResults = secondaryNodeUuids.map((uuid) => {
    // Note: This creates multiple hook calls, which is fine but requires
    // the number of secondaryNodeUuids to be stable
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useColumnData({
      nodeUuid: uuid,
      enabled: enabled && !!uuid,
    });
  });

  const secondaryColumns = useMemo(() => {
    return secondaryNodeUuids.reduce(
      (acc, uuid, index) => {
        acc[uuid] = secondaryResults[index]?.columns ?? [];
        return acc;
      },
      {} as Record<string, string[]>
    );
  }, [secondaryNodeUuids, secondaryResults]);

  const isLoading = primaryLoading || secondaryResults.some((r) => r.isLoading);

  return {
    primaryColumns,
    secondaryColumns,
    isLoading,
  };
}
