'use client';

import { GripVertical } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ColumnAlignment } from './types';

/** Alignment options shown in the dropdown */
const ALIGNMENT_OPTIONS: Array<{ value: 'auto' | ColumnAlignment; label: string }> = [
  { value: 'auto', label: 'Auto' },
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' },
];

interface SortableColumnRowProps {
  id: string;
  column: string;
  alignmentValue: string;
  onAlignmentChange: (column: string, value: string) => void;
  disabled?: boolean;
}

function SortableColumnRow({
  id,
  column,
  alignmentValue,
  onAlignmentChange,
  disabled,
}: SortableColumnRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
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
      className="flex items-center gap-2 p-2 rounded-md border bg-background hover:bg-muted/30 transition-colors"
    >
      <button
        type="button"
        {...attributes}
        {...(disabled ? {} : listeners)}
        className={`touch-none flex-shrink-0 ${
          disabled
            ? 'cursor-not-allowed text-muted-foreground/50'
            : 'cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground'
        }`}
        aria-label={`Drag to reorder ${column}`}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="text-sm truncate flex-1 min-w-0">{column}</span>
      <Select
        value={alignmentValue}
        onValueChange={(val) => onAlignmentChange(column, val)}
        disabled={disabled}
      >
        <SelectTrigger
          data-testid={`alignment-${column}`}
          className="h-7 w-[90px] text-xs flex-shrink-0"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ALIGNMENT_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

interface ColumnSettingsSectionProps {
  columns: string[];
  alignment: Record<string, ColumnAlignment>;
  onOrderChange: (columns: string[]) => void;
  onAlignmentChange: (alignment: Record<string, ColumnAlignment>) => void;
  disabled?: boolean;
}

export function ColumnSettingsSection({
  columns,
  alignment,
  onOrderChange,
  onAlignmentChange,
  disabled,
}: ColumnSettingsSectionProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = columns.indexOf(active.id as string);
      const newIndex = columns.indexOf(over.id as string);
      onOrderChange(arrayMove(columns, oldIndex, newIndex));
    }
  };

  const handleAlignmentChange = (column: string, value: string) => {
    if (value === 'auto') {
      const updated = { ...alignment };
      delete updated[column];
      onAlignmentChange(updated);
    } else {
      onAlignmentChange({ ...alignment, [column]: value as ColumnAlignment });
    }
  };

  if (columns.length === 0) {
    return (
      <div className="space-y-2">
        <h4 className="text-sm font-medium">Columns</h4>
        <p className="text-sm text-muted-foreground text-center py-2">No columns selected.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium">Columns</h4>
      <p className="text-xs text-muted-foreground">
        Drag to reorder. Alignment: Auto = numbers right, text left.
      </p>
      <div className="space-y-1">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={columns} strategy={verticalListSortingStrategy}>
            {columns.map((column) => (
              <SortableColumnRow
                key={column}
                id={column}
                column={column}
                alignmentValue={alignment[column] || 'auto'}
                onAlignmentChange={handleAlignmentChange}
                disabled={disabled}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}
