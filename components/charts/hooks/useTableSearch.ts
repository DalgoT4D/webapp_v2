import { useState, useMemo, useCallback } from 'react';
import { useDebounce } from '@/hooks/useDebounce';

export interface SearchMatch {
  rowIndex: number;
  colIndex: number;
}

interface CellEntry {
  rowIndex: number;
  colIndex: number;
  displayValue: string;
}

interface UseTableSearchReturn {
  query: string;
  setQuery: (query: string) => void;
  matches: SearchMatch[];
  totalMatches: number;
  clear: () => void;
}

// Debounce delay before computing matches (ms)
const SEARCH_DEBOUNCE_MS = 150;

export function useTableSearch(cells: CellEntry[]): UseTableSearchReturn {
  const [query, setQuery] = useState('');

  const debouncedQuery = useDebounce(query, SEARCH_DEBOUNCE_MS);

  const matches = useMemo(() => {
    if (!debouncedQuery.trim()) return [];

    const lowerQuery = debouncedQuery.toLowerCase();
    return cells
      .filter((cell) => String(cell.displayValue).toLowerCase().includes(lowerQuery))
      .map(({ rowIndex, colIndex }) => ({ rowIndex, colIndex }));
  }, [cells, debouncedQuery]);

  const totalMatches = matches.length;

  const clear = useCallback(() => {
    setQuery('');
  }, []);

  return {
    query,
    setQuery,
    matches,
    totalMatches,
    clear,
  };
}
