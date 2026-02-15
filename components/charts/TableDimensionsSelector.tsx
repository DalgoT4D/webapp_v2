'use client';

import React from 'react';
import { Plus, X, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ColumnTypeIcon } from '@/lib/columnTypeIcons';
import { Combobox, highlightText } from '@/components/ui/combobox';
import type { ChartDimension } from '@/types/charts';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface TableDimensionsSelectorProps {
  dimensions: ChartDimension[];
  availableColumns: Array<{ column_name: string; data_type: string; name: string }>;
  onChange: (dimensions: ChartDimension[]) => void;
  disabled?: boolean;
}

// Sortable dimension item component
function SortableDimensionItem({
  dimension,
  index,
  availableColumns,
  disabled,
  canDrag,
  canRemove,
  onRemove,
  onChange,
}: {
  dimension: ChartDimension;
  index: number;
  availableColumns: Array<{ column_name: string; data_type: string; name: string }>;
  disabled?: boolean;
  canDrag?: boolean;
  canRemove?: boolean;
  onRemove: (index: number) => void;
  onChange: (index: number, field: keyof ChartDimension, value: any) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `dimension-${index}`,
    disabled: !canDrag || disabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const columnItems = React.useMemo(
    () =>
      availableColumns.map((col) => ({
        value: col.column_name,
        label: col.column_name,
        data_type: col.data_type,
      })),
    [availableColumns]
  );

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 w-full">
      {/* Drag Handle (Grid Icon) */}
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

      {/* Dimension Name - Column name and searchable dropdown */}
      <div className="flex-1 min-w-0">
        <Combobox
          items={columnItems}
          value={dimension.column || ''}
          onValueChange={(value) => onChange(index, 'column', value)}
          disabled={disabled}
          searchPlaceholder="Search columns..."
          placeholder="Select dimension"
          compact
          className="w-full"
          renderItem={(item, _isSelected, searchQuery) => (
            <div className="flex items-center gap-2 min-w-0">
              <ColumnTypeIcon dataType={item.data_type} className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{highlightText(item.label, searchQuery)}</span>
            </div>
          )}
        />
      </div>
    </div>
  );
}

// Wrapper component to position X button outside
function DimensionItemWrapper({
  dimension,
  index,
  availableColumns,
  disabled,
  canDrag,
  canRemove,
  onRemove,
  onChange,
}: {
  dimension: ChartDimension;
  index: number;
  availableColumns: Array<{ column_name: string; data_type: string; name: string }>;
  disabled?: boolean;
  canDrag?: boolean;
  canRemove?: boolean;
  onRemove: (index: number) => void;
  onChange: (index: number, field: keyof ChartDimension, value: any) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <SortableDimensionItem
        dimension={dimension}
        index={index}
        availableColumns={availableColumns}
        disabled={disabled}
        canDrag={canDrag}
        canRemove={canRemove}
        onRemove={onRemove}
        onChange={onChange}
      />
      {/* Remove Button - Outside the dimension field */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-6 w-6 text-muted-foreground hover:text-destructive flex-shrink-0"
        onClick={() => onRemove(index)}
        disabled={!canRemove || disabled}
        title="Remove dimension"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function TableDimensionsSelector({
  dimensions,
  availableColumns,
  onChange,
  disabled,
}: TableDimensionsSelectorProps) {
  // Get available columns that aren't already selected
  const getAvailableColumns = () => {
    const selectedColumns = dimensions.map((d) => d.column).filter(Boolean);
    return availableColumns.filter((col) => !selectedColumns.includes(col.column_name));
  };

  // Check if drill-down is enabled (if any dimension has it enabled)
  const isDrillDownEnabled = dimensions.some((d) => d.enable_drill_down === true);

  // Set up sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = parseInt(active.id.toString().replace('dimension-', ''));
      const newIndex = parseInt(over.id.toString().replace('dimension-', ''));

      const newDimensions = arrayMove(dimensions, oldIndex, newIndex);
      onChange(newDimensions);
    }
  };

  const handleDrillDownToggle = (enabled: boolean) => {
    // When drill-down is toggled, enable/disable it for all dimensions
    const newDimensions = dimensions.map((dim) => ({
      ...dim,
      enable_drill_down: enabled,
    }));
    onChange(newDimensions);
  };

  const handleAddDimension = () => {
    const availableCols = getAvailableColumns();
    if (availableCols.length > 0) {
      const newDimension: ChartDimension = {
        column: availableCols[0].column_name,
        enable_drill_down: isDrillDownEnabled, // Inherit current drill-down state
      };
      onChange([...dimensions, newDimension]);
    }
  };

  const handleRemoveDimension = (index: number) => {
    const newDimensions = dimensions.filter((_, i) => i !== index);
    onChange(newDimensions);
  };

  const handleDimensionChange = (index: number, field: keyof ChartDimension, value: any) => {
    const newDimensions = [...dimensions];
    newDimensions[index] = {
      ...newDimensions[index],
      [field]: value,
    };
    onChange(newDimensions);
  };

  // Ensure at least one dimension exists (default)
  const effectiveDimensions =
    dimensions.length > 0 ? dimensions : [{ column: '', enable_drill_down: false }];

  // Create sortable IDs
  const sortableIds = effectiveDimensions.map((_, index) => `dimension-${index}`);

  // Determine if dragging is allowed (only if there's more than one dimension)
  const canDrag = effectiveDimensions.length > 1;

  return (
    <div className="space-y-4">
      {/* Header: Dimension title on left, Drill Down toggle on right */}
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium text-gray-900">Dimension</Label>
        <div className="flex items-center gap-2">
          <Label htmlFor="drill-down-toggle" className="text-sm font-medium cursor-pointer">
            Drill Down
          </Label>
          <Switch
            id="drill-down-toggle"
            checked={isDrillDownEnabled}
            onCheckedChange={(checked) => handleDrillDownToggle(checked)}
            disabled={disabled || effectiveDimensions.length === 0}
          />
        </div>
      </div>

      {/* Dimensions List with Drag and Drop */}
      <div className="space-y-2">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
            {effectiveDimensions.map((dimension, index) => (
              <DimensionItemWrapper
                key={`dimension-${index}`}
                dimension={dimension}
                index={index}
                availableColumns={availableColumns}
                disabled={disabled}
                canDrag={canDrag}
                canRemove={effectiveDimensions.length > 1}
                onRemove={handleRemoveDimension}
                onChange={handleDimensionChange}
              />
            ))}
          </SortableContext>
        </DndContext>

        {effectiveDimensions.length === 0 && (
          <div className="text-sm text-muted-foreground text-center py-4 border rounded-md">
            No dimensions configured. Add at least one dimension to display data.
          </div>
        )}
      </div>

      {/* ADD DIMENSION(s) Button at the bottom - black button with white text */}
      <Button
        type="button"
        variant="default"
        size="default"
        onClick={handleAddDimension}
        disabled={disabled || getAvailableColumns().length === 0}
        className="w-full bg-black text-white hover:bg-gray-800"
      >
        <Plus className="h-4 w-4 mr-2" />
        ADD DIMENSION(s)
      </Button>

      {/* Drill-down order indicator */}
      {isDrillDownEnabled && effectiveDimensions.length > 0 && (
        <div className="text-xs text-muted-foreground pt-2 border-t">
          Drill-down will follow the order:{' '}
          {effectiveDimensions
            .map((d, i) => d.column || `Dimension ${i + 1}`)
            .filter(Boolean)
            .join(' → ')}
        </div>
      )}
    </div>
  );
}
