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

interface SortableColumnItemProps {
  id: string;
  column: string;
  disabled?: boolean;
}

function SortableColumnItem({ id, column, disabled }: SortableColumnItemProps) {
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
      <span className="text-sm truncate">{column}</span>
    </div>
  );
}

interface ColumnOrderSectionProps {
  columns: string[];
  onChange: (columns: string[]) => void;
  disabled?: boolean;
}

export function ColumnOrderSection({ columns, onChange, disabled }: ColumnOrderSectionProps) {
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
      onChange(arrayMove(columns, oldIndex, newIndex));
    }
  };

  if (columns.length === 0) {
    return (
      <div className="space-y-2">
        <h4 className="text-sm font-medium">Column Order</h4>
        <p className="text-sm text-muted-foreground text-center py-2">No columns selected.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium">Column Order</h4>
      <p className="text-xs text-muted-foreground">Drag to reorder columns</p>
      <div className="space-y-1">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={columns} strategy={verticalListSortingStrategy}>
            {columns.map((column) => (
              <SortableColumnItem key={column} id={column} column={column} disabled={disabled} />
            ))}
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}
