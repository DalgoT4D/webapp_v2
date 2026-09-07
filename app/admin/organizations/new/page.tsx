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

const BASE_PLANS = ['Free Trial', 'Dalgo', 'Internal'];

export default function AdminCreateOrganizationPage() {
  const router = useRouter();
  const { createOrg } = useAdminOrgActions();
  const [name, setName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [vizUrl, setVizUrl] = useState('');
  const [basePlan, setBasePlan] = useState('Free Trial');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ adminEmail?: string }>({});

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !adminEmail.trim()) return;

    // same check as the Users-tab invite dialog — a typo here means the org's only
    // admin never gets their invitation
    if (!EMAIL_RE.test(adminEmail.trim())) {
      setErrors({ adminEmail: 'Invalid email address' });
      return;
    }
    setErrors({});

    setSubmitting(true);
    try {
      const org = await createOrg({
        name: name.trim(),
        viz_url: vizUrl.trim() || undefined,
        base_plan: basePlan,
        admin_email: adminEmail.trim(),
      });
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
              />
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
