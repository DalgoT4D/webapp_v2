'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { ShieldCheck, Lock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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
import type { RolePermissionLevel } from '@/hooks/api/useResourceAccess';
import { ROLE_LEVEL_ORDER, ROLE_LEVEL_LABELS } from '@/lib/access-labels';

// Draft state for the two editable per-role dropdowns (Admins is fixed and
// never part of the draft — see the "Resources access" column below).
interface DefaultPermissionsDraft {
  analyst: RolePermissionLevel;
  member: RolePermissionLevel;
}

export default function AccessManagement() {
  const { orgPreferences, isLoading, mutate } = useOrgPreferences();

  // Draft state for the "Default permissions" table. CANCEL and a
  // successful SAVE both reset it to the last-saved value.
  const [draft, setDraft] = useState<DefaultPermissionsDraft | null>(null);

  // Tracks the last source values the draft was synced from, so a background
  // SWR revalidation can re-sync without clobbering an unsaved edit — only
  // resyncs when the draft still matches the previous source.
  const lastSyncedSourceRef = useRef<DefaultPermissionsDraft | null>(null);

  useEffect(() => {
    if (!orgPreferences) return;
    const source: DefaultPermissionsDraft = {
      analyst: orgPreferences.default_analyst_level,
      member: orgPreferences.default_member_level,
    };
    const lastSynced = lastSyncedSourceRef.current;
    const sourceChanged =
      !lastSynced || lastSynced.analyst !== source.analyst || lastSynced.member !== source.member;
    if (!sourceChanged) return;

    setDraft((current) => {
      const draftMatchesLastSyncedSource =
        !lastSynced ||
        !current ||
        (current.analyst === lastSynced.analyst && current.member === lastSynced.member);
      return draftMatchesLastSyncedSource ? source : current;
    });
    lastSyncedSourceRef.current = source;
  }, [orgPreferences]);

  const isDirty = Boolean(
    draft &&
      orgPreferences &&
      (draft.analyst !== orgPreferences.default_analyst_level ||
        draft.member !== orgPreferences.default_member_level)
  );

  const handleAnalystLevelChange = (value: string) =>
    setDraft((prev) => (prev ? { ...prev, analyst: value as RolePermissionLevel } : prev));

  const handleMemberLevelChange = (value: string) =>
    setDraft((prev) => (prev ? { ...prev, member: value as RolePermissionLevel } : prev));

  const handleCancel = () => {
    if (!orgPreferences) return;
    setDraft({
      analyst: orgPreferences.default_analyst_level,
      member: orgPreferences.default_member_level,
    });
  };

  const handleSave = useCallback(async () => {
    if (!draft) return;
    try {
      await updateSharingPreferences({
        default_analyst_level: draft.analyst,
        default_member_level: draft.member,
      });
      mutate();
      toastSuccess.generic('Default permissions updated');
      trackEvent(ANALYTICS_EVENTS.SHARING_SETTINGS_UPDATED, {
        setting: 'default_permissions',
        analyst_level: draft.analyst,
        member_level: draft.member,
      });
    } catch (error) {
      toastError.api(error, 'update default permissions');
    }
  }, [draft, mutate]);

  // Kill switch deliberately applies immediately (not via the draft) —
  // toggling it has immediate side effects on live public links.
  const handleTogglePublicSharing = async (checked: boolean) => {
    try {
      await updateSharingPreferences({ allow_public_sharing: checked });
      mutate();
      toastSuccess.generic('Sharing settings updated');
      trackEvent(ANALYTICS_EVENTS.SHARING_SETTINGS_UPDATED, {
        setting: 'allow_public_sharing',
        value: checked,
      });
    } catch (error) {
      toastError.api(error, 'update sharing settings');
    }
  };

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6 pt-6 space-y-6">
        {isLoading || !orgPreferences || !draft ? (
          <div className="space-y-3" data-testid="access-management-loading">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : (
          <>
            <Card>
              <CardContent className="p-4 space-y-4">
                <div>
                  <Label className="text-sm font-medium">Default permissions</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Sets what each role can do across all resources on the platform.
                  </p>
                </div>

                <table className="w-full text-sm" data-testid="access-mgmt-roles-table">
                  <thead>
                    <tr className="border-b text-left text-xs font-medium text-muted-foreground">
                      <th className="py-2 pr-4 font-medium">Role</th>
                      <th className="py-2 px-4 font-medium">Data & Pipeline access</th>
                      <th className="py-2 pl-4 font-medium">Resources access</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      className="border-b last:border-b-0"
                      data-testid="access-mgmt-role-row-admin"
                    >
                      <td className="py-3 pr-4 align-top">
                        <p className="font-medium text-foreground">Admins</p>
                        <p className="text-xs text-muted-foreground">
                          Run the organisation, manage people, settings and data.
                        </p>
                      </td>
                      <td className="py-3 px-4 align-top">
                        <span
                          data-testid="access-mgmt-data-pipeline-admin"
                          className="inline-flex items-center rounded-md border bg-muted px-3 py-1 text-xs text-muted-foreground"
                        >
                          All access
                        </span>
                      </td>
                      <td className="py-3 pl-4 align-top">
                        <span
                          data-testid="access-mgmt-resources-admin"
                          className="inline-flex items-center gap-2 rounded-md border bg-muted px-3 py-1.5 text-xs text-muted-foreground"
                        >
                          All access
                          <Lock
                            data-testid="access-mgmt-resources-admin-lock"
                            className="h-3 w-3"
                          />
                        </span>
                      </td>
                    </tr>

                    <tr
                      className="border-b last:border-b-0"
                      data-testid="access-mgmt-role-row-analyst"
                    >
                      <td className="py-3 pr-4 align-top">
                        <p className="font-medium text-foreground">Analysts</p>
                        <p className="text-xs text-muted-foreground">
                          Build and maintain dashboards, charts and reports.
                        </p>
                      </td>
                      <td className="py-3 px-4 align-top">
                        <span
                          data-testid="access-mgmt-data-pipeline-analyst"
                          className="inline-flex items-center rounded-md border bg-muted px-3 py-1 text-xs text-muted-foreground"
                        >
                          View only
                        </span>
                      </td>
                      <td className="py-3 pl-4 align-top">
                        <Select value={draft.analyst} onValueChange={handleAnalystLevelChange}>
                          <SelectTrigger
                            id="access-mgmt-resources-analyst"
                            data-testid="access-mgmt-resources-analyst"
                            className="w-40"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLE_LEVEL_ORDER.map((level) => (
                              <SelectItem key={level} value={level}>
                                {ROLE_LEVEL_LABELS[level]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>

                    <tr data-testid="access-mgmt-role-row-member">
                      <td className="py-3 pr-4 align-top">
                        <p className="font-medium text-foreground">Members</p>
                        <p className="text-xs text-muted-foreground">
                          Work with the shared dashboards and reports
                        </p>
                      </td>
                      <td className="py-3 px-4 align-top">
                        <span
                          data-testid="access-mgmt-data-pipeline-member"
                          className="inline-flex items-center rounded-md border bg-muted px-3 py-1 text-xs text-muted-foreground"
                        >
                          No access
                        </span>
                      </td>
                      <td className="py-3 pl-4 align-top">
                        <Select value={draft.member} onValueChange={handleMemberLevelChange}>
                          <SelectTrigger
                            id="access-mgmt-resources-member"
                            data-testid="access-mgmt-resources-member"
                            className="w-40"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLE_LEVEL_ORDER.map((level) => (
                              <SelectItem key={level} value={level}>
                                {ROLE_LEVEL_LABELS[level]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  </tbody>
                </table>
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

            <div className="flex gap-2">
              <Button data-testid="access-mgmt-save-btn" disabled={!isDirty} onClick={handleSave}>
                SAVE
              </Button>
              <Button
                data-testid="access-mgmt-cancel-btn"
                variant="outline"
                disabled={!isDirty}
                onClick={handleCancel}
              >
                CANCEL
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
