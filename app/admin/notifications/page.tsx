'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Combobox } from '@/components/ui/combobox';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { renderMessageWithLinks } from '@/lib/notificationMessage';
import {
  useAdminOrgs,
  useAdminNotifications,
  useAdminNotificationActions,
} from '@/hooks/api/useAdminPortal';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';

type AudienceMode = 'whole_platform' | 'orgs';

/**
 * The broadcast composer + sent-broadcast history. Audience is whole platform, one
 * org, or several orgs at once — resolved server-side into ONE merged recipient list,
 * never a per-org breakdown. Channels (in-app / email) are admin-chosen per broadcast;
 * at least one must be on, enforced here AND server-side.
 * Immediate send only — no scheduling, no cancel (plan.md Milestone 2).
 */
export default function NotificationsPage() {
  const { orgs, isLoading: orgsLoading } = useAdminOrgs();
  const {
    notifications,
    isLoading: historyLoading,
    mutate: mutateHistory,
  } = useAdminNotifications();
  const { previewRecipients, sendNotification } = useAdminNotificationActions();

  const [message, setMessage] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [urgent, setUrgent] = useState(false);
  const [audienceMode, setAudienceMode] = useState<AudienceMode>('whole_platform');
  const [selectedOrgIds, setSelectedOrgIds] = useState<string[]>([]);
  const [sendInApp, setSendInApp] = useState(true);
  const [sendEmail, setSendEmail] = useState(true);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [sending, setSending] = useState(false);

  const orgItems = useMemo(
    () => (orgs ?? []).map((org) => ({ value: String(org.id), label: org.name })),
    [orgs]
  );
  const orgIds = audienceMode === 'orgs' ? selectedOrgIds.map(Number) : undefined;
  const orgIdsKey = orgIds ? orgIds.join(',') : '';

  useEffect(() => {
    if (audienceMode === 'orgs' && selectedOrgIds.length === 0) {
      setPreviewCount(null);
      return undefined; // explicit: the other path returns a cleanup fn (TS7030)
    }
    let cancelled = false;
    setPreviewCount(null);
    previewRecipients(orgIds)
      .then((preview) => {
        if (!cancelled) setPreviewCount(preview.recipient_count);
      })
      .catch(() => {
        if (!cancelled) setPreviewCount(null);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audienceMode, orgIdsKey]);

  const audienceReady = audienceMode === 'whole_platform' || selectedOrgIds.length > 0;
  const canSend =
    !sending &&
    message.trim().length > 0 &&
    emailSubject.trim().length > 0 &&
    (sendInApp || sendEmail) &&
    audienceReady &&
    previewCount !== null &&
    previewCount > 0;

  const handleAudienceModeChange = (value: string) => {
    setAudienceMode(value as AudienceMode);
    setSelectedOrgIds([]);
  };

  const handleSend = async () => {
    setSending(true);
    try {
      const created = await sendNotification({
        message,
        email_subject: emailSubject,
        urgent,
        org_ids: orgIds,
        send_in_app: sendInApp,
        send_email: sendEmail,
      });
      trackEvent(ANALYTICS_EVENTS.ADMIN_BROADCAST_SENT, {
        org_count: orgIds?.length ?? 0,
        recipient_count: created.recipient_count,
      });
      setMessage('');
      setEmailSubject('');
      setUrgent(false);
      setAudienceMode('whole_platform');
      setSelectedOrgIds([]);
      mutateHistory();
    } catch {
      // toast already surfaced by the hook
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold mb-1">Notifications</h1>
        <p className="text-sm text-muted-foreground">
          Send a broadcast to the whole platform, one org, or several orgs at once.
        </p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>New broadcast</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="broadcast-subject">Subject</Label>
            <Input
              id="broadcast-subject"
              data-testid="broadcast-subject"
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="broadcast-message">Message</Label>
            <Textarea
              id="broadcast-message"
              data-testid="broadcast-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="broadcast-urgent"
              data-testid="broadcast-urgent"
              checked={urgent}
              onCheckedChange={(checked) => setUrgent(checked === true)}
            />
            <Label htmlFor="broadcast-urgent">Mark as urgent</Label>
          </div>

          <div className="space-y-3">
            <Label>Audience</Label>
            <RadioGroup value={audienceMode} onValueChange={handleAudienceModeChange}>
              <div className="flex items-center gap-2">
                <RadioGroupItem
                  value="whole_platform"
                  id="audience-whole-platform"
                  data-testid="audience-whole-platform"
                />
                <Label htmlFor="audience-whole-platform">Whole platform</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="orgs" id="audience-orgs" data-testid="audience-orgs" />
                <Label htmlFor="audience-orgs">One or more organizations</Label>
              </div>
            </RadioGroup>

            {audienceMode === 'orgs' && (
              <div className="space-y-2">
                <Label htmlFor="broadcast-org-picker">Organization(s)</Label>
                <Combobox
                  id="broadcast-org-picker"
                  mode="multi"
                  items={orgItems}
                  values={selectedOrgIds}
                  onValuesChange={setSelectedOrgIds}
                  placeholder="Select one or more orgs"
                  loading={orgsLoading}
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Channels</Label>
            <div className="flex items-center gap-2">
              <Checkbox
                id="broadcast-send-in-app"
                data-testid="broadcast-send-in-app"
                checked={sendInApp}
                onCheckedChange={(checked) => setSendInApp(checked === true)}
              />
              <Label htmlFor="broadcast-send-in-app">In-app</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="broadcast-send-email"
                data-testid="broadcast-send-email"
                checked={sendEmail}
                onCheckedChange={(checked) => setSendEmail(checked === true)}
              />
              <Label htmlFor="broadcast-send-email">Email (only for recipients who opted in)</Label>
            </div>
          </div>

          <div className="text-sm text-muted-foreground" data-testid="broadcast-preview-count">
            {!audienceReady
              ? 'Select at least one organization'
              : previewCount === null
                ? 'Calculating recipients…'
                : `Reaches ${previewCount} people`}
          </div>

          <Button onClick={handleSend} disabled={!canSend} data-testid="broadcast-send">
            Send broadcast
          </Button>
        </CardContent>
      </Card>

      <Card className="max-w-4xl">
        <CardHeader>
          <CardTitle>History</CardTitle>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Message</TableHead>
                  <TableHead>Audience</TableHead>
                  <TableHead>Channels</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Recipients</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(notifications ?? []).map((notification) => (
                  <TableRow
                    key={notification.id}
                    data-testid={`notification-history-row-${notification.id}`}
                  >
                    <TableCell className="max-w-xs whitespace-normal break-words">
                      {renderMessageWithLinks(notification.message)}
                      {notification.urgent && (
                        <Badge variant="destructive" className="ml-2">
                          Urgent
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {notification.target_org_names && notification.target_org_names.length > 0
                        ? notification.target_org_names.join(', ')
                        : 'Whole platform'}
                    </TableCell>
                    <TableCell>
                      {[
                        notification.send_in_app ? 'In-app' : null,
                        notification.send_email ? 'Email' : null,
                      ]
                        .filter(Boolean)
                        .join(' + ')}
                    </TableCell>
                    <TableCell>
                      {notification.sent_time
                        ? formatDistanceToNow(new Date(notification.sent_time), {
                            addSuffix: true,
                          })
                        : '—'}
                    </TableCell>
                    <TableCell>{notification.recipient_count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
