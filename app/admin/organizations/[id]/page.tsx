'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAdminOrg, useAdminOrgActions } from '@/hooks/api/useAdminPortal';
import { OrgUsersTable } from '@/components/admin/OrgUsersTable';

const BASE_PLANS = ['Free Trial', 'Dalgo', 'Internal'];

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b py-3 last:border-b-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{children}</span>
    </div>
  );
}

export default function AdminOrganizationDetailPage() {
  const params = useParams<{ id: string }>();
  const orgId = Number(params.id);
  const { org, isLoading, mutate } = useAdminOrg(Number.isNaN(orgId) ? null : orgId);
  const { updateOrg, deactivateOrg, reactivateOrg } = useAdminOrgActions();

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [vizUrl, setVizUrl] = useState('');
  const [basePlan, setBasePlan] = useState('Free Trial');
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (org) {
      setName(org.name);
      setVizUrl(org.viz_url ?? '');
      setBasePlan(org.base_plan ?? 'Free Trial');
    }
  }, [org]);

  if (isLoading) {
    return (
      <div className="p-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-6 h-64 w-full max-w-xl" />
      </div>
    );
  }

  if (!org) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground">Organization not found.</p>
        <Link href="/admin/organizations" className="mt-2 inline-block text-sm underline">
          Back to organizations
        </Link>
      </div>
    );
  }

  const onSave = async () => {
    setSaving(true);
    try {
      await updateOrg(org.id, {
        name: name.trim() || undefined,
        viz_url: vizUrl.trim() || undefined,
        base_plan: basePlan,
      });
      await mutate();
      setEditing(false);
    } catch {
      // toast already surfaced
    } finally {
      setSaving(false);
    }
  };

  const onToggleActive = async () => {
    setBusy(true);
    try {
      if (org.is_active) {
        await deactivateOrg(org.id);
      } else {
        await reactivateOrg(org.id);
      }
      await mutate();
    } catch {
      // toast already surfaced
    } finally {
      setBusy(false);
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

      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">{org.name}</h1>
          <Badge variant={org.is_active ? 'default' : 'secondary'}>
            {org.is_active ? 'Active' : 'Inactive'}
          </Badge>
        </div>
        <div className="flex gap-2">
          {!editing && (
            <Button variant="outline" onClick={() => setEditing(true)}>
              Edit
            </Button>
          )}
          <Button
            variant={org.is_active ? 'destructive' : 'default'}
            disabled={busy}
            onClick={onToggleActive}
          >
            {org.is_active ? 'Deactivate' : 'Reactivate'}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview" data-testid="org-tab-overview">
            Overview
          </TabsTrigger>
          <TabsTrigger value="users" data-testid="org-tab-users">
            Users
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <Card className="max-w-xl">
            <CardHeader>
              <CardTitle>Overview</CardTitle>
            </CardHeader>
            <CardContent>
              {editing ? (
                <div className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="edit-name">Name</Label>
                    <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-slug">Slug</Label>
                    <Input id="edit-slug" value={org.slug ?? ''} disabled />
                    <p className="text-xs text-muted-foreground">
                      Slug is locked after creation (it’s used in URLs and Airbyte).
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-viz-url">Visualization URL</Label>
                    <Input
                      id="edit-viz-url"
                      type="url"
                      value={vizUrl}
                      onChange={(e) => setVizUrl(e.target.value)}
                      placeholder="https://superset.example.org"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-base-plan">Plan</Label>
                    <Select value={basePlan} onValueChange={setBasePlan}>
                      <SelectTrigger id="edit-base-plan">
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
                  <div className="flex gap-3">
                    <Button onClick={onSave} disabled={saving}>
                      {saving ? 'Saving…' : 'Save changes'}
                    </Button>
                    <Button variant="outline" onClick={() => setEditing(false)} disabled={saving}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  <Fact label="Name">{org.name}</Fact>
                  <Fact label="Slug">{org.slug ?? '—'}</Fact>
                  <Fact label="Plan">{org.base_plan ?? '—'}</Fact>
                  <Fact label="Users">{org.user_count}</Fact>
                  <Fact label="Status">{org.is_active ? 'Active' : 'Inactive'}</Fact>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="mt-6">
          <OrgUsersTable orgId={org.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
