'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

interface DashboardChatConsentCardProps {
  aiDataSharingEnabled: boolean;
  sharePiiWithLlms: boolean;
  aiDataSharingConsentedAt: string;
  metadataLastBuiltAt: string;
  isUpdatingConsent: boolean;
  isUpdatingPiiSharing: boolean;
  onConsentChange: (checked: boolean) => void | Promise<void>;
  onPiiSharingChange: (checked: boolean) => void | Promise<void>;
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
  sharePiiWithLlms,
  aiDataSharingConsentedAt,
  metadataLastBuiltAt,
  isUpdatingConsent,
  isUpdatingPiiSharing,
  onConsentChange,
  onPiiSharingChange,
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
            data-testid="ai-consent-toggle"
            checked={aiDataSharingEnabled}
            disabled={isUpdatingConsent}
            onCheckedChange={onConsentChange}
          />
        </div>

        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-1">
            <Label htmlFor="pii-sharing-toggle" className="text-base font-medium">
              Share PII with LLMs
            </Label>
            <p className="text-sm text-muted-foreground">
              Keep this on to send raw PII values to AI models. Turn it off after reviewing the PII
              column list below; runtime queries will mask reviewed PII columns before model calls.
            </p>
          </div>
          <Switch
            id="pii-sharing-toggle"
            data-testid="pii-sharing-toggle"
            checked={sharePiiWithLlms}
            disabled={!aiDataSharingEnabled || isUpdatingPiiSharing}
            onCheckedChange={onPiiSharingChange}
          />
        </div>

        <div className="grid gap-2 rounded-lg border bg-slate-50 p-4 md:grid-cols-2">
          <FreshnessItem label="Last consent update" value={aiDataSharingConsentedAt} />
          <FreshnessItem label="Metadata last built" value={metadataLastBuiltAt} />
        </div>

        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          <p>
            Organization and dashboard context changes do not affect chat until dashboard metadata
            is rebuilt. Use the metadata build controls below after changing context or dashboards.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
