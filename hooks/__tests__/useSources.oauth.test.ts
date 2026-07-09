/**
 * Tests for the Google OAuth mutation functions in hooks/api/useSources.ts (Variant A):
 * - getSourceOAuthConsent  → returns the Google authUrl Dalgo built
 * - createOAuthSource      → redeems the ref and creates the source
 */

import { getSourceOAuthConsent, createOAuthSource } from '../api/useSources';
import { apiPost } from '@/lib/api';

jest.mock('@/lib/api');

describe('useSources Google OAuth mutations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getSourceOAuthConsent', () => {
    it('POSTs the source definition id and returns the Google auth URL', async () => {
      (apiPost as jest.Mock).mockResolvedValue({
        authUrl: 'https://accounts.google.com/o/oauth2/v2/auth?client_id=x',
      });

      const result = await getSourceOAuthConsent('gsheets-def-id');

      expect(apiPost).toHaveBeenCalledWith('/api/airbyte/sources/oauth/consent/', {
        sourceDefId: 'gsheets-def-id',
      });
      expect(result.authUrl).toBe('https://accounts.google.com/o/oauth2/v2/auth?client_id=x');
    });
  });

  describe('createOAuthSource', () => {
    it('POSTs name + config + ref and returns the saved source id', async () => {
      (apiPost as jest.Mock).mockResolvedValue({ sourceId: 'new-src-id' });

      const result = await createOAuthSource({
        sourceDefId: 'gsheets-def-id',
        name: 'my sheet',
        config: { spreadsheet_id: 'https://sheet' },
        ref: 'ref-abc',
      });

      expect(apiPost).toHaveBeenCalledWith('/api/airbyte/sources/oauth/create/', {
        sourceDefId: 'gsheets-def-id',
        name: 'my sheet',
        config: { spreadsheet_id: 'https://sheet' },
        ref: 'ref-abc',
      });
      expect(result).toEqual({ sourceId: 'new-src-id' });
    });
  });
});
