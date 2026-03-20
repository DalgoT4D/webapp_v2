'use client';

import { CheckCircle2, Clock3, FileText, Info, Shield } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

interface DashboardChatConsentCardProps {
  featureFlagEnabled: boolean;
  aiDataSharingEnabled: boolean;
  aiDataSharingConsentedAt: string;
  docsGeneratedAt: string;
  vectorLastIngestedAt: string;
  isUpdatingConsent: boolean;
  onConsentChange: (checked: boolean) => void | Promise<void>;
}

interface FreshnessItemProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  iconClassName?: string;
}

function FreshnessItem({ icon: Icon, label, value, iconClassName }: FreshnessItemProps) {
  return (
    <div className="flex items-start gap-2">
      <Icon className={iconClassName || 'mt-0.5 h-4 w-4 text-slate-500'} />
      <div>
        <p className="font-medium text-slate-900">{label}</p>
        <p>{value}</p>
      </div>
    </div>
  );
}

export function DashboardChatConsentCard({
  featureFlagEnabled,
  aiDataSharingEnabled,
  aiDataSharingConsentedAt,
  docsGeneratedAt,
  vectorLastIngestedAt,
  isUpdatingConsent,
  onConsentChange,
}: DashboardChatConsentCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          AI consent
        </CardTitle>
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

        <div className="grid gap-3 rounded-lg border bg-slate-50 p-4 text-sm text-slate-700 md:grid-cols-2">
          <FreshnessItem
            icon={CheckCircle2}
            label="Feature flag"
            value={featureFlagEnabled ? 'Enabled' : 'Disabled'}
            iconClassName="mt-0.5 h-4 w-4 text-emerald-600"
          />
          <FreshnessItem
            icon={Clock3}
            label="Last consent update"
            value={aiDataSharingConsentedAt}
          />
          <FreshnessItem icon={FileText} label="dbt docs refreshed" value={docsGeneratedAt} />
          <FreshnessItem
            icon={Clock3}
            label="Vector context refreshed"
            value={vectorLastIngestedAt}
          />
        </div>

        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          <div className="flex items-start gap-2">
            <Info className="mt-0.5 h-4 w-4" />
            <p>
              Markdown context updates are picked up by the scheduled context build. Allow up to 3
              hours for chat responses to reflect the latest saved context.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
