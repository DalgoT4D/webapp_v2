/**
 * Tests for the useSourceSave hook — shared source-create logic (WS check_connection
 * → createSource, and the Google OAuth connect flow) used by SourceForm and (later)
 * the source wizard's step 2.
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useSourceSave } from '../useSourceSave';
import { createSource } from '@/hooks/api/useSources';

jest.mock('@/hooks/api/useSources', () => ({
  createSource: jest.fn().mockResolvedValue({ sourceId: 'src-1' }),
  getSourceOAuthConsent: jest.fn().mockResolvedValue({ consentUrl: 'https://c', state: 'st' }),
  completeSourceOAuth: jest.fn().mockResolvedValue({ sourceId: 'src-oauth' }),
  GOOGLE_SHEETS_SOURCE_DEFINITION_ID: 'gs',
}));
jest.mock('@/components/connectors/oauth-popup', () => ({
  openOAuthPopup: jest.fn().mockResolvedValue({ code: 'c', state: 'gst' }),
}));

// Controllable stand-in for the backend WebSocket: the hook reads `lastMessage` and
// calls `sendOrQueue`. The `mock`-prefixed name lets the hoisted jest.mock factory
// reference it. Tests mutate `mockWs.lastMessage` then rerender to drive the effect.
const mockWs: { sendOrQueue: jest.Mock; lastMessage: { data: string } | null } = {
  sendOrQueue: jest.fn(),
  lastMessage: null,
};
jest.mock('@/hooks/useBackendWebSocket', () => ({
  useBackendWebSocket: () => ({
    sendOrQueue: mockWs.sendOrQueue,
    lastMessage: mockWs.lastMessage,
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockWs.lastMessage = null;
  (createSource as jest.Mock).mockResolvedValue({ sourceId: 'src-1' });
});

it('connectGoogle runs consent → popup → complete and reports the new source id', async () => {
  const onSaved = jest.fn();
  const { result } = renderHook(() =>
    useSourceSave({ sourceDefId: 'gs', getConfig: () => ({ x: 1 }), onSaved })
  );
  await act(async () => {
    await result.current.connectGoogle('My Sheet');
  });
  await waitFor(() => expect(onSaved).toHaveBeenCalledWith('src-oauth'));
});

it('save() success: WS check succeeds → createSource is called and onSaved fires with the new id', async () => {
  const onSaved = jest.fn();
  const getConfig = () => ({ host: 'db.example', port: 5432 });
  const { result, rerender } = renderHook(() =>
    useSourceSave({ sourceDefId: 'pg-def', getConfig, onSaved })
  );

  act(() => {
    result.current.save('My Source');
  });
  // save() queues the check payload over the WS and enters the loading state
  expect(mockWs.sendOrQueue).toHaveBeenCalledWith({
    name: 'My Source',
    sourceDefId: 'pg-def',
    config: { host: 'db.example', port: 5432 },
  });
  expect(result.current.loading).toBe(true);

  // The backend reports a successful connection check → the hook creates the source
  await act(async () => {
    mockWs.lastMessage = {
      data: JSON.stringify({ status: 'success', data: { status: 'succeeded' } }),
    };
    rerender();
  });

  await waitFor(() =>
    expect(createSource).toHaveBeenCalledWith({
      name: 'My Source',
      sourceDefId: 'pg-def',
      config: { host: 'db.example', port: 5432 },
    })
  );
  await waitFor(() => expect(onSaved).toHaveBeenCalledWith('src-1'));
  expect(result.current.loading).toBe(false);
});

it('save() failure: WS check fails → createSource is NOT called, setupLogs populated, loading ends false', async () => {
  const onSaved = jest.fn();
  const { result, rerender } = renderHook(() =>
    useSourceSave({ sourceDefId: 'pg-def', getConfig: () => ({ x: 1 }), onSaved })
  );

  act(() => {
    result.current.save('My Source');
  });

  // The backend reports the connection check itself failed, with logs to surface
  await act(async () => {
    mockWs.lastMessage = {
      data: JSON.stringify({
        status: 'success',
        data: { status: 'failed', logs: ['line one', 'line two'] },
      }),
    };
    rerender();
  });

  await waitFor(() => expect(result.current.setupLogs).toEqual(['line one', 'line two']));
  expect(createSource).not.toHaveBeenCalled();
  expect(onSaved).not.toHaveBeenCalled();
  expect(result.current.loading).toBe(false);
});
