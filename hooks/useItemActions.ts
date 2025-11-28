/**
 * Custom hook for managing common item actions (delete, duplicate)
 * Provides loading states and standardized toast notifications
 */

import { useState, useCallback } from 'react';
import { toastSuccess, toastError } from '@/lib/toast';

export interface UseItemActionsOptions<T, TId = number> {
  /** Function to delete an item */
  deleteFn?: (id: TId) => Promise<void>;
  /** Function to duplicate an item, returns the new item */
  duplicateFn?: (item: T) => Promise<T>;
  /** Function to refresh data after mutation */
  mutate: () => Promise<unknown> | void;
  /** Extract title from item for toast messages */
  getTitle: (item: T) => string;
  /** Extract ID from item */
  getId: (item: T) => TId;
  /** Entity name for generic messages (e.g., "chart", "dashboard") */
  entityName?: string;
}

export interface UseItemActionsReturn<T, TId = number> {
  /** ID of item currently being deleted, or null */
  isDeleting: TId | null;
  /** ID of item currently being duplicated, or null */
  isDuplicating: TId | null;
  /** Whether any action is in progress */
  isActionInProgress: boolean;

  /** Handle delete with loading state and toast */
  handleDelete: (item: T) => Promise<boolean>;
  /** Handle duplicate with loading state and toast */
  handleDuplicate: (item: T) => Promise<T | null>;

  /** Check if a specific item is being deleted */
  isItemDeleting: (id: TId) => boolean;
  /** Check if a specific item is being duplicated */
  isItemDuplicating: (id: TId) => boolean;
}

/**
 * Hook for managing delete and duplicate actions with loading states
 *
 * @example
 * ```tsx
 * const {
 *   isDeleting,
 *   isDuplicating,
 *   handleDelete,
 *   handleDuplicate,
 *   isItemDeleting,
 * } = useItemActions({
 *   deleteFn: deleteChart,
 *   duplicateFn: async (chart) => {
 *     const newChart = await createChart({ ...chart, title: newTitle });
 *     return newChart;
 *   },
 *   mutate,
 *   getTitle: (chart) => chart.title,
 *   getId: (chart) => chart.id,
 *   entityName: 'chart',
 * });
 *
 * // In action menu
 * <Button
 *   onClick={() => handleDelete(chart)}
 *   disabled={isItemDeleting(chart.id)}
 * >
 *   {isItemDeleting(chart.id) ? 'Deleting...' : 'Delete'}
 * </Button>
 * ```
 */
export function useItemActions<T, TId = number>(
  options: UseItemActionsOptions<T, TId>
): UseItemActionsReturn<T, TId> {
  const { deleteFn, duplicateFn, mutate, getTitle, getId, entityName = 'item' } = options;

  const [isDeleting, setIsDeleting] = useState<TId | null>(null);
  const [isDuplicating, setIsDuplicating] = useState<TId | null>(null);

  const handleDelete = useCallback(
    async (item: T): Promise<boolean> => {
      if (!deleteFn) {
        console.warn('Delete function not provided to useItemActions');
        return false;
      }

      const id = getId(item);
      const title = getTitle(item);

      setIsDeleting(id);
      try {
        await deleteFn(id);
        await mutate();
        toastSuccess.deleted(title);
        return true;
      } catch (error) {
        console.error(`Error deleting ${entityName}:`, error);
        toastError.delete(error, title);
        return false;
      } finally {
        setIsDeleting(null);
      }
    },
    [deleteFn, mutate, getTitle, getId, entityName]
  );

  const handleDuplicate = useCallback(
    async (item: T): Promise<T | null> => {
      if (!duplicateFn) {
        console.warn('Duplicate function not provided to useItemActions');
        return null;
      }

      const id = getId(item);
      const title = getTitle(item);

      setIsDuplicating(id);
      try {
        const newItem = await duplicateFn(item);
        await mutate();
        const newTitle = getTitle(newItem);
        toastSuccess.duplicated(title, newTitle);
        return newItem;
      } catch (error) {
        console.error(`Error duplicating ${entityName}:`, error);
        toastError.duplicate(error, title);
        return null;
      } finally {
        setIsDuplicating(null);
      }
    },
    [duplicateFn, mutate, getTitle, getId, entityName]
  );

  const isItemDeleting = useCallback((id: TId): boolean => isDeleting === id, [isDeleting]);

  const isItemDuplicating = useCallback(
    (id: TId): boolean => isDuplicating === id,
    [isDuplicating]
  );

  return {
    isDeleting,
    isDuplicating,
    isActionInProgress: isDeleting !== null || isDuplicating !== null,
    handleDelete,
    handleDuplicate,
    isItemDeleting,
    isItemDuplicating,
  };
}

export default useItemActions;
