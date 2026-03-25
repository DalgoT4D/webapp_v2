// components/explore/PreviewPane.tsx
'use client';

import { useState, useCallback, useEffect } from 'react';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Download,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import {
  useTableData,
  useTableColumns,
  useTableCount,
  downloadTableCSV,
} from '@/hooks/api/useWarehouse';
import { toast } from 'sonner';
import { PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from '@/constants/explore';
import type { SortConfig, PaginationConfig } from '@/types/explore';
import { cn } from '@/lib/utils';

// Fixed heights for header and pagination bars
const HEADER_HEIGHT = 40;
const PAGINATION_HEIGHT = 36;

interface PreviewPaneProps {
  schema: string;
  table: string;
  /** When provided, uses explicit pixel heights instead of flex layout */
  containerHeight?: number;
}

// Threshold for showing "click to view" dialog instead of tooltip
const LONG_CELL_THRESHOLD = 200;

export function PreviewPane({ schema, table, containerHeight }: PreviewPaneProps) {
  const [expandedCell, setExpandedCell] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    column: null,
    order: 1,
  });
  const [pagination, setPagination] = useState<PaginationConfig>({
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const [downloading, setDownloading] = useState(false);

  // Reset pagination when table changes
  useEffect(() => {
    setPagination({ page: 1, pageSize: DEFAULT_PAGE_SIZE });
    setSortConfig({ column: null, order: 1 });
  }, [schema, table]);

  const { data: columns, isLoading: columnsLoading } = useTableColumns(schema, table);
  const { data: tableData, isLoading: dataLoading } = useTableData(schema, table, {
    page: pagination.page,
    limit: pagination.pageSize,
    order_by: sortConfig.column ?? undefined,
    order: sortConfig.column ? sortConfig.order : undefined,
  });
  const { data: countData } = useTableCount(schema, table);

  const totalRows = countData?.total_rows ?? 0;
  const totalPages = Math.ceil(totalRows / pagination.pageSize);
  const startRow = (pagination.page - 1) * pagination.pageSize + 1;
  const endRow = Math.min(pagination.page * pagination.pageSize, totalRows);

  const handleSort = useCallback((columnName: string) => {
    setSortConfig((prev) => {
      if (prev.column === columnName) {
        return { column: columnName, order: prev.order === 1 ? -1 : 1 };
      }
      return { column: columnName, order: 1 };
    });
    // Reset to first page when sorting changes
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, []);

  const handleDownload = useCallback(async () => {
    setDownloading(true);
    try {
      await downloadTableCSV(schema, table);
      toast.success('CSV downloaded successfully');
    } catch (error) {
      toast.error('Failed to download CSV');
      console.error('Download error:', error);
    } finally {
      setDownloading(false);
    }
  }, [schema, table]);

  const handlePageSizeChange = useCallback((value: string) => {
    setPagination({ page: 1, pageSize: parseInt(value, 10) });
  }, []);

  const handlePrevPage = useCallback(() => {
    setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }));
  }, []);

  const handleNextPage = useCallback(() => {
    setPagination((prev) => ({
      ...prev,
      page: Math.min(totalPages, prev.page + 1),
    }));
  }, [totalPages]);

  const isLoading = columnsLoading || dataLoading;

  const headerContent = (
    <>
      <h2 className="font-bold text-base text-gray-900 pl-6" data-testid="preview-table-name">
        {schema}.{table}
      </h2>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleDownload}
        disabled={downloading || isLoading}
        className="text-white hover:opacity-90 shadow-xs"
        style={{ backgroundColor: 'var(--primary)' }}
        data-testid="download-csv-btn"
      >
        {downloading ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Download className="h-4 w-4 mr-2" />
        )}
        DOWNLOAD CSV
      </Button>
    </>
  );

  const tableContent = (
    <Table>
      <TableHeader className="sticky top-0 z-10">
        <TableRow className="hover:bg-[#F5FAFA]" style={{ backgroundColor: '#F5FAFA' }}>
          {isLoading
            ? Array.from({ length: 5 }).map((_, i) => (
                <TableHead
                  key={i}
                  className={cn(
                    'text-base font-bold border border-[#dddddd] border-l-0',
                    i === 0 && 'pl-10'
                  )}
                >
                  <Skeleton className="h-4 w-24" />
                </TableHead>
              ))
            : columns?.map((col, i) => (
                <TableHead
                  key={col.name}
                  className={cn(
                    'text-base font-bold cursor-pointer hover:bg-gray-100 transition-colors border border-[#dddddd] border-l-0',
                    i === 0 && 'pl-10'
                  )}
                  style={{ color: 'rgba(15, 36, 64, 0.57)' }}
                  onClick={() => handleSort(col.name)}
                  data-testid={`sort-header-${col.name}`}
                >
                  <div className="flex items-center gap-2 py-1">
                    {col.name}
                    {sortConfig.column === col.name ? (
                      sortConfig.order === 1 ? (
                        <ArrowUp className="h-4 w-4 text-gray-600" />
                      ) : (
                        <ArrowDown className="h-4 w-4 text-gray-600" />
                      )
                    ) : (
                      <ArrowUpDown className="h-4 w-4 text-gray-400" />
                    )}
                  </div>
                </TableHead>
              ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading ? (
          Array.from({ length: pagination.pageSize }).map((_, rowIdx) => (
            <TableRow key={rowIdx}>
              {Array.from({ length: 5 }).map((_, cellIdx) => (
                <TableCell key={cellIdx} className="py-3 border-r last:border-r-0">
                  <Skeleton className="h-4 w-full" />
                </TableCell>
              ))}
            </TableRow>
          ))
        ) : tableData && tableData.length > 0 ? (
          tableData.map((row, rowIdx) => (
            <TableRow
              key={rowIdx}
              data-testid={`data-row-${rowIdx}`}
              className="hover:bg-gray-50/50"
            >
              {columns?.map((col, i) => {
                const cellValue =
                  row[col.name] != null
                    ? typeof row[col.name] === 'object'
                      ? JSON.stringify(row[col.name])
                      : String(row[col.name])
                    : '';
                const isLong = cellValue.length > LONG_CELL_THRESHOLD;
                const isMedium = cellValue.length > 30;
                return (
                  <TableCell
                    key={col.name}
                    className={cn(
                      'py-2 max-w-xs truncate text-gray-700 text-[0.8rem] border-b border-r border-[#dddddd] last:border-r-0',
                      i === 0 && 'pl-10'
                    )}
                  >
                    {isLong ? (
                      <span
                        className="block truncate cursor-pointer hover:text-primary"
                        onClick={() => setExpandedCell(cellValue)}
                        title="Click to view full content"
                      >
                        {cellValue}
                      </span>
                    ) : isMedium ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="block truncate cursor-default">{cellValue}</span>
                        </TooltipTrigger>
                        <TooltipContent
                          side="bottom"
                          className="max-w-sm break-words whitespace-pre-wrap text-xs"
                        >
                          {cellValue}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <span className="block truncate">{cellValue}</span>
                    )}
                  </TableCell>
                );
              })}
            </TableRow>
          ))
        ) : (
          <TableRow>
            <TableCell
              colSpan={columns?.length ?? 5}
              className="text-center text-muted-foreground py-12"
            >
              No data available
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );

  const paginationContent = (
    <>
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500">Show</span>
        <Select value={pagination.pageSize.toString()} onValueChange={handlePageSizeChange}>
          <SelectTrigger
            className="h-7 text-sm border-gray-200 bg-white"
            style={{ width: '70px' }}
            data-testid="page-size-select"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_OPTIONS.map((size) => (
              <SelectItem key={size} value={size.toString()}>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-600" data-testid="pagination-info">
          {totalRows > 0 ? `${startRow}-${endRow} of ${totalRows.toLocaleString()}` : '0 rows'}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePrevPage}
            disabled={pagination.page <= 1 || isLoading}
            className="h-7 px-2 hover:bg-gray-100 disabled:opacity-50"
            data-testid="prev-page-btn"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-gray-600 px-3 py-1">
            {pagination.page} of {totalPages || 1}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleNextPage}
            disabled={pagination.page >= totalPages || isLoading}
            className="h-7 px-2 hover:bg-gray-100 disabled:opacity-50"
            data-testid="next-page-btn"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </>
  );

  // When containerHeight is provided (canvas context), use absolute positioning
  // to guarantee header/pagination are always visible and table scrolls between them.
  const cellDialog = (
    <Dialog open={expandedCell !== null} onOpenChange={(open) => !open && setExpandedCell(null)}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Cell Content</DialogTitle>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-auto rounded bg-gray-50 p-4">
          <pre className="text-sm whitespace-pre-wrap break-words font-mono">{expandedCell}</pre>
        </div>
      </DialogContent>
    </Dialog>
  );

  if (containerHeight) {
    return (
      <>
        <div className="relative bg-white" style={{ height: containerHeight }}>
          {/* Header — pinned to top */}
          <div
            className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 border-b bg-white z-10"
            style={{ height: HEADER_HEIGHT }}
          >
            {headerContent}
          </div>

          {/* Table — scrollable middle */}
          <div
            className="absolute left-0 right-0 overflow-auto"
            style={{ top: HEADER_HEIGHT, bottom: PAGINATION_HEIGHT }}
          >
            {tableContent}
          </div>

          {/* Pagination — pinned to bottom */}
          <div
            className="absolute left-0 right-0 flex items-center justify-between px-4 mr-5 border-t border-gray-100 bg-gray-50/30 z-10"
            style={{ bottom: 4, height: PAGINATION_HEIGHT }}
          >
            {paginationContent}
          </div>
        </div>
        {cellDialog}
      </>
    );
  }

  // Default layout (Explore page) — flex-based, h-full from parent
  return (
    <>
      <div className="flex flex-col h-full bg-white pb-4">
        {/* Header */}
        <div
          className="flex-shrink-0 flex items-center justify-between px-4 border-b"
          style={{ height: HEADER_HEIGHT }}
        >
          {headerContent}
        </div>

        {/* Table */}
        <div className="flex-1 min-h-0 overflow-auto">{tableContent}</div>

        {/* Pagination */}
        <div
          className="flex-shrink-0 flex items-center justify-between px-4 mr-5 border-t border-gray-100 bg-gray-50/30"
          style={{ height: PAGINATION_HEIGHT }}
        >
          {paginationContent}
        </div>
      </div>
      {cellDialog}
    </>
  );
}
