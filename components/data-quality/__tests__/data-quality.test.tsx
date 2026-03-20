import { render, screen, waitFor } from '@testing-library/react';
import { TestWrapper } from '@/test-utils/render';
import { mockApiGet } from '@/test-utils/api';
import { DataQuality } from '../data-quality';
import { createMockSetupStatusResponse } from './data-quality-mock-data';

// Mock child components to isolate orchestrator logic
jest.mock('../elementary-report', () => ({
  ElementaryReport: () => <div data-testid="elementary-report">Report</div>,
}));
jest.mock('../elementary-setup', () => ({
  ElementarySetup: ({ onSetupComplete }: any) => (
    <div data-testid="elementary-setup">
      <button onClick={onSetupComplete}>Complete</button>
    </div>
  ),
}));
jest.mock('../dbt-not-configured', () => ({
  DbtNotConfigured: ({ message }: any) => <div data-testid="dbt-not-configured">{message}</div>,
}));

describe('DataQuality orchestrator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows loader while fetching status', () => {
    mockApiGet.mockReturnValue(new Promise(() => {})); // never resolves
    render(<DataQuality />, { wrapper: TestWrapper });
    expect(screen.getByTestId('data-quality-loader')).toBeInTheDocument();
  });

  it('renders ElementaryReport when status is set-up', async () => {
    mockApiGet.mockResolvedValue(createMockSetupStatusResponse('set-up'));
    render(<DataQuality />, { wrapper: TestWrapper });
    await waitFor(() => {
      expect(screen.getByTestId('elementary-report')).toBeInTheDocument();
    });
  });

  it('renders ElementarySetup when status is not-set-up', async () => {
    mockApiGet.mockResolvedValue(createMockSetupStatusResponse('not-set-up'));
    render(<DataQuality />, { wrapper: TestWrapper });
    await waitFor(() => {
      expect(screen.getByTestId('elementary-setup')).toBeInTheDocument();
    });
  });

  it('renders DbtNotConfigured when API returns dbt error', async () => {
    mockApiGet.mockRejectedValue(new Error('dbt is not configured for this client'));
    render(<DataQuality />, { wrapper: TestWrapper });
    await waitFor(() => {
      expect(screen.getByTestId('dbt-not-configured')).toBeInTheDocument();
      expect(screen.getByText('dbt is not configured for this client')).toBeInTheDocument();
    });
  });
});
