'use client';

import { useState, useCallback } from 'react';

interface UseTablePaginationReturn {
  page: number;
  pageSize: number;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  handlePageSizeChange: (newPageSize: number) => void;
}

/**
 * useTablePagination - Manages table pagination state
 *
 * Provides page and pageSize state with a handler that resets
 * to page 1 when page size changes
 */
export function useTablePagination(
  initialPage = 1,
  initialPageSize = 20
): UseTablePaginationReturn {
  const [page, setPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const handlePageSizeChange = useCallback((newPageSize: number) => {
    setPageSize(newPageSize);
    setPage(1); // Reset to first page when page size changes
  }, []);

  return {
    page,
    pageSize,
    setPage,
    setPageSize,
    handlePageSizeChange,
  };
}
