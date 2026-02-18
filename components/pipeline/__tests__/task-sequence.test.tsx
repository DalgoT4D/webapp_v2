/**
 * TaskSequence Component - Consolidated Tests
 *
 * Covers task selection, drag-and-drop, removal, and visual elements
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TaskSequence } from '../task-sequence';
import { TransformTask } from '@/types/pipeline';

// Mock dnd-kit with controllable drag end handler
let capturedDragEndHandler: ((event: any) => void) | null = null;

jest.mock('@dnd-kit/core', () => ({
  DndContext: ({
    children,
    onDragEnd,
  }: {
    children: React.ReactNode;
    onDragEnd: (event: any) => void;
  }) => {
    capturedDragEndHandler = onDragEnd;
    return <div data-testid="dnd-context">{children}</div>;
  },
  closestCenter: jest.fn(),
  KeyboardSensor: jest.fn(),
  PointerSensor: jest.fn(),
  useSensor: jest.fn(),
  useSensors: jest.fn().mockReturnValue([]),
}));

jest.mock('@dnd-kit/sortable', () => ({
  arrayMove: jest.fn((arr, from, to) => {
    const result = [...arr];
    const [removed] = result.splice(from, 1);
    result.splice(to, 0, removed);
    return result;
  }),
  SortableContext: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sortable-context">{children}</div>
  ),
  sortableKeyboardCoordinates: jest.fn(),
  useSortable: ({
    id,
    disabled,
  }: {
    id: string;
    disabled: boolean;
  }): {
    attributes: object;
    listeners: object;
    setNodeRef: jest.Mock;
    transform: null;
    transition: null;
    isDragging: boolean;
  } => ({
    attributes: { 'data-sortable-id': id },
    listeners: { 'data-is-disabled': disabled },
    setNodeRef: jest.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
  verticalListSortingStrategy: {},
}));

jest.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: () => '' } },
}));

// Mock Combobox to capture onValueChange handler
let capturedComboboxHandler: ((value: string) => void) | null = null;

jest.mock('@/components/ui/combobox', () => ({
  Combobox: ({
    onValueChange,
    placeholder,
    items,
  }: {
    onValueChange?: (value: string) => void;
    placeholder?: string;
    items: any[];
  }) => {
    capturedComboboxHandler = onValueChange || null;
    return (
      <div data-testid="mock-combobox">
        <input placeholder={placeholder} />
        {items.map((item: any) => (
          <button
            key={item.value}
            data-testid={`select-${item.value}`}
            onClick={() => onValueChange?.(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>
    );
  },
}));

// ============ Test Data ============

const createTask = (overrides: Partial<TransformTask> = {}): TransformTask => ({
  label: 'Test Task',
  slug: 'test-task',
  deploymentId: null,
  lock: null,
  command: 'test command',
  generated_by: 'system',
  uuid: 'task-uuid',
  seq: 1,
  pipeline_default: true,
  order: 1,
  ...overrides,
});

// ============ Tests ============

describe('TaskSequence - Selection and Filtering', () => {
  const mockOnChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    capturedDragEndHandler = null;
    capturedComboboxHandler = null;
  });

  it('filters selected tasks from options, handles selection with sorting, and rejects invalid selections', async () => {
    const user = userEvent.setup();
    const tasks = [
      createTask({ uuid: 'task-1', slug: 'git-pull', command: 'git pull', order: 1 }),
      createTask({ uuid: 'task-2', slug: 'dbt-run', command: 'dbt run', order: 5 }),
      createTask({ uuid: 'task-3', slug: 'dbt-test', command: 'dbt test', order: 6 }),
    ];

    // Filtering: selected task-1 should not appear in options
    const { rerender } = render(
      <TaskSequence value={[tasks[0]]} onChange={mockOnChange} options={tasks} />
    );
    expect(screen.getByPlaceholderText('Select a task to add')).toBeInTheDocument();
    expect(screen.queryByTestId('select-task-1')).not.toBeInTheDocument();
    expect(screen.getByTestId('select-task-2')).toBeInTheDocument();
    expect(screen.getByTestId('select-task-3')).toBeInTheDocument();

    // Select a task from empty state
    rerender(<TaskSequence value={[]} onChange={mockOnChange} options={tasks} />);
    await user.click(screen.getByTestId('select-task-1'));
    expect(mockOnChange).toHaveBeenCalled();
    expect(mockOnChange.mock.calls[0][0]).toHaveLength(1);
    expect(mockOnChange.mock.calls[0][0][0].uuid).toBe('task-1');
    mockOnChange.mockClear();

    // Adding a task sorts by order
    rerender(
      <TaskSequence value={[{ ...tasks[2], order: 6 }]} onChange={mockOnChange} options={tasks} />
    );
    await user.click(screen.getByTestId('select-task-1'));
    expect(mockOnChange).toHaveBeenCalled();
    const sorted = mockOnChange.mock.calls[0][0];
    expect(sorted).toHaveLength(2);
    expect(sorted[0].order).toBeLessThanOrEqual(sorted[1].order);
    mockOnChange.mockClear();

    // Empty uuid is rejected
    if (capturedComboboxHandler) {
      capturedComboboxHandler('');
    }
    expect(mockOnChange).not.toHaveBeenCalled();

    // Non-existent uuid is rejected
    if (capturedComboboxHandler) {
      capturedComboboxHandler('non-existent-uuid');
    }
    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it('resets to default tasks (system + pipeline_default only) and shows slug for null command', async () => {
    const user = userEvent.setup();
    const tasks = [
      createTask({
        uuid: 'task-1',
        slug: 'git-pull',
        generated_by: 'system',
        pipeline_default: true,
      }),
      createTask({
        uuid: 'task-2',
        slug: 'dbt-run',
        generated_by: 'system',
        pipeline_default: true,
      }),
      createTask({
        uuid: 'task-3',
        slug: 'custom',
        generated_by: 'client',
        pipeline_default: false,
      }),
    ];

    const { rerender } = render(
      <TaskSequence value={[tasks[2]]} onChange={mockOnChange} options={tasks} />
    );

    await user.click(screen.getByRole('button', { name: /reset to default/i }));

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ uuid: 'task-1' }),
        expect.objectContaining({ uuid: 'task-2' }),
      ])
    );
    const call = mockOnChange.mock.calls[0][0];
    expect(call.find((t: TransformTask) => t.uuid === 'task-3')).toBeUndefined();
    mockOnChange.mockClear();

    // Null command shows slug
    const nullCmdTask = createTask({ uuid: 'task-null', slug: 'my-task', command: null });
    rerender(
      <TaskSequence value={[nullCmdTask]} onChange={mockOnChange} options={[nullCmdTask]} />
    );
    expect(screen.getByText('my task')).toBeInTheDocument();
  });
});

describe('TaskSequence - Drag and Drop', () => {
  const mockOnChange = jest.fn();

  const systemTasks = [
    createTask({ uuid: 'task-1', slug: 'git-pull', generated_by: 'system', order: 1 }),
    createTask({ uuid: 'task-2', slug: 'dbt-run', generated_by: 'system', order: 5 }),
    createTask({ uuid: 'task-3', slug: 'dbt-test', generated_by: 'system', order: 6 }),
  ];

  const clientTask = createTask({
    uuid: 'task-client',
    slug: 'custom',
    generated_by: 'client',
    pipeline_default: false,
    order: 5,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    capturedDragEndHandler = null;
  });

  it('prevents dragging system tasks and handles null/same/invalid drag scenarios', () => {
    const value = [clientTask, ...systemTasks];

    render(
      <TaskSequence value={value} onChange={mockOnChange} options={[...systemTasks, clientTask]} />
    );

    expect(screen.getByTestId('dnd-context')).toBeInTheDocument();

    // System task drag is blocked
    if (capturedDragEndHandler) {
      capturedDragEndHandler({ active: { id: 'task-1' }, over: { id: 'task-2' } });
    }
    expect(mockOnChange).not.toHaveBeenCalled();

    // Null over target
    if (capturedDragEndHandler) {
      capturedDragEndHandler({ active: { id: 'task-client' }, over: null });
    }
    expect(mockOnChange).not.toHaveBeenCalled();

    // Active equals over
    if (capturedDragEndHandler) {
      capturedDragEndHandler({ active: { id: 'task-client' }, over: { id: 'task-client' } });
    }
    expect(mockOnChange).not.toHaveBeenCalled();

    // Invalid index (non-existent task)
    if (capturedDragEndHandler) {
      capturedDragEndHandler({ active: { id: 'non-existent-task' }, over: { id: 'task-client' } });
    }
    expect(mockOnChange).not.toHaveBeenCalled();
  });
});

describe('TaskSequence - Removal and Visual Elements', () => {
  const mockOnChange = jest.fn();

  beforeEach(() => jest.clearAllMocks());

  it('removes tasks correctly including the last one, and shows index numbers and badges', async () => {
    const user = userEvent.setup();
    const tasks = [
      createTask({ uuid: 'task-1', command: 'git pull', generated_by: 'system' }),
      createTask({ uuid: 'task-2', command: 'custom', generated_by: 'client' }),
    ];

    const { rerender } = render(
      <TaskSequence value={tasks} onChange={mockOnChange} options={tasks} />
    );

    // Visual elements: index numbers, badges, help text
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('system')).toBeInTheDocument();
    expect(screen.getByText('client')).toBeInTheDocument();
    expect(screen.getByText(/These are your transformation tasks/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reset to default/i })).toBeInTheDocument();

    // Remove first task
    const removeButtons = screen.getAllByRole('button', { name: /remove task/i });
    await user.click(removeButtons[0]);
    expect(mockOnChange).toHaveBeenCalledWith([tasks[1]]);
    mockOnChange.mockClear();

    // Remove last remaining task
    rerender(<TaskSequence value={[tasks[0]]} onChange={mockOnChange} options={tasks} />);
    const removeButton = screen.getByRole('button', { name: /remove task/i });
    await user.click(removeButton);
    expect(mockOnChange).toHaveBeenCalledWith([]);
  });
});
