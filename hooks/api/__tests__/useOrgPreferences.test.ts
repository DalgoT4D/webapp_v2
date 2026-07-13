/**
 * Tests for the orgpreferences sharing-settings mutation added in task-11f.
 * useOrgPreferences() itself (GET /api/orgpreferences/) is already exercised
 * indirectly by NotificationPreferencesDialog.test.tsx; this file covers the
 * new PUT-sharing mutation and the extended OrgPreferences shape.
 */
import { mockApiPut } from '@/test-utils/api';
import { updateSharingPreferences } from '@/hooks/api/useNotifications';

describe('updateSharingPreferences', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('puts a partial body to /api/orgpreferences/sharing/ and returns the updated preferences', async () => {
    const updated = {
      enable_discord_notifications: false,
      discord_webhook: '',
      allow_public_sharing: false,
      default_general_audience: 'admins' as const,
      default_general_level: 'view' as const,
    };
    mockApiPut.mockResolvedValue({ success: true, res: updated });

    const result = await updateSharingPreferences({ allow_public_sharing: false });

    expect(result).toEqual(updated);
    expect(mockApiPut).toHaveBeenCalledWith('/api/orgpreferences/sharing/', {
      allow_public_sharing: false,
    });
  });

  it('sends only the fields provided (partial update)', async () => {
    mockApiPut.mockResolvedValue({
      success: true,
      res: {
        enable_discord_notifications: false,
        discord_webhook: '',
        allow_public_sharing: true,
        default_general_audience: 'all_users',
        default_general_level: 'edit',
      },
    });

    await updateSharingPreferences({
      default_general_audience: 'all_users',
      default_general_level: 'edit',
    });

    expect(mockApiPut).toHaveBeenCalledWith('/api/orgpreferences/sharing/', {
      default_general_audience: 'all_users',
      default_general_level: 'edit',
    });
  });
});
