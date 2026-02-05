import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import SharedIframe from '../shared-iframe';

// Mock dependencies
const mockSendAuthUpdate = jest.fn();
const mockSendOrgSwitch = jest.fn();
const mockSendLogout = jest.fn();

jest.mock('@/hooks/useIframeComm', () => ({
  useIframeCommunication: () => ({
    sendAuthUpdate: mockSendAuthUpdate,
    sendOrgSwitch: mockSendOrgSwitch,
    sendLogout: mockSendLogout,
    sendMessage: jest.fn(),
    requestAuthState: jest.fn(),
  }),
}));

jest.mock('@/lib/api', () => ({
  apiPost: jest.fn(),
}));

let mockAuthState = {
  selectedOrgSlug: 'test-org',
  isAuthenticated: true,
};

jest.mock('@/stores/authStore', () => ({
  useAuthStore: () => mockAuthState,
}));

import * as apiModule from '@/lib/api';
const { apiPost } = apiModule;

// Helper: simulate iframe sending READY message
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

  describe('Rendering', () => {
    it('renders iframe with correct src, title, default class, and strips embed params', () => {
      render(<SharedIframe {...defaultProps} />);
      const iframe = screen.getByTitle('Test Iframe') as HTMLIFrameElement;
      expect(iframe.tagName).toBe('IFRAME');
      expect(iframe.src).toContain('https://embedded.example.com/pipeline/ingest');
      expect(iframe.src).not.toContain('embedToken');
      expect(iframe.src).not.toContain('embedOrg');
      expect(iframe).toHaveClass('w-full', 'h-full', 'border-0', 'block');
    });

    it('applies custom className and scale transform', () => {
      const { container } = render(
        <SharedIframe {...defaultProps} className="custom-class" scale={0.75} />
      );
      const iframe = screen.getByTitle('Test Iframe');
      expect(iframe).toHaveClass('custom-class');
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.style.transform).toBe('scale(0.75)');
    });
  });

  describe('Origin Validation', () => {
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
  });

  describe('Auth Flow', () => {
    it('fetches token and sends AUTH_UPDATE after iframe READY', async () => {
      render(<SharedIframe {...defaultProps} />);
      const iframe = screen.getByTitle('Test Iframe') as HTMLIFrameElement;
      simulateIframeReady(iframe);

      await waitFor(() => {
        expect(apiPost).toHaveBeenCalledWith('/api/v2/iframe-token/', {});
        expect(mockSendAuthUpdate).toHaveBeenCalledWith('test-token-123', 'test-org');
      });
    });

    it('does not send auth when iframe has not sent READY', async () => {
      render(<SharedIframe {...defaultProps} />);

      await act(async () => {
        jest.advanceTimersByTime(500);
      });

      expect(mockSendAuthUpdate).not.toHaveBeenCalled();
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

    it('does not send auth when token fetch fails', async () => {
      (apiPost as jest.Mock).mockResolvedValue({ success: false });
      render(<SharedIframe {...defaultProps} />);
      const iframe = screen.getByTitle('Test Iframe') as HTMLIFrameElement;
      simulateIframeReady(iframe);

      await act(async () => {
        jest.advanceTimersByTime(500);
      });

      expect(mockSendAuthUpdate).not.toHaveBeenCalled();
    });
  });

  describe('First Load Remount Fix', () => {
    it('remounts iframe after first auth by changing key after 150ms', async () => {
      render(<SharedIframe {...defaultProps} />);
      const iframe = screen.getByTitle('Test Iframe') as HTMLIFrameElement;
      const initialSrc = iframe.src;
      simulateIframeReady(iframe);

      await waitFor(() => {
        expect(mockSendAuthUpdate).toHaveBeenCalledTimes(1);
      });

      act(() => {
        jest.advanceTimersByTime(150);
      });

      const newIframe = screen.getByTitle('Test Iframe') as HTMLIFrameElement;
      expect(newIframe.src).toBe(initialSrc);
    });

    it('only schedules remount once', async () => {
      const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
      render(<SharedIframe {...defaultProps} />);
      const iframe = screen.getByTitle('Test Iframe') as HTMLIFrameElement;
      simulateIframeReady(iframe);

      await waitFor(() => {
        expect(mockSendAuthUpdate).toHaveBeenCalledTimes(1);
      });

      const remountTimeouts = setTimeoutSpy.mock.calls.filter((call) => call[1] === 150);
      expect(remountTimeouts).toHaveLength(1);

      act(() => {
        jest.advanceTimersByTime(150);
      });

      const remountedIframe = screen.getByTitle('Test Iframe') as HTMLIFrameElement;
      expect(remountedIframe).toBeInTheDocument();

      setTimeoutSpy.mockRestore();
    });
  });

  describe('Org Switch', () => {
    it('sends org switch when iframe is ready', async () => {
      render(<SharedIframe {...defaultProps} />);
      const iframe = screen.getByTitle('Test Iframe') as HTMLIFrameElement;
      simulateIframeReady(iframe);

      await waitFor(() => {
        expect(mockSendOrgSwitch).toHaveBeenCalledWith('test-org');
      });
    });
  });

  describe('Token Refresh', () => {
    it('refreshes token every 4 minutes when authenticated and iframe is ready', async () => {
      render(<SharedIframe {...defaultProps} />);
      const iframe = screen.getByTitle('Test Iframe') as HTMLIFrameElement;
      simulateIframeReady(iframe);

      // Wait for initial auth
      await waitFor(() => {
        expect(mockSendAuthUpdate).toHaveBeenCalledTimes(1);
      });

      // Clear to track refresh calls
      mockSendAuthUpdate.mockClear();
      (apiPost as jest.Mock).mockClear();
      (apiPost as jest.Mock).mockResolvedValue({
        success: true,
        iframe_token: 'refreshed-token',
        expires_in: 300,
      });

      // Advance 4 minutes to trigger refresh
      await act(async () => {
        jest.advanceTimersByTime(4 * 60 * 1000);
      });

      await waitFor(() => {
        expect(apiPost).toHaveBeenCalledWith('/api/v2/iframe-token/', {});
        expect(mockSendAuthUpdate).toHaveBeenCalledWith('refreshed-token', 'test-org');
      });
    });
  });
});
