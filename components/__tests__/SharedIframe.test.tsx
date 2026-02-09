import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import SharedIframe from '../shared-iframe';

const mockSendAuthUpdate = jest.fn();
const mockSendLogout = jest.fn();

jest.mock('@/hooks/useIframeComm', () => ({
  useIframeCommunication: () => ({
    sendAuthUpdate: mockSendAuthUpdate,
    sendOrgSwitch: jest.fn(),
    sendLogout: mockSendLogout,
    sendMessage: jest.fn(),
    requestAuthState: jest.fn(),
  }),
}));

jest.mock('@/lib/api', () => ({
  apiPost: jest.fn(),
}));

let mockAuthState = {
  selectedOrgSlug: 'test-org' as string | null,
  isAuthenticated: true,
};

jest.mock('@/stores/authStore', () => ({
  useAuthStore: () => mockAuthState,
}));

import { apiPost } from '@/lib/api';

function simulateIframeReady(iframe: HTMLIFrameElement) {
  act(() => {
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { source: 'webapp', type: 'READY' },
        origin: 'https://embedded.example.com',
        source: iframe.contentWindow,
      })
    );
  });
}

describe('SharedIframe', () => {
  const defaultProps = {
    src: 'https://embedded.example.com/pipeline/ingest?embedToken=old&embedOrg=old',
    title: 'Test Iframe',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockAuthState = { selectedOrgSlug: 'test-org', isAuthenticated: true };
    (apiPost as jest.Mock).mockResolvedValue({
      success: true,
      iframe_token: 'test-token-123',
      expires_in: 300,
    });
    process.env.NEXT_PUBLIC_EMBEDDED_WEBAPP_URL = 'https://embedded.example.com';
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('fetches token and sends auth after iframe READY', async () => {
    render(<SharedIframe {...defaultProps} />);
    const iframe = screen.getByTitle('Test Iframe') as HTMLIFrameElement;
    simulateIframeReady(iframe);

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith('/api/v2/iframe-token/', {});
      expect(mockSendAuthUpdate).toHaveBeenCalledWith('test-token-123', 'test-org');
    });
  });

  it('rejects messages from untrusted origins', () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
    render(<SharedIframe {...defaultProps} />);

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { source: 'webapp', type: 'READY' },
          origin: 'https://evil.example.com',
        })
      );
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[Parent] Received message from untrusted origin'),
      expect.any(String),
      expect.any(String),
      expect.any(Array)
    );
    consoleSpy.mockRestore();
  });

  it('sends logout when user is not authenticated', async () => {
    mockAuthState = { selectedOrgSlug: null, isAuthenticated: false };
    render(<SharedIframe {...defaultProps} />);
    const iframe = screen.getByTitle('Test Iframe') as HTMLIFrameElement;
    simulateIframeReady(iframe);

    await waitFor(() => {
      expect(mockSendLogout).toHaveBeenCalled();
    });
  });

  it('strips embed query params from src URL', () => {
    render(<SharedIframe {...defaultProps} />);
    const iframe = screen.getByTitle('Test Iframe') as HTMLIFrameElement;
    expect(iframe.src).toContain('/pipeline/ingest');
    expect(iframe.src).not.toContain('embedToken');
    expect(iframe.src).not.toContain('embedOrg');
  });
});
