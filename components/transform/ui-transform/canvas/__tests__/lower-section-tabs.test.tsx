/**
 * LowerSectionTabs Tests
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LowerSectionTabs, type LowerSectionTabsProps } from '../layout/LowerSectionTabs';
import { FeatureFlagKeys } from '@/hooks/api/useFeatureFlags';

// ============ Mocks ============

jest.mock('@/hooks/api/useFeatureFlags', () => ({
  useFeatureFlags: jest.fn(),
  FeatureFlagKeys: { DATA_STATISTICS: 'data_statistics' },
}));

const mockSetSelectedTab = jest.fn();
let mockSelectedTab = 'preview';

jest.mock('@/stores/transformStore', () => ({
  useTransformStore: (
    selector: (s: { selectedLowerTab: string; setSelectedLowerTab: jest.Mock }) => unknown
  ) =>
    selector({
      selectedLowerTab: mockSelectedTab,
      setSelectedLowerTab: mockSetSelectedTab,
    }),
}));

jest.mock('@/components/explore/PreviewPane', () => ({
  PreviewPane: () => <div data-testid="preview-pane" />,
}));

jest.mock('@/components/explore/LogsPane', () => ({
  LogsPane: () => <div data-testid="logs-pane" />,
}));

jest.mock('@/components/explore/StatisticsPane', () => ({
  StatisticsPane: () => <div data-testid="statistics-pane" />,
}));

// ============ LowerSectionTabs Tests ============

const defaultProps: LowerSectionTabsProps = {
  height: 300,
  isFullScreen: false,
  isMinimized: false,
  onToggleFullScreen: jest.fn(),
  onToggleMinimize: jest.fn(),
  dbtRunLogs: [],
  isLogsLoading: false,
  previewTable: null,
};

describe('LowerSectionTabs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSelectedTab = 'preview';

    const { useFeatureFlags } = jest.requireMock('@/hooks/api/useFeatureFlags');
    (useFeatureFlags as jest.Mock).mockReturnValue({
      isFeatureFlagEnabled: () => false,
    });
  });

  it('hides tab content when minimized', () => {
    render(<LowerSectionTabs {...defaultProps} isMinimized={true} />);
    expect(screen.queryByTestId('preview-pane')).not.toBeInTheDocument();
    expect(screen.queryByTestId('logs-pane')).not.toBeInTheDocument();
  });

  it('shows Data Statistics tab only when feature flag is enabled', () => {
    const { rerender } = render(<LowerSectionTabs {...defaultProps} />);
    expect(screen.queryByTestId('data statistics-tab')).not.toBeInTheDocument();

    const { useFeatureFlags } = jest.requireMock('@/hooks/api/useFeatureFlags');
    (useFeatureFlags as jest.Mock).mockReturnValue({
      isFeatureFlagEnabled: (flag: string) => flag === FeatureFlagKeys.DATA_STATISTICS,
    });

    rerender(<LowerSectionTabs {...defaultProps} />);
    expect(screen.getByTestId('data statistics-tab')).toBeInTheDocument();
  });

  it('auto-switches to preview tab when previewTable becomes available', async () => {
    render(
      <LowerSectionTabs {...defaultProps} previewTable={{ schema: 'public', table: 'orders' }} />
    );

    await waitFor(() => {
      expect(mockSetSelectedTab).toHaveBeenCalledWith('preview');
    });
  });

  it('auto-switches to logs tab when loading starts with no existing logs', async () => {
    render(<LowerSectionTabs {...defaultProps} isLogsLoading={true} dbtRunLogs={[]} />);

    await waitFor(() => {
      expect(mockSetSelectedTab).toHaveBeenCalledWith('logs');
    });
  });

  it('calls onToggleMinimize when minimize button is clicked', async () => {
    const user = userEvent.setup();
    const onToggleMinimize = jest.fn();
    render(<LowerSectionTabs {...defaultProps} onToggleMinimize={onToggleMinimize} />);

    await user.click(screen.getByTestId('minimize-toggle'));
    expect(onToggleMinimize).toHaveBeenCalledTimes(1);
  });

  it('calls onToggleFullScreen when fullscreen button is clicked', async () => {
    const user = userEvent.setup();
    const onToggleFullScreen = jest.fn();
    render(<LowerSectionTabs {...defaultProps} onToggleFullScreen={onToggleFullScreen} />);

    await user.click(screen.getByTestId('fullscreen-toggle'));
    expect(onToggleFullScreen).toHaveBeenCalledTimes(1);
  });
});
