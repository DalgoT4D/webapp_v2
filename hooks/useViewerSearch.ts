import { useState, useEffect } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import { TABLE_SEARCH_DEBOUNCE_MS } from '@/constants/chart-types';

interface UseViewerSearchOptions {
  /** Called whenever the debounced search term changes, so the caller can
   * reset its own page state back to 1. */
  setPage: (page: number) => void;
}

/**
 * Session-only table search box, shared across chart view/edit/configure/dashboard.
 * Debounces the raw keystrokes so the server-side search request only fires
 * once typing settles, and resets pagination whenever the debounced term changes.
 */
export function useViewerSearch({ setPage }: UseViewerSearchOptions) {
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, TABLE_SEARCH_DEBOUNCE_MS);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, setPage]);

  return { searchQuery, debouncedSearch, onSearchChange: setSearchQuery };
}
