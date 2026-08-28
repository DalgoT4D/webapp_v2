'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  useAdminFlagCatalog,
  useAdminFlagOrgs,
  useAdminFlagActions,
} from '@/hooks/api/useAdminPortal';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';

/**
 * The portal-wide feature-flags view: pick a flag, see every org's current status in
 * a table, and flip any org's toggle immediately -- no select-then-apply step. The
 * per-org tab (OrgFlagsPanel) is the mirror image: every flag for one org.
 */
export default function FeatureFlagsPage() {
  const { catalog, isLoading: catalogLoading } = useAdminFlagCatalog();
  const [flagName, setFlagName] = useState('');
  const { orgFlags, isLoading: orgFlagsLoading, mutate } = useAdminFlagOrgs(flagName || null);
  const { setOrgFlag } = useAdminFlagActions();

  const [pendingOrgId, setPendingOrgId] = useState<number | null>(null);
  const [errorOrgId, setErrorOrgId] = useState<number | null>(null);

  const onToggle = async (orgId: number, enabled: boolean) => {
    setPendingOrgId(orgId);
    setErrorOrgId(null);
    try {
      await setOrgFlag(orgId, flagName, enabled);
      trackEvent(ANALYTICS_EVENTS.ADMIN_FLAG_SET, { flag_name: flagName, enabled });
      await mutate();
    } catch {
      // toast already surfaced in the hook; this row also shows its own inline error
      setErrorOrgId(orgId);
    } finally {
      setPendingOrgId(null);
    }
  };

  if (catalogLoading) {
    return (
      <div className="p-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-6 h-64 w-full max-w-xl" />
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold mb-1">Feature flags</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Turn a feature on or off for any organization.
      </p>

      <Card className="max-w-2xl mb-6">
        <CardHeader>
          <CardTitle>Choose a flag</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="flag-select">Flag</Label>
            <Select value={flagName} onValueChange={setFlagName}>
              <SelectTrigger id="flag-select" data-testid="flag-select">
                <SelectValue placeholder="Choose a flag" />
              </SelectTrigger>
              <SelectContent>
                {catalog?.map((item) => (
                  <SelectItem key={item.flag_name} value={item.flag_name}>
                    {item.flag_name} — {item.description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {flagName &&
        (orgFlagsLoading ? (
          <Skeleton className="h-64 w-full max-w-2xl" data-testid="flags-orgs-loading" />
        ) : (
          <Table className="max-w-2xl">
            <TableHeader>
              <TableRow>
                <TableHead>Organization</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(!orgFlags || orgFlags.length === 0) && (
                <TableRow>
                  <TableCell colSpan={2} className="text-center text-muted-foreground">
                    No organizations found.
                  </TableCell>
                </TableRow>
              )}
              {orgFlags?.map((orgFlag) => {
                const switchId = `flags-org-switch-${orgFlag.org_id}`;
                return (
                  <TableRow key={orgFlag.org_id} data-testid={`flags-org-row-${orgFlag.org_id}`}>
                    <TableCell>
                      <Label htmlFor={switchId}>{orgFlag.org_name}</Label>
                    </TableCell>
                    <TableCell className="text-right">
                      <Switch
                        id={switchId}
                        checked={Boolean(orgFlag.enabled)}
                        disabled={pendingOrgId === orgFlag.org_id}
                        onCheckedChange={(checked) => onToggle(orgFlag.org_id, checked)}
                        data-testid={switchId}
                      />
                      {errorOrgId === orgFlag.org_id && (
                        <p
                          className="text-xs text-destructive mt-1"
                          data-testid={`flags-org-error-${orgFlag.org_id}`}
                        >
                          Failed to update
                        </p>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ))}
    </div>
  );
}
