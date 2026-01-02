'use client';

import { Plus, X, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ColumnTypeIcon } from '@/lib/columnTypeIcons';
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between gap-2 p-2 border rounded-md hover:bg-gray-50/50 bg-white"
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {/* Drag Handle */}
        <button
          type="button"
          {...attributes}
          {...(canDrag && !disabled ? listeners : {})}
          className={`touch-none ${
            canDrag && !disabled
              ? 'cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground'
              : 'cursor-not-allowed text-muted-foreground/50'
          }`}
          disabled={!canDrag || disabled}
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-5 w-5" />
        </button>

        <Select
          value={dimension.column || ''}
          onValueChange={(value) => onChange(index, 'column', value)}
          disabled={disabled}
        >
          <SelectTrigger className="h-9 flex-1 min-w-0">
            <SelectValue placeholder="Select dimension column" />
          </SelectTrigger>
          <SelectContent>
            {availableColumns.map((col) => (
              <SelectItem key={col.column_name} value={col.column_name}>
                <div className="flex items-center gap-2 min-w-0">
                  <ColumnTypeIcon dataType={col.data_type} className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate" title={`${col.column_name} (${col.data_type})`}>
                    {col.column_name}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-destructive hover:text-destructive"
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

  return (
    <div className="space-y-4">
      {/* Drill Down Toggle - Single toggle at the top */}
      <div className="flex items-center space-x-2">
        <Switch
          id="drill-down-toggle"
          checked={isDrillDownEnabled}
          onCheckedChange={(checked) => handleDrillDownToggle(checked)}
          disabled={disabled || effectiveDimensions.length === 0}
        />
        <Label htmlFor="drill-down-toggle" className="text-sm font-medium cursor-pointer">
          Drill Down
        </Label>
      </div>

      {/* Dimensions List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Dimension</CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddDimension}
              disabled={disabled || getAvailableColumns().length === 0}
            >
              <Plus className="h-4 w-4 mr-1" />
              ADD DIMENSION(s)
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
              {effectiveDimensions.map((dimension, index) => (
                <SortableDimensionItem
                  key={`dimension-${index}`}
                  dimension={dimension}
                  index={index}
                  availableColumns={availableColumns}
                  disabled={disabled}
                  canDrag={effectiveDimensions.length > 1}
                  canRemove={effectiveDimensions.length > 1}
                  onRemove={handleRemoveDimension}
                  onChange={handleDimensionChange}
                />
              ))}
            </SortableContext>
          </DndContext>

          {effectiveDimensions.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-4">
              No dimensions configured. Add at least one dimension to display data.
            </div>
          )}

          {isDrillDownEnabled && effectiveDimensions.length > 0 && (
            <div className="text-xs text-muted-foreground mt-2 pt-2 border-t">
              Drill-down will follow the order:{' '}
              {effectiveDimensions
                .map((d, i) => d.column || `Dimension ${i + 1}`)
                .filter(Boolean)
                .join(' → ')}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
