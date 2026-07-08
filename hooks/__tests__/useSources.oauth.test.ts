/**
 * Tests for the Google OAuth mutation functions in hooks/api/useSources.ts:
 * - getSourceOAuthConsent
 * - completeSourceOAuth
 */

import { getSourceOAuthConsent, completeSourceOAuth } from '../api/useSources';
import { apiPost } from '@/lib/api';

jest.mock('@/lib/api');

describe('useSources Google OAuth mutations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getSourceOAuthConsent', () => {
    it('POSTs the source definition id and returns the consent URL + state', async () => {
      (apiPost as jest.Mock).mockResolvedValue({
        consentUrl: 'https://accounts.google.com/o/oauth2/x',
        state: 'nonce-123',
      });

      const result = await getSourceOAuthConsent('gsheets-def-id');

      expect(apiPost).toHaveBeenCalledWith('/api/airbyte/sources/oauth/consent/', {
        sourceDefId: 'gsheets-def-id',
      });
      expect(result.consentUrl).toBe('https://accounts.google.com/o/oauth2/x');
      expect(result.state).toBe('nonce-123');
    });
  });

  describe('completeSourceOAuth', () => {
    it('POSTs the state + query params and returns the config fragment', async () => {
      (apiPost as jest.Mock).mockResolvedValue({ credentials: { auth_type: 'Client' } });

      const result = await completeSourceOAuth({
        sourceDefId: 'gsheets-def-id',
        state: 'nonce-123',
        queryParams: { code: 'abc', state: 'google-state' },
      });

      expect(apiPost).toHaveBeenCalledWith('/api/airbyte/sources/oauth/complete/', {
        sourceDefId: 'gsheets-def-id',
        state: 'nonce-123',
        queryParams: { code: 'abc', state: 'google-state' },
      });
      expect(result).toEqual({ credentials: { auth_type: 'Client' } });
    });
  });
});
