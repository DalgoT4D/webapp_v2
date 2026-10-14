import { fireEvent, render, screen } from '@testing-library/react';
import { KPIChartElement } from '../kpi-chart-element';
import { useKPIData } from '@/hooks/api/useKPIs';

jest.mock('@/hooks/api/useKPIs', () => ({ useKPIData: jest.fn() }));

jest.mock('@/components/kpis/kpi-card', () => ({
  KPICard: ({
    headerActions,
    toolbarActions,
  }: {
    headerActions?: React.ReactNode;
    toolbarActions?: React.ReactNode;
  }) => (
    <div>
      <div data-testid="header-actions">{headerActions}</div>
      <div data-testid="toolbar-actions">{toolbarActions}</div>
    </div>
  ),
}));

jest.mock('@/components/reports/comment-popover', () => ({
  CommentPopover: () => <button>Comments</button>,
}));

const mockUseKPIData = useKPIData as jest.MockedFunction<typeof useKPIData>;

describe('KPIChartElement navigation', () => {
  beforeEach(() => {
    mockUseKPIData.mockReturnValue({
      chartData: {
        current_value: 10,
        target_value: 20,
        direction: 'increase',
        rag_status: 'amber',
        time_grain: 'monthly',
        periods: [],
        data_last_date: null,
        customizations: null,
      },
      echartsConfig: {},
      isLoading: false,
      isError: undefined,
    });
  });

  it('places dashboard View in the hover toolbar', () => {
    const onView = jest.fn();
    render(<KPIChartElement kpiId={4} config={{ title: 'Reach' }} onView={onView} />);

    fireEvent.click(screen.getByRole('button', { name: 'View KPI' }));
    expect(onView).toHaveBeenCalled();
    expect(screen.getByTestId('toolbar-actions')).toContainElement(
      screen.getByRole('button', { name: 'View KPI' })
    );
  });

  it('keeps report View beside Comments and never exposes it publicly', () => {
    const onView = jest.fn();
    const { rerender } = render(
      <KPIChartElement kpiId={4} config={{ title: 'Reach' }} snapshotId={8} onView={onView} />
    );

    expect(screen.getByTestId('header-actions')).toContainElement(
      screen.getByRole('button', { name: 'View KPI' })
    );
    expect(screen.getByRole('button', { name: 'Comments' })).toBeInTheDocument();

    rerender(
      <KPIChartElement
        kpiId={4}
        config={{ title: 'Reach' }}
        snapshotId={8}
        isPublicMode
        onView={onView}
      />
    );
    expect(screen.queryByRole('button', { name: 'View KPI' })).not.toBeInTheDocument();
  });
});
