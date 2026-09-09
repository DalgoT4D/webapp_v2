'use client';

import { Building2, Users, Bell, Flag } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminStats } from '@/hooks/api/useAdminPortal';
import { ComingSoonBadge, ADMIN_PLACEHOLDER_DIM } from '@/components/admin/ComingSoonBadge';

function StatCard({
  title,
  icon: Icon,
  value,
  isLoading,
  comingSoon,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  value?: number;
  isLoading?: boolean;
  comingSoon?: boolean;
}) {
  return (
    <Card className={comingSoon ? ADMIN_PLACEHOLDER_DIM : undefined}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {comingSoon ? (
          <ComingSoonBadge />
        ) : isLoading ? (
          <Skeleton className="h-9 w-16" />
        ) : (
          <div className="text-3xl font-semibold">{value ?? 0}</div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminDashboardPage() {
  const { stats, isLoading } = useAdminStats();

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Platform overview</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Orgs"
          icon={Building2}
          value={stats?.total_orgs}
          isLoading={isLoading}
        />
        <StatCard
          title="Total Users"
          icon={Users}
          value={stats?.total_users}
          isLoading={isLoading}
        />
        {/* Deferred features (plan.md §8 #3) — placeholders, not functional, not hidden */}
        <StatCard title="Notifications Sent" icon={Bell} comingSoon />
        <StatCard title="Feature Flags ON" icon={Flag} comingSoon />
      </div>
    </div>
  );
}
