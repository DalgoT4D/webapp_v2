'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAdminOrgActions } from '@/hooks/api/useAdminPortal';
import { EMAIL_RE } from '@/components/admin/constants';
import { isValidVizUrl, VIZ_URL_ERROR } from '@/components/admin/utils';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';

const BASE_PLANS = ['Free Trial', 'Dalgo', 'Internal'];

export default function AdminCreateOrganizationPage() {
  const router = useRouter();
  const { createOrg } = useAdminOrgActions();
  const [name, setName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [vizUrl, setVizUrl] = useState('');
  const [basePlan, setBasePlan] = useState('Free Trial');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ adminEmail?: string; vizUrl?: string }>({});

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !adminEmail.trim()) return;

    // same checks as the edit form on the org detail page — noValidate is set, so
    // neither the email nor the URL field is checked by the browser. A typo in the
    // email means the org's only admin never gets their invitation.
    const nextErrors: { adminEmail?: string; vizUrl?: string } = {};
    if (!EMAIL_RE.test(adminEmail.trim())) {
      nextErrors.adminEmail = 'Invalid email address';
    }
    if (vizUrl.trim() && !isValidVizUrl(vizUrl.trim())) {
      nextErrors.vizUrl = VIZ_URL_ERROR;
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      const org = await createOrg({
        name: name.trim(),
        viz_url: vizUrl.trim() || undefined,
        base_plan: basePlan,
        admin_email: adminEmail.trim(),
      });
      // Success path only. No email or org name — PostHog attaches the person itself,
      // and base_plan is the dimension worth segmenting new orgs by.
      trackEvent(ANALYTICS_EVENTS.ADMIN_ORG_CREATED, { base_plan: basePlan });
      router.push(`/admin/organizations/${org.id}`);
    } catch {
      // toast already surfaced by the action; stay on the form
      setSubmitting(false);
    }
  };

  return (
    <div className="p-8">
      <Link
        href="/admin/organizations"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to organizations
      </Link>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Create organization</CardTitle>
        </CardHeader>
        <CardContent>
          {/* noValidate: our EMAIL_RE check is authoritative — don't let the browser's
              native type=email check preempt the custom message (same as
              InviteUserDialog). */}
          <form onSubmit={onSubmit} className="space-y-5" noValidate>
            <div className="space-y-2">
              <Label htmlFor="org-name">Name</Label>
              <Input
                id="org-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Bhumi"
                required
              />
              <p className="text-xs text-muted-foreground">
                The slug is generated from the name and can’t be changed later.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="org-admin-email">Admin email</Label>
              <Input
                id="org-admin-email"
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="user@example.com"
                className={errors.adminEmail ? 'border-destructive' : ''}
                data-testid="org-admin-email-input"
                required
              />
              {errors.adminEmail && <p className="text-sm text-destructive">{errors.adminEmail}</p>}
              <p className="text-xs text-muted-foreground">
                They’ll be invited as the organization’s Admin and set their own password. An
                organization can’t be created without one.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="org-viz-url">Visualization URL (optional)</Label>
              <Input
                id="org-viz-url"
                type="url"
                value={vizUrl}
                onChange={(e) => setVizUrl(e.target.value)}
                placeholder="https://superset.example.org"
                className={errors.vizUrl ? 'border-destructive' : ''}
                data-testid="org-viz-url-input"
              />
              {errors.vizUrl && <p className="text-sm text-destructive">{errors.vizUrl}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="org-base-plan">Plan</Label>
              <Select value={basePlan} onValueChange={setBasePlan}>
                <SelectTrigger id="org-base-plan">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BASE_PLANS.map((plan) => (
                    <SelectItem key={plan} value={plan}>
                      {plan}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <p className="text-xs text-muted-foreground">
              Creating an organization also provisions its Airbyte workspace, which can take a
              moment and may fail if Airbyte is unavailable.
            </p>

            <div className="flex gap-3">
              <Button
                type="submit"
                disabled={submitting || !name.trim() || !adminEmail.trim()}
                data-testid="create-org-submit"
              >
                {submitting ? 'Creating…' : 'Create organization'}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/admin/organizations">Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
