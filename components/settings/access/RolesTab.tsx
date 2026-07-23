'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Lock } from 'lucide-react';
import { PERMISSIONS, useRbac } from '@/lib/rbac';
import { useOrgPreferences } from '@/hooks/api/useNotifications';
import { updateAccessDefaults, type AccessDefaults } from '@/hooks/api/useAccess';

type Level = 'view' | 'edit' | 'no_access';

const LEVEL_LABEL: Record<Level, string> = {
  no_access: 'No access',
  view: 'View only',
  edit: 'Edit',
};

interface RoleRow {
  role: string;
  description: string;
  dataPipelineAccess: string;
  resources: {
    editable: boolean;
    value: Level;
  };
}

export function RolesTab() {
  const { orgPreferences, isLoading, mutate } = useOrgPreferences();
  const { hasPermission } = useRbac();
  const canEdit = hasPermission(PERMISSIONS.CAN_MANAGE_ACCESS_DEFAULTS);

  const [analystLevel, setAnalystLevel] = useState<Level>('view');
  const [memberLevel, setMemberLevel] = useState<Level>('no_access');
  const [allowPublic, setAllowPublic] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (orgPreferences) {
      setAnalystLevel(orgPreferences.default_analyst_level);
      setMemberLevel(orgPreferences.default_member_level);
      setAllowPublic(orgPreferences.allow_public_sharing);
    }
  }, [orgPreferences]);

  const hasChanges =
    !!orgPreferences &&
    (analystLevel !== orgPreferences.default_analyst_level ||
      memberLevel !== orgPreferences.default_member_level ||
      allowPublic !== orgPreferences.allow_public_sharing);

  const handleReset = () => {
    if (!orgPreferences) return;
    setAnalystLevel(orgPreferences.default_analyst_level);
    setMemberLevel(orgPreferences.default_member_level);
    setAllowPublic(orgPreferences.allow_public_sharing);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload: AccessDefaults = {
        default_analyst_level: analystLevel,
        default_member_level: memberLevel,
        allow_public_sharing: allowPublic,
      };
      await updateAccessDefaults(payload);
      mutate();
    } catch {
      // handled in hook
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || !orgPreferences) {
    return (
      <div className="border rounded-lg bg-white overflow-hidden p-6">
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  const rows: RoleRow[] = [
    {
      role: 'Admins',
      description: 'Run the organisation, manage people, settings and data.',
      dataPipelineAccess: 'All access',
      resources: { editable: false, value: 'edit' },
    },
    {
      role: 'Analysts',
      description: 'Build and maintain dashboards, charts and reports.',
      dataPipelineAccess: 'View only',
      resources: { editable: true, value: analystLevel },
    },
    {
      role: 'Members',
      description: 'Work with the shared dashboards and reports',
      dataPipelineAccess: 'No access',
      resources: { editable: true, value: memberLevel },
    },
  ];

  const handleResourceChange = (role: string, level: Level) => {
    if (role === 'Analysts') setAnalystLevel(level);
    if (role === 'Members') setMemberLevel(level);
  };

  return (
    <div className="space-y-6">
      <div className="border rounded-lg bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900">Default permissions</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Sets what each role can do across all resources on the platform.
        </p>

        <div className="border rounded-lg mt-4">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="w-[45%]">Role</TableHead>
                <TableHead className="w-[27%]">Data &amp; Pipeline access</TableHead>
                <TableHead className="w-[28%]">Resources access</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.role}>
                  <TableCell className="py-4">
                    <div className="font-semibold text-gray-900">{row.role}</div>
                    <div className="text-sm text-muted-foreground">{row.description}</div>
                  </TableCell>
                  <TableCell className="py-4">
                    <span className="inline-flex items-center rounded-md bg-gray-100 px-3 py-1 text-sm text-gray-600">
                      {row.dataPipelineAccess}
                    </span>
                  </TableCell>
                  <TableCell className="py-4">
                    {row.resources.editable ? (
                      <Select
                        value={row.resources.value}
                        onValueChange={(v) => handleResourceChange(row.role, v as Level)}
                        disabled={!canEdit}
                      >
                        <SelectTrigger
                          className="w-40"
                          data-testid={`resource-select-${row.role.toLowerCase()}`}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="no_access">{LEVEL_LABEL.no_access}</SelectItem>
                          <SelectItem value="view">{LEVEL_LABEL.view}</SelectItem>
                          <SelectItem value="edit">{LEVEL_LABEL.edit}</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="inline-flex items-center gap-2 rounded-md bg-gray-100 px-3 py-1 text-sm text-gray-600">
                        All access
                        <Lock className="h-3 w-3" />
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="border rounded-lg bg-white p-6">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Allow public sharing</h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              Turn on to allow public links, owners can generate view-only public links for
              individual dashboards. Anyone with the link can view without signing in.
            </p>
          </div>
          <Switch
            checked={allowPublic}
            onCheckedChange={setAllowPublic}
            disabled={!canEdit}
            data-testid="allow-public-sharing-toggle"
          />
        </div>
      </div>

      {canEdit && (
        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            data-testid="save-access-defaults"
          >
            {isSaving ? 'Saving…' : 'Save'}
          </Button>
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={!hasChanges || isSaving}
            data-testid="cancel-access-defaults"
          >
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}
