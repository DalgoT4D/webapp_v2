import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import Ingest from '../ingest';

// Mock SharedIframe's dependencies — NOT SharedIframe itself
const mockSendAuthUpdate = jest.fn();

jest.mock('@/hooks/useIframeComm', () => ({
  useIframeCommunication: () => ({
    sendAuthUpdate: mockSendAuthUpdate,
    sendOrgSwitch: jest.fn(),
    sendLogout: jest.fn(),
    sendMessage: jest.fn(),
    requestAuthState: jest.fn(),
  }),
}));

jest.mock('@/lib/api', () => ({
  apiPost: jest.fn().mockResolvedValue({
    success: true,
    iframe_token: 'test-token',
    expires_in: 300,
  }),
}));

jest.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    selectedOrgSlug: 'test-org',
    isAuthenticated: true,
  }),
}));

jest.mock('@/constants/constants', () => ({
  embeddedAppUrl: 'https://embedded.example.com',
}));

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

describe('Ingest page redirect fix', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    process.env.NEXT_PUBLIC_EMBEDDED_WEBAPP_URL = 'https://embedded.example.com';
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('remounts iframe with ingest URL after first auth so embedded app loads the correct page', async () => {
    render(<Ingest />);

    const iframe = screen.getByTitle('Data Ingestion Pipeline') as HTMLIFrameElement;
    expect(iframe.src).toContain('/pipeline/ingest');

    // Iframe signals it is ready
    simulateIframeReady(iframe);

    // Auth token is sent to the iframe before the remount
    await waitFor(() => {
      expect(mockSendAuthUpdate).toHaveBeenCalledWith('test-token', 'test-org');
    });

    // The 150ms remount fires — iframe is recreated with a new key
    act(() => {
      jest.advanceTimersByTime(150);
    });

    // The iframe must be a NEW element (remounted), not the same one
    const remountedIframe = screen.getByTitle('Data Ingestion Pipeline') as HTMLIFrameElement;
    expect(remountedIframe).not.toBe(iframe);

    // And it must still point to ingest, not pipeline overview
    expect(remountedIframe.src).toContain('/pipeline/ingest');
  });
});
