# Lower Section Tabs Specification

## Overview

The lower section contains three tabs: Preview, Logs, and Data Statistics. Each tab displays different information related to the selected table/model.

**v1 Sources:**
- `webapp/src/components/TransformWorkflow/FlowEditor/Components/LowerSectionTabs/PreviewPane.tsx` (~305 lines)
- `webapp/src/components/TransformWorkflow/FlowEditor/Components/LowerSectionTabs/LogsPane.tsx` (~121 lines)
- `webapp/src/components/TransformWorkflow/FlowEditor/Components/LowerSectionTabs/StatisticsPane.tsx` (~588 lines)

**v2 Target:**
- `webapp_v2/src/components/transform/tabs/PreviewPane.tsx`
- `webapp_v2/src/components/transform/tabs/LogsPane.tsx`
- `webapp_v2/src/components/transform/tabs/StatisticsPane.tsx`

---

## LogsPane

### Visual Design

```
┌─────────────────────────────────────────────────────────────────────┐
│ Last Run                          │ Description                     │
├───────────────────────────────────┼─────────────────────────────────┤
│ 2024/01/15  10:30:45 AM           │ Running dbt run...              │
│ 2024/01/15  10:30:47 AM           │ Compiled node stg_customers     │
│ 2024/01/15  10:30:52 AM           │ Completed successfully          │
└───────────────────────────────────┴─────────────────────────────────┘

(Empty state):
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│                      Please press run                               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

(Loading state):
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│                           [Loading...]                              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Complexity: Low

### Implementation

```typescript
import { Loader2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { format } from 'date-fns';
import type { TaskProgressLog } from '@/types/transform.types';

interface LogsPaneProps {
  height: number;
  dbtRunLogs: TaskProgressLog[];
  isLoading: boolean;
}

export default function LogsPane({ height, dbtRunLogs, isLoading }: LogsPaneProps) {
  if (isLoading && dbtRunLogs.length === 0) {
    return (
      <div
        className="flex items-center justify-center"
        style={{ height: height - 50 }}
      >
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (dbtRunLogs.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-muted-foreground"
        style={{ height: height - 50 }}
      >
        Please press run
      </div>
    );
  }

  return (
    <div className="overflow-auto" style={{ height: height - 50 }}>
      <Table>
        <TableHeader className="sticky top-0 bg-muted/50">
          <TableRow>
            <TableHead className="min-w-[200px] font-bold">Last Run</TableHead>
            <TableHead className="font-bold">Description</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {dbtRunLogs.map((log, index) => (
            <TableRow key={index} data-testid={`log-row-${index}`}>
              <TableCell className="font-medium text-sm">
                {format(new Date(log.timestamp), 'yyyy/MM/dd')}
                {'    '}
                {format(new Date(log.timestamp), 'hh:mm:ss a')}
              </TableCell>
              <TableCell className="text-sm">{log.message}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

---

## PreviewPane

### Visual Design

```
┌─────────────────────────────────────────────────────────────────────┐
│ raw_data.customers                                          [⬇]    │
├─────────────────────────────────────────────────────────────────────┤
│ id ▼  │ name ▼      │ email ▼              │ created_at ▼         │
├───────┼─────────────┼──────────────────────┼──────────────────────┤
│ 1     │ John Doe    │ john@example.com     │ 2024-01-01           │
│ 2     │ Jane Smith  │ jane@example.com     │ 2024-01-02           │
│ 3     │ Bob Wilson  │ bob@example.com      │ 2024-01-03           │
├─────────────────────────────────────────────────────────────────────┤
│                                         Rows per page: [5 ▼] 1-5 of 100 │
└─────────────────────────────────────────────────────────────────────┘

(Empty state):
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│              Select a table from the left pane to view              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Complexity: Medium

### API Endpoints

```typescript
GET warehouse/table_columns/{schema}/{table}
// Response: [{ name: string, data_type: string }]

GET warehouse/table_data/{schema}/{table}?page={page}&limit={limit}&order_by={col}&order={1|-1}
// Response: Row[]

GET warehouse/table_count/{schema}/{table}
// Response: { total_rows: number }

GET warehouse/download/{schema}/{table}
// Returns: CSV blob
```

### Implementation

```typescript
'use client';

import { useEffect, useState, useMemo } from 'react';
import { Download, Loader2 } from 'lucide-react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  ColumnDef,
  SortingState,
} from '@tanstack/react-table';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCanvasStore } from '@/stores/canvasStore';
import { apiGet } from '@/lib/api';
import { toast } from 'sonner';
import type { PreviewTableData } from '@/types/transform.types';

interface PreviewPaneProps {
  height: number;
}

export default function PreviewPane({ height }: PreviewPaneProps) {
  const { previewAction } = useCanvasStore();

  const [modelToPreview, setModelToPreview] = useState<PreviewTableData | null>(null);
  const [columns, setColumns] = useState<ColumnDef<any>[]>([]);
  const [data, setData] = useState<any[]>([]);
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [downloading, setDownloading] = useState(false);

  // Handle preview action changes
  useEffect(() => {
    if (previewAction.type === 'preview') {
      setModelToPreview(previewAction.data);
    } else if (previewAction.type === 'clear-preview') {
      setModelToPreview(null);
    }
  }, [previewAction]);

  // Fetch data when model or pagination changes
  useEffect(() => {
    if (modelToPreview) {
      fetchTableData();
    }
  }, [modelToPreview, currentPage, pageSize, sorting]);

  const fetchTableData = async () => {
    if (!modelToPreview) return;

    try {
      const { schema, table } = modelToPreview;
      const sortCol = sorting[0]?.id;
      const sortOrder = sorting[0]?.desc ? -1 : 1;

      let dataUrl = `warehouse/table_data/${schema}/${table}?page=${currentPage}&limit=${pageSize}`;
      if (sortCol) {
        dataUrl += `&order_by=${sortCol}&order=${sortOrder}`;
      }

      const [columnSpec, rows, count] = await Promise.all([
        apiGet(`warehouse/table_columns/${schema}/${table}`),
        apiGet(dataUrl),
        apiGet(`warehouse/table_count/${schema}/${table}`),
      ]);

      setTotalCount(count.total_rows);
      setColumns(
        columnSpec.map((col: any) => ({
          header: col.name,
          accessorKey: col.name,
        }))
      );
      setData(rows);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load table data');
    }
  };

  const handleDownload = async () => {
    if (!modelToPreview) return;

    setDownloading(true);
    try {
      const { schema, table } = modelToPreview;
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/warehouse/download/${schema}/${table}`,
        { credentials: 'include' }
      );
      const blob = await response.blob();

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${schema}__${table}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast.error('Failed to download');
    } finally {
      setDownloading(false);
    }
  };

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
    manualSorting: true,
  });

  const pageCount = Math.ceil(totalCount / pageSize);

  if (!modelToPreview) {
    return (
      <div
        className="flex items-center justify-center text-muted-foreground"
        style={{ height }}
      >
        Select a table from the left pane to view
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b">
        <span className="font-bold">
          {modelToPreview.schema}.{modelToPreview.table}
        </span>
        <Button
          variant="default"
          size="sm"
          onClick={handleDownload}
          disabled={downloading}
          data-testid="download-csv-btn"
        >
          {downloading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Table */}
      <div className="overflow-auto" style={{ height: height - 100 }}>
        <Table>
          <TableHeader className="sticky top-0 bg-muted/50">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="cursor-pointer hover:bg-muted"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getIsSorted() === 'asc' && ' ↑'}
                    {header.column.getIsSorted() === 'desc' && ' ↓'}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="text-sm">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-end gap-4 px-4 py-2 border-t">
        <div className="flex items-center gap-2">
          <span className="text-sm">Rows per page:</span>
          <Select
            value={String(pageSize)}
            onValueChange={(v) => {
              setPageSize(Number(v));
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-16">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[5, 10, 25, 100].map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <span className="text-sm">
          {(currentPage - 1) * pageSize + 1}-
          {Math.min(currentPage * pageSize, totalCount)} of {totalCount}
        </span>
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => p - 1)}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage >= pageCount}
            onClick={() => setCurrentPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
```

---

## StatisticsPane

### Visual Design

```
┌─────────────────────────────────────────────────────────────────────┐
│ customers        👁 5 Columns  100 Rows              [Refresh]      │
├─────────────────────────────────────────────────────────────────────┤
│ Column name │ Column type │ Distinct │ Null │ Data distribution    │
├─────────────┼─────────────┼──────────┼──────┼──────────────────────┤
│ id          │ Numeric     │ 100      │ 0    │ [Range chart: 1-100] │
│ name        │ String      │ 95       │ 2    │ [Bar chart]          │
│ created_at  │ Datetime    │ 50       │ 0    │ [Timeline chart]     │
│ is_active   │ Boolean     │ 2        │ 0    │ [True/False bar]     │
└─────────────────────────────────────────────────────────────────────┘

(Loading state per row):
│ email       │ String      │ [----]   │[----]│ [Skeleton loading]   │
```

### Complexity: High

### API Endpoints

```typescript
GET warehouse/v1/table_data/{schema}/{table}
// Response: [{ name: string, translated_type: ColumnTypes }]

GET warehouse/table_count/{schema}/{table}
// Response: { total_rows: number }

POST warehouse/insights/metrics/
{
  "db_schema": "raw_data",
  "db_table": "customers",
  "column_name": "name"
}
// Response: { task_id: string }

GET tasks/{taskId}?hashkey=data-insights
// Response: { progress: [{ status, results: MetricsResult }] }
```

### Implementation Notes

The StatisticsPane is the most complex component:

1. **Per-column polling**: Each column's statistics are fetched via a background task
2. **Multiple chart types**: Different visualizations based on column type
   - Numeric: Range chart with min/max/mean/median
   - String: Bar chart with top values
   - Boolean: True/False percentage bar
   - Datetime: Timeline distribution
3. **Skeleton loading**: Shows loading state per column while metrics load

Due to complexity, this component should be implemented with these sub-components:
- `NumberInsights` - Range/stats chart for numeric columns
- `StringInsights` - Category bar chart for string columns
- `DateTimeInsights` - Timeline chart for datetime columns
- `RangeChart` - Reusable percentage bar component

---

## Implementation Checklist

### LogsPane
- [ ] Create component with table layout
- [ ] Format timestamps with date-fns
- [ ] Handle empty state
- [ ] Handle loading state
- [ ] Style with Tailwind

### PreviewPane
- [ ] Create component with @tanstack/react-table
- [ ] Implement server-side pagination
- [ ] Implement sortable columns
- [ ] Add CSV download functionality
- [ ] Handle empty state
- [ ] Style with Tailwind

### StatisticsPane
- [ ] Create main component
- [ ] Implement per-column task polling
- [ ] Create NumberInsights chart
- [ ] Create StringInsights chart
- [ ] Create DateTimeInsights chart
- [ ] Create RangeChart component
- [ ] Handle loading skeleton per row
- [ ] Add refresh button
- [ ] Handle empty state
- [ ] Style with Tailwind
