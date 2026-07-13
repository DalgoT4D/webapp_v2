/**
 * useMultiSelect — generic row-selection state for bulk-action bars.
 *
 * Selection persists across pagination (selectPage/deselectPage only ever
 * touch the ids handed to them, e.g. the current page's rows), and is capped
 * at `max` so a downstream bulk POST can never exceed the backend's item
 * limit (BULK_MAX_ITEMS = 100 for /api/access/bulk/ — see task-17f).
 */
import { useCallback, useMemo, useState } from 'react';

// Mirrors ddpui/core/sharing/sharing_actions.py's BULK_MAX_ITEMS.
export const MAX_BULK_SELECTION = 100;

export function useMultiSelect<K extends string | number>(max: number = MAX_BULK_SELECTION) {
  const [selectedIds, setSelectedIds] = useState<Set<K>>(new Set());

  const toggle = useCallback(
    (id: K) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else if (next.size < max) {
          next.add(id);
        }
        return next;
      });
    },
    [max]
  );

  const selectPage = useCallback(
    (ids: K[]) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const id of ids) {
          if (next.size >= max) break;
          next.add(id);
        }
        return next;
      });
    },
    [max]
  );

  const deselectPage = useCallback((ids: K[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
  }, []);

  // Drop a specific subset without touching the rest — used after a bulk
  // apply to deselect only the ids the server actually applied (skipped/
  // needs-confirmation ids stay selected so the user can see which they were).
  const remove = useCallback((ids: Iterable<K>) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.delete(id);
      return next;
    });
  }, []);

  const clear = useCallback(() => setSelectedIds(new Set()), []);

  const isAtCap = useMemo(() => selectedIds.size >= max, [selectedIds, max]);

  return {
    selectedIds,
    toggle,
    selectPage,
    deselectPage,
    remove,
    clear,
    isAtCap,
    maxSelection: max,
  };
}
