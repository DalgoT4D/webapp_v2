/**
 * Tests for the useSourceSave hook — shared source-create logic (WS check_connection
 * → createSource, and the Google OAuth connect flow) used by SourceForm and (later)
 * the source wizard's step 2.
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useSourceSave } from '../useSourceSave';

jest.mock('@/hooks/api/useSources', () => ({
  createSource: jest.fn().mockResolvedValue({ sourceId: 'src-1' }),
  getSourceOAuthConsent: jest.fn().mockResolvedValue({ consentUrl: 'https://c', state: 'st' }),
  completeSourceOAuth: jest.fn().mockResolvedValue({ sourceId: 'src-oauth' }),
  GOOGLE_SHEETS_SOURCE_DEFINITION_ID: 'gs',
}));
jest.mock('@/components/connectors/oauth-popup', () => ({
  openOAuthPopup: jest.fn().mockResolvedValue({ code: 'c', state: 'gst' }),
}));

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
