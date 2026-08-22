'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
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
 * this org, toggleable independently. The portal-wide multi-org view is a separate
 * component (FeatureFlagsPage) that applies a flag to several orgs at once.
 */
export function OrgFlagsPanel({ orgId }: OrgFlagsPanelProps) {
  const { catalog, isLoading: catalogLoading } = useAdminFlagCatalog();
  const { flags, isLoading: flagsLoading, mutate } = useAdminOrgFlags(orgId);
  const { setOrgFlag } = useAdminFlagActions();

  const onToggle = async (flagName: string, enabled: boolean) => {
    try {
      await setOrgFlag(orgId, flagName, enabled);
      trackEvent(ANALYTICS_EVENTS.ADMIN_FLAG_SET, { flag_name: flagName, enabled });
      await mutate();
    } catch {
      // toast already surfaced in the hook
    }
  };

  if (catalogLoading || flagsLoading) {
    return <Skeleton className="h-48 w-full" data-testid="org-flags-loading" />;
  }

  return (
    <div className="space-y-1">
      {catalog?.map((item) => (
        <div
          key={item.flag_name}
          className="flex items-center justify-between border-b py-3 last:border-b-0"
          data-testid={`org-flag-row-${item.flag_name}`}
        >
          <div>
            <p className="text-sm font-medium">{item.flag_name}</p>
            <p className="text-xs text-muted-foreground">{item.description}</p>
          </div>
          <Switch
            checked={Boolean(flags?.[item.flag_name])}
            onCheckedChange={(checked) => onToggle(item.flag_name, checked)}
            data-testid={`org-flag-switch-${item.flag_name}`}
          />
        </div>
      ))}
    </div>
  );
}
