'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import {
  useAdminFlagCatalog,
  useAdminOrgs,
  useAdminFlagActions,
  type AdminBulkFlagResult,
} from '@/hooks/api/useAdminPortal';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';

/**
 * The portal-wide feature-flags view: turn one flag on/off for a hand-picked group
 * of orgs in a single action. Per-org tab (OrgFlagsPanel) handles one org at a
 * time; this page is for "beta-test with these three partners" style rollouts.
 */
export default function FeatureFlagsPage() {
  const { catalog, isLoading: catalogLoading } = useAdminFlagCatalog();
  const { orgs, isLoading: orgsLoading } = useAdminOrgs();
  const { bulkSetFlag } = useAdminFlagActions();

  const [flagName, setFlagName] = useState('');
  const [selectedOrgIds, setSelectedOrgIds] = useState<string[]>([]);
  const [applying, setApplying] = useState(false);
  const [results, setResults] = useState<AdminBulkFlagResult[] | null>(null);

  const orgItems = useMemo(
    () => (orgs ?? []).map((org) => ({ value: String(org.id), label: org.name })),
    [orgs]
  );
  const orgNameById = useMemo(() => new Map((orgs ?? []).map((org) => [org.id, org.name])), [orgs]);

  const onApply = async (enabled: boolean) => {
    if (!flagName || selectedOrgIds.length === 0) return;
    setApplying(true);
    setResults(null);
    try {
      const orgIds = selectedOrgIds.map(Number);
      const bulkResults = await bulkSetFlag(flagName, orgIds, enabled);
      trackEvent(ANALYTICS_EVENTS.ADMIN_FLAG_BULK_SET, {
        flag_name: flagName,
        enabled,
        org_count: orgIds.length,
      });
      setResults(bulkResults);
    } catch {
      // toast already surfaced in the hook
    } finally {
      setApplying(false);
    }
  };

  if (catalogLoading || orgsLoading) {
    return (
      <div className="p-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-6 h-64 w-full max-w-xl" />
      </div>
    );
  }

  const applyDisabled = applying || !flagName || selectedOrgIds.length === 0;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold mb-1">Feature flags</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Turn a feature on or off for one org, or for several orgs at once.
      </p>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Apply a flag</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
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

          <div className="space-y-2">
            <Label htmlFor="org-picker">Organization(s)</Label>
            <Combobox
              id="org-picker"
              mode="multi"
              items={orgItems}
              values={selectedOrgIds}
              onValuesChange={setSelectedOrgIds}
              placeholder="Select one or more orgs"
            />
          </div>

          <div className="flex gap-3">
            <Button
              onClick={() => onApply(true)}
              disabled={applyDisabled}
              data-testid="flags-turn-on"
            >
              Turn on for selected
            </Button>
            <Button
              variant="outline"
              onClick={() => onApply(false)}
              disabled={applyDisabled}
              data-testid="flags-turn-off"
            >
              Turn off for selected
            </Button>
          </div>
        </CardContent>
      </Card>

      {results && (
        <Card className="mt-6 max-w-2xl" data-testid="flags-bulk-results">
          <CardHeader>
            <CardTitle>Result</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {results.map((result) => (
                <li
                  key={result.org_id}
                  className="flex items-center justify-between text-sm"
                  data-testid={`flags-result-${result.org_id}`}
                >
                  <span>{orgNameById.get(result.org_id) ?? `Org ${result.org_id}`}</span>
                  <span className={result.success ? 'text-primary' : 'text-destructive'}>
                    {result.success ? 'Succeeded' : 'Failed'}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
