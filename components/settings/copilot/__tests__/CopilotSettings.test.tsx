import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CopilotSettings from '../CopilotSettings';

// ============ Mocks ============

const mutateMock = jest.fn();
let swrData: any;

jest.mock('swr', () => ({
  __esModule: true,
  default: () => ({ data: swrData, isLoading: false }),
  useSWRConfig: () => ({ mutate: mutateMock }),
}));

jest.mock('@/lib/api', () => ({
  apiGet: jest.fn(),
  apiPut: jest.fn(),
}));
import { apiPut } from '@/lib/api';

jest.mock('@/lib/toast', () => ({
  toastSuccess: { saved: jest.fn() },
  toastError: { save: jest.fn() },
}));

// ============ Helpers ============

function setSettings(overrides: Partial<Record<string, any>> = {}) {
  swrData = {
    success: true,
    data: {
      enabled: false,
      text: '',
      updated_at: null,
      updated_by_email: null,
      max_chars: 5000,
      ...overrides,
    },
  };
}

const renderPage = () => render(<CopilotSettings />);

// ============ Tests ============

describe('CopilotSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (apiPut as jest.Mock).mockResolvedValue({ success: true });
    setSettings();
  });

  it('toggle PUTs {enabled} and refreshes the sidebar flags', async () => {
    renderPage();
    await userEvent.click(screen.getByTestId('copilot-enable-switch'));
    await waitFor(() =>
      expect(apiPut).toHaveBeenCalledWith('/api/chat-with-data/settings', { enabled: true })
    );
    // the sidebar's Copilot entry reads this SWR key — must revalidate without a reload
    expect(mutateMock).toHaveBeenCalledWith('/api/organizations/flags');
  });

  it('context section is disabled until Copilot is enabled', () => {
    renderPage();
    expect(screen.getByTestId('copilot-context-textarea')).toBeDisabled();
    setSettings({ enabled: true });
    renderPage();
    expect(screen.getAllByTestId('copilot-context-textarea')[1]).not.toBeDisabled();
  });

  it('char counter tracks the draft against max_chars from the API', async () => {
    setSettings({ enabled: true, max_chars: 50 });
    renderPage();
    expect(screen.getByTestId('copilot-char-counter')).toHaveTextContent('0/50');
    await userEvent.type(screen.getByTestId('copilot-context-textarea'), 'SHG means self-help');
    expect(screen.getByTestId('copilot-char-counter')).toHaveTextContent('19/50');
  });

  it('save PUTs the trimmed text', async () => {
    setSettings({ enabled: true });
    renderPage();
    await userEvent.type(screen.getByTestId('copilot-context-textarea'), '  fiscal year Apr-Mar ');
    await userEvent.click(screen.getByTestId('copilot-save-btn'));
    await waitFor(() =>
      expect(apiPut).toHaveBeenCalledWith('/api/chat-with-data/settings', {
        text: 'fiscal year Apr-Mar',
      })
    );
  });

  it('save is disabled when nothing changed or the cap is exceeded', async () => {
    setSettings({ enabled: true, text: 'existing', max_chars: 10 });
    renderPage();
    expect(screen.getByTestId('copilot-save-btn')).toBeDisabled();
    const textarea = screen.getByTestId('copilot-context-textarea');
    await userEvent.clear(textarea);
    await userEvent.type(textarea, 'way past the ten char cap');
    expect(screen.getByTestId('copilot-save-btn')).toBeDisabled();
  });

  it('PII warning is always rendered, even while disabled', () => {
    renderPage();
    expect(screen.getByTestId('copilot-pii-warning')).toHaveTextContent(
      /never paste beneficiary names/i
    );
  });

  it('shows who last updated the context', () => {
    setSettings({
      enabled: true,
      text: 'x',
      updated_at: '2026-09-08T10:00:00Z',
      updated_by_email: 'sarah@ngo.org',
    });
    renderPage();
    expect(screen.getByText(/Last updated by sarah@ngo.org/)).toBeInTheDocument();
  });
});
