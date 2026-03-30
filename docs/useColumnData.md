# useColumnData Hook Specification

## Overview

Hook for fetching column data/metadata for nodes - used in operation forms to get available columns.

**v1 Source:** Form components' `fetchAndSetSourceColumns` functions

**v2 Target:** `webapp_v2/src/hooks/api/useColumnData.ts`

---

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `transform/v2/dbt_project/nodes/{node_uuid}/columns/` | GET | Get columns for a canvas node |
| `transform/dbt_project/data_type/` | GET | Get available data types |
| `transform/v2/dbt_project/models_directories/` | GET | Get model directories for CreateTable |

---

## Response Types

```typescript
interface ColumnInfo {
  name: string;
  data_type: string;
}

interface DirectoriesResponse {
  directories: string[];
}
```

---

## Hook Interface

```typescript
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
  columnInfo: ColumnInfo[];
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
  /** Refresh columns */
  refresh: () => Promise<void>;
}

interface UseDataTypesReturn {
  /** Available data types */
  dataTypes: string[];
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
}

interface UseModelDirectoriesReturn {
  /** Available directories */
  directories: { value: string; label: string }[];
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
}
```

---

## Implementation

### useColumnData

```typescript
import useSWR from 'swr';
import { useMemo } from 'react';
import { apiGet } from '@/lib/api';

export function useColumnData(options: UseColumnDataOptions = {}): UseColumnDataReturn {
  const { nodeUuid, enabled = true } = options;

  const shouldFetch = enabled && !!nodeUuid;

  const {
    data,
    error,
    isLoading,
    mutate,
  } = useSWR<string[] | ColumnInfo[]>(
    shouldFetch ? `transform/v2/dbt_project/nodes/${nodeUuid}/columns/` : null,
    apiGet,
    {
      revalidateOnFocus: false,
    }
  );

  // Handle both formats: string[] or ColumnInfo[]
  const { columns, columnInfo } = useMemo(() => {
    if (!data) return { columns: [], columnInfo: [] };

    // Check if it's string[] or ColumnInfo[]
    if (typeof data[0] === 'string') {
      return {
        columns: data as string[],
        columnInfo: (data as string[]).map((name) => ({
          name,
          data_type: 'unknown',
        })),
      };
    }

    const info = data as ColumnInfo[];
    return {
      columns: info.map((c) => c.name),
      columnInfo: info,
    };
  }, [data]);

  return {
    columns,
    columnInfo,
    isLoading,
    error: error ?? null,
    refresh: async () => { await mutate(); },
  };
}
```

### useDataTypes

```typescript
export function useDataTypes(): UseDataTypesReturn {
  const {
    data,
    error,
    isLoading,
  } = useSWR<string[]>(
    'transform/dbt_project/data_type/',
    apiGet,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000, // Cache for 1 minute
    }
  );

  return {
    dataTypes: data?.sort((a, b) => a.localeCompare(b)) ?? [],
    isLoading,
    error: error ?? null,
  };
}
```

### useModelDirectories

```typescript
export function useModelDirectories(): UseModelDirectoriesReturn {
  const {
    data,
    error,
    isLoading,
  } = useSWR<DirectoriesResponse>(
    'transform/v2/dbt_project/models_directories/',
    apiGet,
    {
      revalidateOnFocus: false,
    }
  );

  const directories = useMemo(() => {
    if (!data?.directories) {
      // Default directories if API fails
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
```

---

## Usage

### In Operation Forms

```typescript
function RenameColumnOpForm({ node }: OperationFormProps) {
  const { columns, isLoading } = useColumnData({
    nodeUuid: node?.id,
    enabled: !!node,
  });

  return (
    <form>
      <Autocomplete
        options={columns}
        label="Select Column"
        loading={isLoading}
      />
    </form>
  );
}
```

### In CastColumnOpForm

```typescript
function CastColumnOpForm({ node }: OperationFormProps) {
  const { columnInfo, isLoading: columnsLoading } = useColumnData({
    nodeUuid: node?.id,
  });
  const { dataTypes, isLoading: typesLoading } = useDataTypes();

  return (
    <form>
      <Table>
        {columnInfo.map((col) => (
          <TableRow key={col.name}>
            <TableCell>{col.name}</TableCell>
            <TableCell>
              <Autocomplete
                options={dataTypes}
                defaultValue={col.data_type}
              />
            </TableCell>
          </TableRow>
        ))}
      </Table>
    </form>
  );
}
```

### In CreateTableForm

```typescript
function CreateTableForm() {
  const { directories, isLoading } = useModelDirectories();

  return (
    <form>
      <Autocomplete
        options={directories}
        label="Directory"
        loading={isLoading}
        freeSolo
        getOptionLabel={(opt) => opt.label}
      />
    </form>
  );
}
```

---

## Multi-Input Operations (Join, Union)

For operations that need columns from multiple inputs:

```typescript
function JoinOpForm({ node }: OperationFormProps) {
  // Primary input columns
  const { columns: primaryColumns } = useColumnData({
    nodeUuid: node?.id,
  });

  // Secondary input columns (selected from another source/model)
  const [secondaryNodeUuid, setSecondaryNodeUuid] = useState<string | null>(null);
  const { columns: secondaryColumns } = useColumnData({
    nodeUuid: secondaryNodeUuid ?? undefined,
    enabled: !!secondaryNodeUuid,
  });

  // ... form implementation
}
```

---

## Edge Cases

1. **Node not found**: Return empty columns, show error
2. **Operation node**: May need to fetch from input_nodes
3. **No columns**: Show "No columns available" message
4. **Type mismatch**: Handle both string[] and ColumnInfo[] responses

---

## Implementation Checklist

- [ ] Create hook file at `hooks/api/useColumnData.ts`
- [ ] Export all three hooks
- [ ] Handle both response formats
- [ ] Add proper caching
- [ ] Test with different node types
- [ ] Test with multi-input operations
