import { render, screen } from '@testing-library/react';
import { ColumnOrderSection } from '../ColumnOrderSection';

// Mock @dnd-kit
jest.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: any) => <div>{children}</div>,
  closestCenter: jest.fn(),
  KeyboardSensor: jest.fn(),
  PointerSensor: jest.fn(),
  useSensor: jest.fn(),
  useSensors: jest.fn(() => []),
}));

jest.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: any) => <div>{children}</div>,
  verticalListSortingStrategy: jest.fn(),
  useSortable: jest.fn(() => ({
    attributes: {},
    listeners: {},
    setNodeRef: jest.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  })),
  arrayMove: jest.fn((arr: any[], from: number, to: number) => {
    const newArr = [...arr];
    const [removed] = newArr.splice(from, 1);
    newArr.splice(to, 0, removed);
    return newArr;
  }),
}));

jest.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: () => '' } },
}));

describe('ColumnOrderSection', () => {
  const defaultProps = {
    columns: ['name', 'revenue', 'region'],
    onChange: jest.fn(),
  };

  beforeEach(() => {
    defaultProps.onChange.mockClear();
  });

  it('renders section heading', () => {
    render(<ColumnOrderSection {...defaultProps} />);
    expect(screen.getByText('Column Order')).toBeInTheDocument();
  });

  it('renders all columns as draggable items', () => {
    render(<ColumnOrderSection {...defaultProps} />);
    expect(screen.getByText('name')).toBeInTheDocument();
    expect(screen.getByText('revenue')).toBeInTheDocument();
    expect(screen.getByText('region')).toBeInTheDocument();
  });

  it('shows empty state when no columns', () => {
    render(<ColumnOrderSection {...defaultProps} columns={[]} />);
    expect(screen.getByText(/No columns/)).toBeInTheDocument();
  });
});
