import { fireEvent, render, screen } from '@testing-library/react';
import {
  DashboardBuilderHeader,
  type BuilderHeaderProps,
} from '@/components/dashboard/builder/DashboardBuilderHeader';

function setup(over: Partial<BuilderHeaderProps> = {}) {
  const props: BuilderHeaderProps = {
    title: 'Sales',
    isEditingTitle: false,
    onTitleChange: jest.fn(),
    onTitleEditStart: jest.fn(),
    onTitleCommit: jest.fn(),
    description: '',
    onDescriptionChange: jest.fn(),
    onDescriptionSave: jest.fn(),
    onBack: jest.fn(),
    onPreview: jest.fn(),
    isNavigating: false,
    onAddChart: jest.fn(),
    onAddChartCompact: jest.fn(),
    onAddKpi: jest.fn(),
    onAddText: jest.fn(),
    onUndo: jest.fn(),
    onRedo: jest.fn(),
    canUndo: true,
    canRedo: false,
    saveStatus: 'idle',
    saveError: null,
    onSave: jest.fn(),
    ...over,
  };
  render(<DashboardBuilderHeader {...props} />);
  return props;
}

describe('DashboardBuilderHeader', () => {
  it('renders both variants with their own testids', () => {
    setup();
    expect(screen.getByTestId('dashboard-title-display-mobile')).toHaveTextContent('Sales');
    expect(screen.getByTestId('dashboard-title-display')).toHaveTextContent('Sales');
    expect(screen.getAllByTestId('dashboard-back-btn')).toHaveLength(2);
    expect(screen.getByTestId('view-dashboard-mobile-btn')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-preview-btn')).toHaveTextContent('View');
    expect(screen.getByTestId('dashboard-builder-redo-btn')).toBeDisabled();
    expect(screen.getByTestId('dashboard-builder-undo-btn-mobile')).toBeEnabled();
  });

  it('only the full header has Save; the two add-chart buttons call different handlers', () => {
    const props = setup();
    expect(screen.getAllByTestId('dashboard-save-btn')).toHaveLength(1);
    fireEvent.click(screen.getByTestId('add-chart-btn'));
    fireEvent.click(screen.getByTestId('dashboard-builder-add-chart-btn-mobile'));
    expect(props.onAddChart).toHaveBeenCalledTimes(1);
    expect(props.onAddChartCompact).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId('dashboard-save-btn'));
    expect(props.onSave).toHaveBeenCalledTimes(1);
  });

  it('title input: Enter and blur both commit', () => {
    const props = setup({ isEditingTitle: true });
    // Both inputs have autoFocus and jsdom ignores the CSS that hides one, so on mount the full
    // input takes focus from the compact one and blurs it (one commit). Not the behavior under test.
    expect(props.onTitleCommit).toHaveBeenCalledTimes(1);
    (props.onTitleCommit as jest.Mock).mockClear();
    fireEvent.keyDown(screen.getByTestId('dashboard-title-input'), { key: 'Enter' });
    fireEvent.blur(screen.getByTestId('dashboard-title-input-mobile'));
    expect(props.onTitleCommit).toHaveBeenCalledTimes(2);
  });

  it('save status: compact says "Error", full shows the message', () => {
    setup({ saveStatus: 'error', saveError: 'Network down' });
    expect(screen.getByTestId('dashboard-save-status-error-mobile')).toHaveTextContent('Error');
    expect(screen.getByTestId('dashboard-save-status-error')).toHaveTextContent('Network down');
  });

  it('navigating: both View buttons disabled, full label changes', () => {
    setup({ isNavigating: true });
    expect(screen.getByTestId('view-dashboard-mobile-btn')).toBeDisabled();
    expect(screen.getByTestId('dashboard-preview-btn')).toHaveTextContent(
      'Saving and opening view...'
    );
  });
});
