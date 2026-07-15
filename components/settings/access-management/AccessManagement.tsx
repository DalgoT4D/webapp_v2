'use client';

import { useCallback } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toastSuccess, toastError } from '@/lib/toast';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';
import { useOrgPreferences, updateSharingPreferences } from '@/hooks/api/useNotifications';
import type { AccessAudience, AccessLevel } from '@/hooks/api/useResourceAccess';
import { AUDIENCE_ORDER, audienceLabels, LEVEL_LABELS } from '@/lib/access-labels';

// Same vocabulary ShareModal/BulkShareDialog use everywhere else — this page
// describes the ORG DEFAULT rather than "who has access to this resource",
// and has no per-resource org name to interpolate, so it uses the shared
// "your organization" fallback for "all_users".
const AUDIENCE_LABELS = audienceLabels();

export default function AccessManagement() {
  const { orgPreferences, isLoading, mutate } = useOrgPreferences();

  const applySharingChange = useCallback(
    async (
      setting: 'allow_public_sharing' | 'default_general_audience' | 'default_general_level',
      value: boolean | AccessAudience | AccessLevel,
      payload: Parameters<typeof updateSharingPreferences>[0]
    ) => {
      try {
        await updateSharingPreferences(payload);
        mutate();
        toastSuccess.generic('Sharing settings updated');
        trackEvent(ANALYTICS_EVENTS.SHARING_SETTINGS_UPDATED, { setting, value });
      } catch (error) {
        toastError.api(error, 'update sharing settings');
      }
    },
    [mutate]
  );

  const handleTogglePublicSharing = (checked: boolean) =>
    applySharingChange('allow_public_sharing', checked, { allow_public_sharing: checked });

  const handleAudienceChange = (value: string) =>
    applySharingChange('default_general_audience', value as AccessAudience, {
      default_general_audience: value as AccessAudience,
    });

  const handleLevelChange = (value: string) =>
    applySharingChange('default_general_level', value as AccessLevel, {
      default_general_level: value as AccessLevel,
    });

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6 pt-6 space-y-6">
        {isLoading || !orgPreferences ? (
          <p className="text-sm text-muted-foreground" data-testid="access-management-loading">
            Loading access settings…
          </p>
        ) : (
          <>
            <Card>
              <CardContent className="p-4 space-y-3">
                <Label className="text-sm font-medium">Roles in your organization</Label>
                <div className="space-y-2" data-testid="access-mgmt-role-descriptions">
                  <p className="text-xs text-muted-foreground">
                    <strong className="text-foreground font-medium">Admins</strong> — Run the
                    organisation, manage people, settings and data.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <strong className="text-foreground font-medium">Analysts</strong> — Build and
                    maintain dashboards, charts and reports.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <strong className="text-foreground font-medium">Members</strong> — Work with the
                    shared dashboards and reports
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                    <div>
                      <Label className="text-sm font-medium">Allow public sharing</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Turn on to allow public links, owners can generate view-only public links
                        for individual dashboards. Anyone with the link can view without signing in.
                      </p>
                    </div>
                  </div>
                  <Switch
                    id="access-mgmt-public-sharing-toggle"
                    data-testid="access-mgmt-public-sharing-toggle"
                    checked={orgPreferences.allow_public_sharing}
                    onCheckedChange={handleTogglePublicSharing}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-3">
                <Label className="text-sm font-medium">Default access for new resources</Label>
                <p className="text-xs text-muted-foreground">
                  These settings only apply to dashboards, reports, alerts, metrics, and KPIs
                  created from now on — they don&apos;t change access on anything that already
                  exists.
                </p>
                <div className="flex gap-2">
                  <div className="flex-1 space-y-1">
                    <Label htmlFor="access-mgmt-default-audience" className="text-xs">
                      Who has access
                    </Label>
                    <Select
                      value={orgPreferences.default_general_audience}
                      onValueChange={handleAudienceChange}
                    >
                      <SelectTrigger
                        id="access-mgmt-default-audience"
                        data-testid="access-mgmt-default-audience"
                        className="w-full"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {AUDIENCE_ORDER.map((audience) => (
                          <SelectItem key={audience} value={audience}>
                            {AUDIENCE_LABELS[audience]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-40 space-y-1">
                    <Label htmlFor="access-mgmt-default-level" className="text-xs">
                      Permission
                    </Label>
                    <Select
                      value={orgPreferences.default_general_level}
                      onValueChange={handleLevelChange}
                    >
                      <SelectTrigger
                        id="access-mgmt-default-level"
                        data-testid="access-mgmt-default-level"
                        className="w-full"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="view">{LEVEL_LABELS.view}</SelectItem>
                        <SelectItem value="edit">{LEVEL_LABELS.edit}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
