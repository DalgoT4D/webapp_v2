import { useState, useCallback } from 'react';

export interface PaginationState {
  page: number;
  pageSize: number;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  /** Sets page size and resets to page 1 */
  handlePageSizeChange: (pageSize: number) => void;
  /** Resets to page 1 */
  resetPage: () => void;
}

/**
 * Hook for managing pagination state with automatic page reset on page size change.
 *
 * @example
 * ```tsx
 * const dataPreviewPagination = usePagination(1, 20);
 * const rawDataPagination = usePagination();
 *
 * // Use in component
 * <DataPreview
 *   pagination={{
 *     page: dataPreviewPagination.page,
 *     pageSize: dataPreviewPagination.pageSize,
 *     total: totalRows,
 *     onPageChange: dataPreviewPagination.setPage,
 *     onPageSizeChange: dataPreviewPagination.handlePageSizeChange,
 *   }}
 * />
 * ```
 */
export function usePagination(initialPage = 1, initialPageSize = 20): PaginationState {
  const [page, setPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const handlePageSizeChange = useCallback((newPageSize: number) => {
    setPageSize(newPageSize);
    setPage(1); // Reset to first page when page size changes
  }, []);

  const resetPage = useCallback(() => {
    setPage(1);
  }, []);

  return {
    page,
    pageSize,
    setPage,
    setPageSize,
    handlePageSizeChange,
    resetPage,
  };
}

export default usePagination;
