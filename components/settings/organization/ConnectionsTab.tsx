'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Switch } from '@/components/ui/switch';
import { apiGet, apiPut } from '@/lib/api';
import { toastError, toastSuccess } from '@/lib/toast';
import { PERMISSIONS, useRbac } from '@/lib/rbac';

interface OrgPreferencesResponse {
  success: boolean;
  res: {
    auto_accept_non_breaking_schema_changes: boolean;
  };
}

const PREFS_KEY = '/api/orgpreferences/';

export default function ConnectionsTab() {
  const { hasPermission } = useRbac();
  const canEdit = hasPermission(PERMISSIONS.CAN_EDIT_SCHEMA_CHANGE_SETTINGS);

  const { data, mutate, isLoading } = useSWR<OrgPreferencesResponse>(PREFS_KEY, apiGet, {
    revalidateOnFocus: false,
  });
  const [saving, setSaving] = useState(false);

  const checked = data?.res?.auto_accept_non_breaking_schema_changes ?? false;

  const onToggle = async (next: boolean) => {
    setSaving(true);
    try {
      await apiPut('/api/orgpreferences/auto-accept-schema-changes', {
        auto_accept_non_breaking_schema_changes: next,
      });
      await mutate();
      toastSuccess.saved('auto-accept setting');
    } catch (err: any) {
      toastError.save(err, 'auto-accept setting');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 border-b bg-background">
        <div className="p-6 pb-0 mb-6">
          <h1 className="text-3xl font-bold">Connections</h1>
          <p className="text-muted-foreground mt-1">
            Org-wide settings that apply to every connection
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-3xl bg-white border rounded-lg p-6">
          <div className="flex items-start justify-between gap-6">
            <div className="flex-1">
              <h2 className="text-lg font-semibold">Auto-accept non-breaking schema changes</h2>
              <p className="text-sm text-muted-foreground mt-1">
                When a source adds a column or a new stream, Dalgo will apply the change
                automatically. Breaking changes still require manual review.
              </p>
            </div>
            <Switch
              checked={checked}
              disabled={!canEdit || saving || isLoading}
              onCheckedChange={onToggle}
              data-testid="auto-accept-schema-changes-toggle"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
