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
import { Lock, Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { PERMISSIONS, useRbac } from '@/lib/rbac';
import { useOrgPreferences } from '@/hooks/api/useNotifications';
import { updateAccessDefaults, type AccessDefaults } from '@/hooks/api/useAccess';

type Level = 'view' | 'edit' | 'no_access';

// UI-only rebrand — backend, API, and DB continue to use no_access / view / edit
// internally. All access-control semantics unchanged; only the label users see
// in Settings > Access > Roles is different.
const LEVEL_LABEL: Record<Level, string> = {
  no_access: 'Create only',
  view: 'Create & View',
  edit: 'Create & Edit',
};

interface RoleRow {
  role: string;
  systemSummary: string;
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
      systemSummary: 'Full access across all datasets, pipelines and settings',
      resources: { editable: false, value: 'edit' },
    },
    {
      role: 'Analysts',
      systemSummary: 'Can view pipelines, create & edit; metrics, alerts and groups',
      resources: { editable: true, value: analystLevel },
    },
    {
      role: 'Members',
      systemSummary: 'Can query datasets & view alerts. No pipeline access.',
      resources: { editable: true, value: memberLevel },
    },
  ];

  const LEVEL_RANK: Record<Level, number> = { no_access: 0, view: 1, edit: 2 };

  const handleResourceChange = (role: string, level: Level) => {
    if (role === 'Analysts') {
      setAnalystLevel(level);
      // Clamp member floor if it would exceed new analyst floor
      if (LEVEL_RANK[memberLevel] > LEVEL_RANK[level]) setMemberLevel(level);
    }
    if (role === 'Members') setMemberLevel(level);
  };

  return (
    <div className="space-y-6">
      <div className="border rounded-lg bg-white p-6">
        <div className="flex items-center gap-1.5">
          <h2 className="text-lg font-semibold text-gray-900">Default permissions</h2>
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="About default permissions"
                  className="text-muted-foreground hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
                >
                  <Info className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                These defaults set the absolute floor for each role. Users can grant higher
                access on specific resources, but they cannot restrict it below these
                baselines unless the resource is made Private.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          The baseline access for each role. You can grant individuals more access later.
        </p>

        {!canEdit && (
          <div
            className="mt-4 flex items-start gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600"
            data-testid="roles-readonly-notice"
          >
            <Lock className="h-4 w-4 mt-0.5 shrink-0" />
            <p>View-only. Only Admins can change these defaults.</p>
          </div>
        )}

        <div className="border rounded-lg mt-4">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[20%] text-gray-700 font-semibold">Role</TableHead>
                <TableHead className="w-[52%] text-gray-700 font-semibold">
                  System summary
                </TableHead>
                <TableHead className="w-[28%] text-right text-gray-700 font-semibold">
                  Visualisations
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.role}>
                  <TableCell className="py-5">
                    <div className="font-semibold text-gray-900">{row.role}</div>
                  </TableCell>
                  <TableCell className="py-5">
                    <span className="text-sm text-gray-700">{row.systemSummary}</span>
                  </TableCell>
                  <TableCell className="py-5 text-right">
                    {row.resources.editable ? (
                      <Select
                        value={row.resources.value}
                        onValueChange={(v) => handleResourceChange(row.role, v as Level)}
                        disabled={!canEdit}
                      >
                        <SelectTrigger
                          className="w-[160px] ml-auto"
                          data-testid={`resource-select-${row.role.toLowerCase()}`}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(['edit', 'view', 'no_access'] as Level[]).map((lvl) => {
                            const disabled =
                              row.role === 'Members' && LEVEL_RANK[lvl] > LEVEL_RANK[analystLevel];
                            return (
                              <SelectItem key={lvl} value={lvl} disabled={disabled}>
                                {LEVEL_LABEL[lvl]}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="inline-flex items-center justify-between gap-2 w-[160px] rounded-md border border-input bg-background px-3 py-2 text-sm text-gray-700 ml-auto">
                        Full access
                        <Lock className="h-3.5 w-3.5 text-gray-500" />
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
