import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { KPICard } from '../kpi-card';
import type { KPICardData } from '../kpi-card';
import { ANALYTICS_EVENTS, KPI_EXPORT_SOURCES } from '@/constants/analytics';

const mockTrackEvent = jest.fn();
jest.mock('@/lib/analytics', () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

jest.mock('@/lib/toast', () => ({
  toastSuccess: { exported: jest.fn() },
  toastError: { api: jest.fn() },
}));

// The PNG path renders the card with html2canvas; the module is ESM-dynamic-imported.
const mockHtml2Canvas = jest.fn();
jest.mock('html2canvas-pro', () => ({ __esModule: true, default: () => mockHtml2Canvas() }));

// echarts is initialised on mount and irrelevant to the export events under test.
jest.mock('echarts', () => ({
  init: () => ({ setOption: jest.fn(), resize: jest.fn(), dispose: jest.fn() }),
}));

const data: KPICardData = {
  currentValue: 120,
  targetValue: 100,
  ragStatus: 'green',
  popChange: 0.1,
  direction: 'higher_is_better',
  timeGrain: 'monthly',
  echartsConfig: null,
  isLoading: false,
  periods: [{ period: 'Jan 2026', period_date: '2026-01-01', value: 120 }],
};

const renderCard = (props = {}) =>
  render(
    <KPICard
      name="Patients Reached"
      data={data}
      kpiId={7}
      exportSource={KPI_EXPORT_SOURCES.KPI_PAGE}
      {...props}
    />
  );

beforeEach(() => {
  jest.clearAllMocks();
  global.URL.createObjectURL = jest.fn(() => 'blob:csv');
  global.URL.revokeObjectURL = jest.fn();
});

describe('KPICard export analytics', () => {
  it('fires kpi_exported with format csv, the kpi id and the source', async () => {
    const user = userEvent.setup();
    renderCard();

    await user.click(screen.getByTitle('Download'));
    await user.click(await screen.findByText('Export Data as CSV'));

    await waitFor(() =>
      expect(mockTrackEvent).toHaveBeenCalledWith(ANALYTICS_EVENTS.KPI_EXPORTED, {
        kpi_id: 7,
        format: 'csv',
        source: KPI_EXPORT_SOURCES.KPI_PAGE,
      })
    );
  });

  // The CSV item is hidden entirely when there are no periods, so the handler's
  // no-data guard is defensive only — assert the affordance is absent instead.
  it('offers no CSV export when the KPI has no periods', async () => {
    const user = userEvent.setup();
    renderCard({ data: { ...data, periods: [] } });

    await user.click(screen.getByTitle('Download'));

    expect(await screen.findByText('Download as PNG')).toBeInTheDocument();
    expect(screen.queryByText('Export Data as CSV')).not.toBeInTheDocument();
    expect(mockTrackEvent).not.toHaveBeenCalled();
  });

  // html2canvas can throw; a failed render must not be counted as an export.
  it('does not fire kpi_exported when the PNG render fails', async () => {
    const user = userEvent.setup();
    mockHtml2Canvas.mockRejectedValue(new Error('canvas blew up'));
    renderCard();

    await user.click(screen.getByTitle('Download'));
    await user.click(await screen.findByText('Download as PNG'));

    await waitFor(() => expect(mockHtml2Canvas).toHaveBeenCalled());
    expect(mockTrackEvent).not.toHaveBeenCalled();
  });
});
