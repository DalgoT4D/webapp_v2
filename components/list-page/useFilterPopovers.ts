import { useCallback, useState } from 'react';

/**
 * Open/closed state of a list header's filter popovers, kept at page level so it
 * survives the header unmounting (an empty filtered list unmounts it — pinned).
 */
export function useFilterPopovers<K extends string>(initial: Record<K, boolean>) {
  const [openFilters, setOpenFilters] = useState<Record<K, boolean>>(initial);

  const setFilterOpen = useCallback((key: K, open: boolean) => {
    setOpenFilters((prev) => ({ ...prev, [key]: open }));
  }, []);

  return { openFilters, setFilterOpen };
}
