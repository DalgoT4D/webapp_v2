'use client';

import { useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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
  useAdminOrgFlags,
  useAdminFlagActions,
} from '@/hooks/api/useAdminPortal';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';

interface OrgFlagsPanelProps {
  orgId: number;
}

/**
 * The Flags tab for one org: every catalog flag with its current on/off state for
 * this org, toggleable independently. FeatureFlagsPage is the transpose — every org's
 * status for ONE flag — and each of its rows toggles through the same single-org call
 * this does. Keep the two in step: a row is disabled while its write is in flight and
 * shows an inline error if it fails.
 */
export function OrgFlagsPanel({ orgId }: OrgFlagsPanelProps) {
  const { catalog, isLoading: catalogLoading } = useAdminFlagCatalog();
  const { flags, isLoading: flagsLoading, mutate } = useAdminOrgFlags(orgId);
  const { setOrgFlag } = useAdminFlagActions();

  const [pendingFlag, setPendingFlag] = useState<string | null>(null);
  const [errorFlag, setErrorFlag] = useState<string | null>(null);

  const onToggle = async (flagName: string, enabled: boolean) => {
    setPendingFlag(flagName);
    setErrorFlag(null);
    try {
      await setOrgFlag(orgId, flagName, enabled);
      trackEvent(ANALYTICS_EVENTS.ADMIN_FLAG_SET, { flag_name: flagName, enabled });
      await mutate();
    } catch {
      // toast already surfaced in the hook; this row also shows its own inline error
      setErrorFlag(flagName);
    } finally {
      setPendingFlag(null);
    }
  };

  if (catalogLoading || flagsLoading) {
    return <Skeleton className="h-48 w-full" data-testid="org-flags-loading" />;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Flag</TableHead>
          <TableHead>Description</TableHead>
          <TableHead className="text-right">Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {(!catalog || catalog.length === 0) && (
          <TableRow>
            <TableCell colSpan={3} className="text-center text-muted-foreground">
              No feature flags available.
            </TableCell>
          </TableRow>
        )}
        {catalog?.map((item) => {
          const switchId = `org-flag-switch-${item.flag_name}`;
          return (
            <TableRow key={item.flag_name} data-testid={`org-flag-row-${item.flag_name}`}>
              <TableCell>
                <Label htmlFor={switchId}>{item.flag_name}</Label>
              </TableCell>
              <TableCell className="text-muted-foreground">{item.description}</TableCell>
              <TableCell className="text-right">
                <Switch
                  id={switchId}
                  checked={Boolean(flags?.[item.flag_name])}
                  disabled={pendingFlag === item.flag_name}
                  onCheckedChange={(checked) => onToggle(item.flag_name, checked)}
                  data-testid={switchId}
                />
                {errorFlag === item.flag_name && (
                  <p
                    className="text-xs text-destructive mt-1"
                    data-testid={`org-flag-error-${item.flag_name}`}
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
  );
}
