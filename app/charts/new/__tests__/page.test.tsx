import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NewChartPage from '../page';
import { useInsightWalkthroughStore } from '@/stores/insightWalkthroughStore';

const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock('@/lib/rbac', () => ({
  PERMISSIONS: { CAN_CREATE_CHARTS: 'can_create_charts' },
  useRbac: () => ({ hasPermission: () => true }),
}));

jest.mock('@/components/charts/DatasetSelector', () => ({
  DatasetSelector: ({
    onDatasetChange,
  }: {
    onDatasetChange: (schema: string, table: string) => void;
  }) => (
    <button type="button" onClick={() => onDatasetChange('staging', 'survey_responses')}>
      Choose survey responses
    </button>
  ),
}));

describe('new chart walkthrough', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useInsightWalkthroughStore.setState({
      active: true,
      orgSlug: 'trial-org',
      flow: 'insights',
      path: 'own_data',
      stage: 'chart_pick_table',
    });
  });

  afterEach(() => {
    useInsightWalkthroughStore.setState({
      active: false,
      orgSlug: null,
      flow: null,
      path: null,
      stage: null,
    });
  });

  it('moves the guide from chart type selection to the Continue button', async () => {
    const user = userEvent.setup();
    render(<NewChartPage />);

    await user.click(screen.getByRole('button', { name: 'Choose survey responses' }));
    expect(useInsightWalkthroughStore.getState().stage).toBe('chart_pick_type');

    await user.click(screen.getByRole('radio', { name: 'Bar Chart' }));

    expect(useInsightWalkthroughStore.getState().stage).toBe('chart_continue');
    expect(screen.getByTestId('chart-type-continue-button')).toBeEnabled();
  });
});
