import { render, screen } from '@testing-library/react';
import { ColumnSettingsSection } from '../ColumnSettingsSection';

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

describe('ColumnSettingsSection', () => {
  const defaultProps = {
    columns: ['name', 'revenue', 'region'],
    alignment: {} as Record<string, string>,
    onOrderChange: jest.fn(),
    onAlignmentChange: jest.fn(),
  };

  beforeEach(() => {
    defaultProps.onOrderChange.mockClear();
    defaultProps.onAlignmentChange.mockClear();
  });

  it('renders section heading', () => {
    render(<ColumnSettingsSection {...defaultProps} />);
    expect(screen.getByText('Columns')).toBeInTheDocument();
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
