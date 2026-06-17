'use client';

import { useState } from 'react';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Loader2, Send, CheckCircle2, AlertCircle } from 'lucide-react';
import { testSlackWebhook } from '@/hooks/api/useAlerts';
import { AlertChannel, type AlertType, type RecipientIn } from '@/types/alerts';
import { RecipientCombobox } from './RecipientCombobox';
import { TemplateEditor } from './TemplateEditor';
import { cn } from '@/lib/utils';

export interface AlertNotifyState {
  channels: AlertChannel[];
  slackWebhookUrl: string;
  /**
   * If true, the user has not modified the masked webhook on an edit form,
   * so we should NOT send it on PUT. (Backend keeps the existing URL.)
   */
  slackWebhookUrlIsMasked: boolean;
  messageTemplate: string;
  recipients: RecipientIn[];
}

interface AlertNotifyStepProps {
  value: AlertNotifyState;
  onChange: (next: AlertNotifyState) => void;
  alertType: AlertType;
  errors?: Record<string, string>;
}

/**
 * Channel card — a stacked checkbox header that expands inline when the
 * channel is enabled. Used for both Email and Slack so they render with the
 * same shell.
 */
function ChannelCard({
  checked,
  onCheckedChange,
  title,
  disabled,
  children,
  testId,
}: {
  checked: boolean;
  onCheckedChange?: (v: boolean) => void;
  title: string;
  disabled?: boolean;
  children?: React.ReactNode;
  testId?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-lg border bg-white transition-colors',
        checked ? 'border-gray-300' : 'border-gray-200'
      )}
    >
      <label className={cn('flex items-center gap-3 px-4 py-3', !disabled && 'cursor-pointer')}>
        <Checkbox
          checked={checked}
          disabled={disabled}
          onCheckedChange={(v) => onCheckedChange?.(!!v)}
          data-testid={testId}
        />
        <span className="text-sm font-medium text-gray-900">{title}</span>
      </label>
      {checked && children && <div className="border-t border-gray-200 px-4 py-3">{children}</div>}
    </div>
  );
}

export function AlertNotifyStep({ value, onChange, alertType, errors }: AlertNotifyStepProps) {
  const [testState, setTestState] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState<string | null>(null);

  const setChannel = (channel: AlertChannel, on: boolean) => {
    const next = on
      ? Array.from(new Set([...value.channels, channel]))
      : value.channels.filter((c) => c !== channel);
    onChange({ ...value, channels: next });
  };

  const isEmail = value.channels.includes(AlertChannel.EMAIL);
  const isSlack = value.channels.includes(AlertChannel.SLACK);

  const sendTest = async () => {
    if (!value.slackWebhookUrl.trim()) {
      setTestState('error');
      setTestMessage('Webhook URL is required');
      return;
    }
    setTestState('sending');
    setTestMessage(null);
    try {
      const res = await testSlackWebhook(value.slackWebhookUrl.trim());
      if (res.success) {
        trackEvent(ANALYTICS_EVENTS.ALERT_SLACK_WEBHOOK_TESTED);
        setTestState('success');
        setTestMessage(`Sent — HTTP ${res.http_status}.`);
      } else {
        setTestState('error');
        setTestMessage(
          res.http_status
            ? `Slack returned HTTP ${res.http_status}: ${res.response_body || 'no body'}`
            : res.response_body || 'Network error'
        );
      }
    } catch (err) {
      setTestState('error');
      setTestMessage(err instanceof Error ? err.message : 'Failed to send test message');
    }
  };

  return (
    <div className="space-y-6">
      {/* Delivery channels */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">Delivery channels</p>
        {errors?.channels && <p className="text-xs text-destructive">{errors.channels}</p>}
        <div className="space-y-3">
          <ChannelCard
            checked={isEmail}
            onCheckedChange={(v) => setChannel(AlertChannel.EMAIL, v)}
            title="Email"
            testId="channel-email"
          >
            <div className="space-y-2">
              <RecipientCombobox
                value={value.recipients}
                onChange={(recipients) => onChange({ ...value, recipients })}
              />
              {errors?.recipients && (
                <p className="text-xs text-destructive">{errors.recipients}</p>
              )}
            </div>
          </ChannelCard>

          <ChannelCard
            checked={isSlack}
            onCheckedChange={(v) => setChannel(AlertChannel.SLACK, v)}
            title="Slack"
            testId="channel-slack"
          >
            <div className="space-y-2">
              <Label className="text-xs text-gray-700">
                Slack webhook URL <span className="text-destructive">*</span>
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  value={value.slackWebhookUrl}
                  onChange={(e) => {
                    onChange({
                      ...value,
                      slackWebhookUrl: e.target.value,
                      slackWebhookUrlIsMasked: false,
                    });
                    setTestState('idle');
                    setTestMessage(null);
                  }}
                  placeholder="https://hooks.slack.com/services/T0/B0/XXXXX"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={sendTest}
                  disabled={testState === 'sending'}
                  data-testid="slack-test-btn"
                >
                  {testState === 'sending' ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-1 h-4 w-4" />
                  )}
                  Send test message
                </Button>
              </div>
              {value.slackWebhookUrlIsMasked && (
                <p className="text-[11px] text-muted-foreground">
                  Existing URL is masked for security. Leave as-is to keep it; paste a new URL to
                  replace.
                </p>
              )}
              {testState === 'success' && (
                <div className="flex items-center gap-1.5 text-xs text-green-700">
                  <CheckCircle2 className="h-4 w-4" />
                  {testMessage}
                </div>
              )}
              {testState === 'error' && (
                <div className="flex items-center gap-1.5 text-xs text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  {testMessage}
                </div>
              )}
              {errors?.slack_webhook_url && (
                <p className="text-xs text-destructive">{errors.slack_webhook_url}</p>
              )}
            </div>
          </ChannelCard>
        </div>
      </div>

      {/* Message Template */}
      <TemplateEditor
        value={value.messageTemplate}
        onChange={(messageTemplate) => onChange({ ...value, messageTemplate })}
        alertType={alertType}
      />
      {errors?.message_template && (
        <p className="text-xs text-destructive">{errors.message_template}</p>
      )}
    </div>
  );
}
