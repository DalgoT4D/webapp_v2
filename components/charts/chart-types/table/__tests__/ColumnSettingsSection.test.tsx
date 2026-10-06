import type { ReactNode } from 'react';
import type { SensorDescriptor, SensorOptions } from '@dnd-kit/core';
import type { Transform } from '@dnd-kit/utilities';
import { render, screen } from '@testing-library/react';
import type { ColumnAlignment } from '../types';
import { ColumnSettingsSection } from '../ColumnSettingsSection';

// Mock @dnd-kit
jest.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  closestCenter: jest.fn(),
  KeyboardSensor: jest.fn(),
  PointerSensor: jest.fn(),
  useSensor: jest.fn(),
  useSensors: jest.fn((): SensorDescriptor<SensorOptions>[] => []),
}));

jest.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  verticalListSortingStrategy: jest.fn(),
  useSortable: jest.fn(() => ({
    attributes: {},
    listeners: {},
    setNodeRef: jest.fn(),
    transform: null as Transform | null,
    transition: null as string | null,
    isDragging: false,
  })),
  arrayMove: jest.fn((arr: unknown[], from: number, to: number) => {
    const newArr = [...arr];
    const [removed] = newArr.splice(from, 1);
    newArr.splice(to, 0, removed);
    return newArr;
  }),
}));

jest.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: () => '' } },
}));

describe('ColumnSettingsSection', () => {
  const defaultProps = {
    columns: ['name', 'revenue', 'region'],
    alignment: {} as Record<string, ColumnAlignment>,
    onOrderChange: jest.fn(),
    onAlignmentChange: jest.fn(),
  };

  beforeEach(() => {
    defaultProps.onOrderChange.mockClear();
    defaultProps.onAlignmentChange.mockClear();
  });

  it('renders section heading', () => {
    render(<ColumnSettingsSection {...defaultProps} />);
    expect(screen.getByText('Column formatting')).toBeInTheDocument();
  });

  it('renders all columns with drag handles and alignment dropdowns', () => {
    render(<ColumnSettingsSection {...defaultProps} />);
    expect(screen.getByText('name')).toBeInTheDocument();
    expect(screen.getByText('revenue')).toBeInTheDocument();
    expect(screen.getByText('region')).toBeInTheDocument();
    // Each column should have an alignment dropdown
    expect(screen.getByTestId('alignment-name')).toBeInTheDocument();
    expect(screen.getByTestId('alignment-revenue')).toBeInTheDocument();
    expect(screen.getByTestId('alignment-region')).toBeInTheDocument();
  });

  it('shows empty state when no columns', () => {
    render(<ColumnSettingsSection {...defaultProps} columns={[]} />);
    expect(screen.getByText(/No columns/)).toBeInTheDocument();
  });
});
