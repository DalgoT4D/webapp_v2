import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NewChartPage from '../page';
import { useInsightWalkthroughStore } from '@/stores/insightWalkthroughStore';
import { InsightWalkthroughCoachmark } from '@/components/onboarding/insight-walkthrough-coachmark';

const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => window.location.pathname,
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
    window.history.replaceState({}, '', '/charts/new');
    useInsightWalkthroughStore.setState({
      active: true,
      orgSlug: 'trial-org',
      flow: 'insights',
      path: 'own_data',
      stage: 'chart_pick_table',
      reviewReturnStage: null,
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

  it('retains the dataset and chart type when reviewing earlier hints', async () => {
    const user = userEvent.setup();
    render(
      <>
        <NewChartPage />
        <InsightWalkthroughCoachmark />
      </>
    );
    await user.click(screen.getByRole('button', { name: 'Choose survey responses' }));
    await user.click(screen.getByRole('radio', { name: 'Bar Chart' }));
    await user.click(
      await within(document.querySelector('.driver-popover') as HTMLElement).findByRole('button', {
        name: 'Back',
      })
    );
    await user.click(
      await within(document.querySelector('.driver-popover') as HTMLElement).findByRole('button', {
        name: 'Back',
      })
    );
    expect(useInsightWalkthroughStore.getState().stage).toBe('chart_pick_table');
    await user.click(await screen.findByRole('button', { name: 'Next' }));
    await user.click(await screen.findByRole('button', { name: 'Next' }));
    expect(screen.getByRole('radio', { name: 'Bar Chart' })).toHaveAttribute(
      'aria-checked',
      'true'
    );
    expect(mockPush).not.toHaveBeenCalled();
    await user.click(screen.getByTestId('chart-type-continue-button'));
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush.mock.calls[0][0]).toContain('staging');
    expect(mockPush.mock.calls[0][0]).toContain('survey_responses');
    expect(mockPush.mock.calls[0][0]).toContain('bar');
  });
});
