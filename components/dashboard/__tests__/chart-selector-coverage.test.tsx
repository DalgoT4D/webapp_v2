/**
 * Embed-time coverage warning in ChartSelectorModal: picking a chart
 * pre-flights the coverage endpoint — covered embeds silently, a gap raises
 * EmbedCoverageDialog, and the decision drives onSelect.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ChartSelectorModal } from '@/components/dashboard/chart-selector-modal';
import { mockApiGet } from '@/test-utils/api';
import type { ChartCoverageVerdict } from '@/hooks/api/useResourceAccess';

jest.mock('@/hooks/api/useCharts', () => ({
  useCharts: jest.fn(() => ({
    data: [
      { id: 11, title: 'Attendance by District', chart_type: 'bar' },
      { id: 12, title: 'Salary Breakdown', chart_type: 'pie' },
    ],
    isLoading: false,
  })),
}));

const mockCreateAccessRequest = jest.fn();
jest.mock('@/hooks/api/useAccessRequests', () => ({
  ...jest.requireActual('@/hooks/api/useAccessRequests'),
  createAccessRequest: (...args: unknown[]) => mockCreateAccessRequest(...args),
}));

jest.mock('@/components/charts/StaticChartPreview', () => ({
  StaticChartPreview: () => <div data-testid="chart-preview" />,
}));

function verdict(overrides: Partial<ChartCoverageVerdict>): ChartCoverageVerdict {
  return {
    chart_id: 11,
    title: 'Attendance by District',
    covered: false,
    role_gaps: [],
    principal_gaps: [],
    public_exposure: false,
    extendable: false,
    viewer_can_edit: false,
    ...overrides,
  };
}

function coverageResponse(charts: ChartCoverageVerdict[]) {
  return { dashboard_id: 5, covered: charts.every((c) => c.covered), charts };
}

const baseProps = {
  open: true,
  onClose: jest.fn(),
  dashboardId: 5,
  dashboardTitle: 'Field Operations Dashboard',
};

describe('ChartSelectorModal embed coverage', () => {
  beforeEach(() => jest.clearAllMocks());

  it('covered → embeds silently (no dialog), coverage endpoint called with chart_id', async () => {
    mockApiGet.mockResolvedValue(coverageResponse([verdict({ covered: true })]));
    const onSelect = jest.fn();
    render(<ChartSelectorModal {...baseProps} onSelect={onSelect} />);

    fireEvent.click(screen.getByText('Attendance by District'));

    await waitFor(() => expect(onSelect).toHaveBeenCalledWith(11, undefined));
    expect(mockApiGet).toHaveBeenCalledWith('/api/dashboards/5/chart-coverage/?chart_id=11');
    expect(screen.queryByTestId('embed-coverage-dialog')).not.toBeInTheDocument();
  });

  it('gap + edit: warning names who gains visibility; YES embeds with the extend decision', async () => {
    mockApiGet.mockResolvedValue(
      coverageResponse([
        verdict({
          principal_gaps: [
            {
              principal_type: 'group',
              principal_id: 8,
              name: 'Field Staff',
              email: null,
              skipped_member: false,
            },
          ],
          extendable: true,
          viewer_can_edit: true,
        }),
      ])
    );
    const onSelect = jest.fn();
    render(<ChartSelectorModal {...baseProps} onSelect={onSelect} />);

    fireEvent.click(screen.getByText('Attendance by District'));

    await waitFor(() => expect(screen.getByTestId('embed-coverage-dialog')).toBeInTheDocument());
    expect(screen.getByTestId('embed-coverage-body')).toHaveTextContent('Field Staff group');
    expect(onSelect).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('embed-coverage-yes'));
    expect(onSelect).toHaveBeenCalledWith(11, { extendChartIds: [11], proceed: true });
  });

  it('gap + view-only: request-Edit prompt; requesting files a chart Edit access request, never embeds', async () => {
    mockApiGet.mockResolvedValue(
      coverageResponse([verdict({ extendable: true, viewer_can_edit: false })])
    );
    mockCreateAccessRequest.mockResolvedValue({ id: 1 });
    const onSelect = jest.fn();
    render(<ChartSelectorModal {...baseProps} onSelect={onSelect} />);

    fireEvent.click(screen.getByText('Attendance by District'));

    await waitFor(() =>
      expect(screen.getByTestId('embed-coverage-request-edit')).toBeInTheDocument()
    );
    fireEvent.click(screen.getByTestId('embed-coverage-request-edit'));

    await waitFor(() =>
      expect(mockCreateAccessRequest).toHaveBeenCalledWith('chart', 11, {
        requested_permission: 'edit',
      })
    );
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('cancel aborts the pick — no embed, dialog closes', async () => {
    mockApiGet.mockResolvedValue(
      coverageResponse([verdict({ extendable: true, viewer_can_edit: true })])
    );
    const onSelect = jest.fn();
    render(<ChartSelectorModal {...baseProps} onSelect={onSelect} />);

    fireEvent.click(screen.getByText('Attendance by District'));
    await waitFor(() => expect(screen.getByTestId('embed-coverage-dialog')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('embed-coverage-cancel'));
    await waitFor(() =>
      expect(screen.queryByTestId('embed-coverage-dialog')).not.toBeInTheDocument()
    );
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('without a dashboardId (new dashboard), embeds without a coverage call', async () => {
    const onSelect = jest.fn();
    render(
      <ChartSelectorModal
        open
        onClose={jest.fn()}
        onSelect={onSelect}
        dashboardTitle="New Dashboard"
      />
    );

    fireEvent.click(screen.getByText('Attendance by District'));
    await waitFor(() => expect(onSelect).toHaveBeenCalledWith(11, undefined));
    expect(mockApiGet).not.toHaveBeenCalled();
  });

  it('coverage endpoint failure fails open (embed proceeds; the server re-validates at save)', async () => {
    mockApiGet.mockRejectedValue(Object.assign(new Error('boom'), { status: 500 }));
    const onSelect = jest.fn();
    render(<ChartSelectorModal {...baseProps} onSelect={onSelect} />);

    fireEvent.click(screen.getByText('Attendance by District'));
    await waitFor(() => expect(onSelect).toHaveBeenCalledWith(11, undefined));
  });
});
