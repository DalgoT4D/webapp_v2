'use client';

import { useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Combobox, highlightText } from '@/components/ui/combobox';
import { ColumnTypeIcon } from '@/lib/columnTypeIcons';
import { X, Plus, GripVertical } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface PivotColumnInfo {
  column_name: string;
  data_type: string;
  name: string;
}

interface SortablePivotDimensionProps {
  dim: string;
  idx: number;
  idPrefix: string;
  columnItems: Array<{ value: string; label: string; data_type: string }>;
  disabled?: boolean;
  canDrag: boolean;
  canRemove: boolean;
  onChangeColumn: (idx: number, val: string) => void;
  onRemove: (idx: number) => void;
}

function SortablePivotDimension({
  dim,
  idx,
  idPrefix,
  columnItems,
  disabled,
  canDrag,
  canRemove,
  onChangeColumn,
  onRemove,
}: SortablePivotDimensionProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `${idPrefix}-dim-${idx}`,
    disabled: !canDrag || disabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="space-y-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          {...attributes}
          {...(canDrag && !disabled ? listeners : {})}
          className={`touch-none flex-shrink-0 ${
            canDrag && !disabled
              ? 'cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground'
              : 'cursor-not-allowed text-muted-foreground/50'
          }`}
          disabled={!canDrag || disabled}
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="flex-1">
          <Combobox
            id={`pivot-${idPrefix}-dimension-${idx}`}
            items={columnItems}
            value={dim}
            onValueChange={(val: string) => onChangeColumn(idx, val)}
            placeholder="Select column..."
            searchPlaceholder="Search columns..."
            disabled={disabled}
            renderItem={(item, _isSelected, searchQuery) => (
              <div className="flex items-center gap-2 min-w-0">
                <ColumnTypeIcon dataType={item.data_type} className="w-4 h-4 flex-shrink-0" />
                <span className="truncate" title={`${item.label} (${item.data_type})`}>
                  {highlightText(item.label, searchQuery)}
                </span>
              </div>
            )}
          />
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onRemove(idx)}
          disabled={disabled || !canRemove}
          data-testid={`remove-${idPrefix}-dim-${idx}`}
          className="h-8 w-8 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

interface PivotDimensionListProps {
  /** Selected dimension column names */
  dimensions: string[];
  availableColumns: PivotColumnInfo[];
  /** Emits the next dimensions */
  onChange: (next: { dimensions: string[] }) => void;
  /** Minimum number of dimensions that must remain (1 for rows, 0 for columns) */
  minCount?: number;
  addButtonLabel: string;
  /** Prefix used for sortable ids and test ids, e.g. 'row' | 'col' */
  idPrefix: string;
  disabled?: boolean;
}

/**
 * Drag-and-drop dimension list shared by pivot row and column axes.
 */
export function PivotDimensionList({
  dimensions,
  availableColumns,
  onChange,
  minCount = 0,
  addButtonLabel,
  idPrefix,
  disabled = false,
}: PivotDimensionListProps) {
  // When rows are empty but at least one is required, render a single empty slot
  // so the user always has a combobox to pick from.
  const items = useMemo(
    () => (dimensions.length > 0 ? dimensions : minCount >= 1 ? [''] : []),
    [dimensions, minCount]
  );

  const columnItems = useMemo(
    () =>
      availableColumns.map((col) => ({
        value: col.column_name,
        label: col.name || col.column_name,
        data_type: col.data_type,
      })),
    [availableColumns]
  );

  const emit = useCallback(
    (nextDims: string[]) => {
      onChange({ dimensions: nextDims.filter(Boolean) });
    },
    [onChange]
  );

  // Each slot may keep its own current value plus any column not used elsewhere,
  // so a column already picked in another slot can't be selected again.
  const getColumnItemsFor = useCallback(
    (idx: number) => columnItems.filter((c) => c.value === items[idx] || !items.includes(c.value)),
    [columnItems, items]
  );

  const changeColumn = useCallback(
    (idx: number, newCol: string) => {
      // Guard against selecting a column already used in another slot.
      if (items.some((d, i) => i !== idx && d === newCol)) return;
      const nextDims = [...items];
      nextDims[idx] = newCol;
      emit(nextDims);
    },
    [items, emit]
  );

  const removeDimension = useCallback(
    (idx: number) => {
      emit(items.filter((_, i) => i !== idx));
    },
    [items, emit]
  );

  const addDimension = useCallback(() => {
    const used = new Set(items.filter(Boolean));
    const available = availableColumns.find((c) => !used.has(c.column_name));
    if (!available) return;
    emit([...items.filter(Boolean), available.column_name]);
  }, [items, availableColumns, emit]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        const prefix = `${idPrefix}-dim-`;
        const oldIndex = parseInt(active.id.toString().replace(prefix, ''));
        const newIndex = parseInt(over.id.toString().replace(prefix, ''));
        emit(arrayMove(items, oldIndex, newIndex));
      }
    },
    [items, idPrefix, emit]
  );

  const canDrag = items.length > 1;
  const canRemove = items.filter(Boolean).length > minCount;
  const sortableIds = items.map((_, idx) => `${idPrefix}-dim-${idx}`);
  const allColumnsUsed = availableColumns.every((c) => items.includes(c.column_name));

  return (
    <div className="space-y-3">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
          {items.map((dim, idx) => (
            <SortablePivotDimension
              key={`${idPrefix}-dim-${idx}`}
              dim={dim}
              idx={idx}
              idPrefix={idPrefix}
              columnItems={getColumnItemsFor(idx)}
              disabled={disabled}
              canDrag={canDrag}
              canRemove={canRemove}
              onChangeColumn={changeColumn}
              onRemove={removeDimension}
            />
          ))}
        </SortableContext>
      </DndContext>

      <Button
        type="button"
        variant="default"
        size="default"
        onClick={addDimension}
        disabled={disabled || allColumnsUsed}
        data-testid={`add-${idPrefix}-dimension-btn`}
        className="w-full bg-black text-white hover:bg-gray-800"
      >
        <Plus className="h-4 w-4 mr-2" />
        {addButtonLabel}
      </Button>
    </div>
  );
}
