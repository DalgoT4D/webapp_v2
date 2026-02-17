'use client';

import { useState, useEffect, useMemo } from 'react';
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
import { GripVertical, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Combobox, ComboboxItem } from '@/components/ui/combobox';
import { TransformTask } from '@/types/pipeline';
import { SYSTEM_COMMAND_ORDER, DBT_RUN_MIN_ORDER, DBT_TEST_MIN_ORDER } from '@/constants/pipeline';
import { validateDefaultTasksToApplyInPipeline, getTaskOrder } from '@/lib/pipeline-utils';
import { cn } from '@/lib/utils';

interface TaskSequenceProps {
  value: TransformTask[];
  onChange: (tasks: TransformTask[]) => void;
  options: TransformTask[];
}

/**
 * Find the nearest order greater than target for drop constraints
 */
function findNearestOrder(orders: number[], target: number = 5): number {
  let nearestGreater = 8;
  for (const num of orders) {
    if (num > target && num < nearestGreater) {
      nearestGreater = num;
    }
  }
  return nearestGreater;
}

export function TaskSequence({ value, onChange, options }: TaskSequenceProps) {
  // Filter out already selected tasks from options
  const availableOptions = useMemo(() => {
    const selectedUuids = new Set(value.map((task) => task.uuid));
    return options.filter((option) => !selectedUuids.has(option.uuid));
  }, [value, options]);

  // Convert to combobox items
  const comboboxItems: ComboboxItem[] = useMemo(() => {
    return availableOptions.map((task) => ({
      value: task.uuid,
      label: task.command || task.slug.replace(/-/g, ' '),
    }));
  }, [availableOptions]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleSelect = (uuid: string) => {
    if (!uuid) return;

    const selectedTask = options.find((t) => t.uuid === uuid);
    if (!selectedTask) return;

    // Add task and sort by order
    const newTasks = [...value, { ...selectedTask, order: getTaskOrder(selectedTask.slug) }];
    newTasks.sort((a, b) => (a.order || 0) - (b.order || 0));
    onChange(newTasks);
  };

  const handleRemove = (uuid: string) => {
    onChange(value.filter((task) => task.uuid !== uuid));
  };

  const handleReset = () => {
    const defaultTasks = options.filter(validateDefaultTasksToApplyInPipeline);
    onChange(defaultTasks);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = value.findIndex((t) => t.uuid === active.id);
    const newIndex = value.findIndex((t) => t.uuid === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const draggedTask = value[oldIndex];

    // Check if this is a system task (not draggable)
    if (draggedTask.generated_by === 'system') return;

    // Check drop constraints
    const orders = value.map((t) => t.order || getTaskOrder(t.slug));
    const smallestOrder = draggedTask.slug === 'dbt-run' ? DBT_RUN_MIN_ORDER : DBT_TEST_MIN_ORDER;
    const largestOrder = findNearestOrder(orders, smallestOrder);

    // Find bounds
    const runTaskIndex = value.findIndex(
      (t) => (t.order || getTaskOrder(t.slug)) === smallestOrder
    );
    const testTaskIndex = value.findIndex(
      (t) => (t.order || getTaskOrder(t.slug)) === largestOrder
    );

    // Check if drop is within valid range
    const effectiveRunIndex = runTaskIndex >= 0 ? runTaskIndex : 0;
    const effectiveTestIndex = testTaskIndex >= 0 ? testTaskIndex : value.length;

    if (newIndex < effectiveRunIndex || newIndex > effectiveTestIndex) {
      return; // Invalid drop position
    }

    const newValue = arrayMove(value, oldIndex, newIndex);
    onChange(newValue);
  };

  return (
    <div className="space-y-4">
      <Combobox
        items={comboboxItems}
        placeholder="Select a task to add"
        searchPlaceholder="Search tasks..."
        emptyMessage="No tasks found"
        noItemsMessage="All tasks already added"
        onValueChange={handleSelect}
        id="task-sequence"
      />

      <div className="flex justify-end">
        <Button type="button" variant="outline" size="sm" onClick={handleReset}>
          Reset to default
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        These are your transformation tasks. Most users don&apos;t need to change this list.
      </p>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={value.map((t) => t.uuid)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {value.map((task, index) => (
              <SortableTaskItem key={task.uuid} task={task} index={index} onRemove={handleRemove} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

interface SortableTaskItemProps {
  task: TransformTask;
  index: number;
  onRemove: (uuid: string) => void;
}

function SortableTaskItem({ task, index, onRemove }: SortableTaskItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.uuid,
    disabled: task.generated_by === 'system',
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isSystemTask = task.generated_by === 'system';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn('flex items-center gap-2', isDragging && 'opacity-50')}
    >
      {/* Drag handle - only for non-system tasks */}
      <div
        {...attributes}
        {...listeners}
        className={cn(
          'cursor-grab active:cursor-grabbing',
          isSystemTask && 'opacity-0 cursor-default'
        )}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>

      {/* Index badge */}
      <div className="flex-shrink-0 w-8 h-8 rounded-l bg-primary text-primary-foreground flex items-center justify-center font-semibold text-sm">
        {index + 1}
      </div>

      {/* Task name */}
      <div className="flex-1 h-8 px-3 bg-muted flex items-center text-[15px] text-gray-800">
        {task.command || task.slug.replace(/-/g, ' ')}
      </div>

      {/* Generated by badge */}
      <div className="flex-shrink-0 h-8 px-3 rounded-r bg-primary text-primary-foreground flex items-center text-sm min-w-[70px]">
        {task.generated_by}
      </div>

      {/* Remove button */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => onRemove(task.uuid)}
      >
        <X className="h-4 w-4" />
        <span className="sr-only">Remove task</span>
      </Button>
    </div>
  );
}
