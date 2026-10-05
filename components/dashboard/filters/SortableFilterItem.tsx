'use client';

import { memo, useCallback } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FilterElement } from '@/components/dashboard/filter-element';
import type { DashboardFilterConfig } from '@/types/dashboard-filters';
import { cn } from '@/lib/utils';

// Unified sortable filter item component
export interface SortableFilterItemProps {
  filter: DashboardFilterConfig;
  value: unknown;
  onFilterChange: (filterId: string, value: unknown) => void;
  onRemove?: (filterId: string) => void;
  onEdit?: (filter: DashboardFilterConfig) => void;
  isEditMode?: boolean;
  layout: 'vertical' | 'horizontal';
  isPublicMode?: boolean;
  publicToken?: string;
  isReportMode?: boolean;
}

// Memoized so unrelated siblings don't re-render when one item's value changes
// or when dnd-kit fires a dragOver on a neighbor. The default shallow compare
// works because the parent passes stable refs (useCallback) and per-item value.
export const SortableFilterItem = memo(function SortableFilterItem({
  filter,
  value,
  onFilterChange,
  onRemove,
  onEdit,
  isEditMode = false,
  layout,
  isPublicMode = false,
  publicToken,
  isReportMode = false,
}: SortableFilterItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: filter.id,
  });

  // dnd-kit sets `transition` itself: an empty string for the actively dragged
  // item (so it follows the pointer 1:1) and a slide-into-place transition for
  // siblings. Don't add `transition-all` via className — it would animate the
  // transform of the dragged item and make it lag behind the cursor.
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleRemove = useCallback(() => onRemove?.(filter.id), [onRemove, filter.id]);
  const handleEdit = useCallback(() => onEdit?.(filter), [onEdit, filter]);

  // The horizontal item has no {...attributes}; keyboard reorder listeners sit on FilterElement's handle (PINNED-BUGS: "Filter keyboard reorder announced ("press space") but does nothing — key listeners on non-focusable handle").
  if (layout === 'horizontal') {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className={cn('min-w-[250px] max-w-[400px] flex-shrink-0', isDragging && 'shadow-lg z-50')}
      >
        <FilterElement
          filter={filter}
          value={value}
          onChange={onFilterChange}
          onRemove={isEditMode ? handleRemove : undefined}
          onEdit={isEditMode ? handleEdit : undefined}
          isPublicMode={isPublicMode}
          publicToken={publicToken}
          isReportMode={isReportMode}
          isEditMode={isEditMode}
          showTitle={true}
          compact={true}
          dragHandleProps={isEditMode ? listeners : undefined}
        />
      </div>
    );
  }

  // Vertical layout
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'border border-gray-100 rounded-lg p-3 bg-gray-50',
        isDragging && 'shadow-lg z-50',
        isEditMode && 'hover:border-gray-300'
      )}
      {...attributes}
    >
      <FilterElement
        filter={filter}
        value={value}
        onChange={onFilterChange}
        onRemove={isEditMode ? handleRemove : undefined}
        onEdit={isEditMode ? handleEdit : undefined}
        isEditMode={isEditMode}
        showTitle={true}
        compact={false}
        dragHandleProps={isEditMode ? listeners : undefined}
        isPublicMode={isPublicMode}
        publicToken={publicToken}
        isReportMode={isReportMode}
      />
    </div>
  );
});
