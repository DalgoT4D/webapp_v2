import { useCallback, useState } from 'react';
import type { SortOrder } from './list-logic';

/**
 * Column sort for a list page. Clicking the sorted column flips the order;
 * clicking another column sorts it descending. Lists start descending.
 */
export function useListSort<C extends string>(initialColumn: C) {
  const [sortBy, setSortBy] = useState<C>(initialColumn);
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const handleSort = useCallback(
    (column: C) => {
      if (sortBy === column) {
        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
      } else {
        setSortBy(column);
        setSortOrder('desc');
      }
    },
    [sortBy, sortOrder]
  );

  return { sortBy, sortOrder, handleSort };
}
