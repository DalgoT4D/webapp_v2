'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

interface DashboardChatConsentCardProps {
  aiDataSharingEnabled: boolean;
  aiDataSharingConsentedAt: string;
  vectorLastIngestedAt: string;
  isUpdatingConsent: boolean;
  onConsentChange: (checked: boolean) => void | Promise<void>;
}

interface FreshnessItemProps {
  label: string;
  value: string;
}

function FreshnessItem({ label, value }: FreshnessItemProps) {
  return (
    <p className="text-sm text-slate-700">
      <span className="font-medium text-slate-900">{label}:</span> {value}
    </p>
  );
}

export function DashboardChatConsentCard({
  aiDataSharingEnabled,
  aiDataSharingConsentedAt,
  vectorLastIngestedAt,
  isUpdatingConsent,
  onConsentChange,
}: DashboardChatConsentCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>AI consent</CardTitle>
        <CardDescription>
          Turn on organization-wide consent before users can chat with dashboards.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-1">
            <Label htmlFor="ai-consent-toggle" className="text-base font-medium">
              I consent to share data with AI
            </Label>
            <p className="text-sm text-muted-foreground">
              This enables Chat with Dashboards for your organization once context has been
              prepared.
            </p>
          </div>
          <Switch
            id="ai-consent-toggle"
            checked={aiDataSharingEnabled}
            disabled={isUpdatingConsent}
            onCheckedChange={onConsentChange}
          />
        </div>

        <div className="grid gap-2 rounded-lg border bg-slate-50 p-4 md:grid-cols-2">
          <FreshnessItem label="Last consent update" value={aiDataSharingConsentedAt} />
          <FreshnessItem label="Dalgo AI context refreshed" value={vectorLastIngestedAt} />
        </div>

        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          <p>
            Organization and dashboard context changes appear in Dalgo AI after the next context
            refresh. Allow up to 3 hours for saved updates to show up in chat.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
