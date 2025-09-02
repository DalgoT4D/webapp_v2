'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { LayoutDashboard, Plus } from 'lucide-react';
import { useLandingPage } from '@/hooks/api/useLandingPage';
import { useAuthStore } from '@/stores/authStore';
import { DashboardNativeView } from '@/components/dashboard/dashboard-native-view';
import { IndividualDashboardView } from '@/components/dashboard/individual-dashboard-view';
import { useDashboard } from '@/hooks/api/useDashboards';

export default function ImpactAtAGlancePage() {
  const router = useRouter();
  const { getCurrentOrgUser } = useAuthStore();
  const currentUser = getCurrentOrgUser();
  const { resolveLandingPage, isLoading } = useLandingPage();
  const [resolvedDashboard, setResolvedDashboard] = useState<{
    dashboardId: number | null;
    dashboardType: string | null;
    source: string;
  } | null>(null);

  // Fetch dashboard data when we have a resolved dashboard ID
  const { data: dashboard } = useDashboard(resolvedDashboard?.dashboardId || null);

  useEffect(() => {
    const loadLandingPage = async () => {
      if (!currentUser) return;

      try {
        const result = await resolveLandingPage();

        if (result?.dashboard_id) {
          // Set the resolved dashboard to render
          setResolvedDashboard({
            dashboardId: result.dashboard_id,
            dashboardType: result.dashboard_type || 'native', // Default to native
            source: result.source,
          });
        } else {
          // No landing page set - show blank state
          setResolvedDashboard({
            dashboardId: null,
            dashboardType: null,
            source: result?.source || 'none',
          });
        }
      } catch (error) {
        console.error('Error resolving landing page:', error);
        setResolvedDashboard({
          dashboardId: null,
          dashboardType: null,
          source: 'none',
        });
      }
    };

    loadLandingPage();
  }, [currentUser]); // Removed router and resolveLandingPage from dependencies

  // Show loading state while resolving landing page
  if (isLoading || !resolvedDashboard) {
    return (
      <div className="container mx-auto p-6 max-w-2xl">
        <div className="text-center space-y-4">
          <Skeleton className="h-8 w-64 mx-auto" />
          <Skeleton className="h-4 w-96 mx-auto" />
          <div className="space-y-3 mt-8">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-10 w-48 mx-auto" />
          </div>
        </div>
      </div>
    );
  }

  // Render the dashboard directly if we have one
  if (resolvedDashboard.dashboardId) {
    // Show loading while dashboard data is being fetched
    if (!dashboard) {
      return (
        <div className="h-screen flex flex-col bg-gray-50">
          <div className="bg-white border-b px-6 py-4">
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-96" />
          </div>
          <div className="flex-1 p-6">
            <div className="grid grid-cols-12 gap-4">
              <Skeleton className="col-span-6 h-64" />
              <Skeleton className="col-span-6 h-64" />
            </div>
          </div>
        </div>
      );
    }

    // Render appropriate dashboard view based on type with hidden header
    if (dashboard.dashboard_type === 'native') {
      return <DashboardNativeView dashboardId={resolvedDashboard.dashboardId} hideHeader={true} />;
    } else {
      // Superset dashboard
      return (
        <IndividualDashboardView
          dashboardId={resolvedDashboard.dashboardId.toString()}
          hideHeader={true}
        />
      );
    }
  }

  // Show blank state when no landing page is configured
  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <div className="text-center space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Impact at a Glance</h1>
          <p className="text-muted-foreground">
            Your personalized dashboard for quick insights and data overview
          </p>
        </div>

        {/* Main Card */}
        <Card className="border-2 border-dashed border-muted-foreground/25 bg-muted/10">
          <CardHeader className="pb-4">
            <div className="flex justify-center mb-4">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                <LayoutDashboard className="h-8 w-8 text-muted-foreground" />
              </div>
            </div>
            <CardTitle className="text-xl">Your landing page is not set yet</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground leading-relaxed">
              Create a dashboard and set it as your landing page to see your most important insights
              every time you log in.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <Button
                onClick={() => router.push('/dashboards')}
                className="flex items-center gap-2"
                size="lg"
              >
                <LayoutDashboard className="h-4 w-4" />
                Choose a dashboard
              </Button>

              <Button
                onClick={() => router.push('/dashboards/create')}
                variant="outline"
                className="flex items-center gap-2"
                size="lg"
              >
                <Plus className="h-4 w-4" />
                Create new dashboard
              </Button>
            </div>

            {/* Help text */}
            <div className="pt-4 border-t border-muted-foreground/20">
              <p className="text-sm text-muted-foreground">
                <strong>Tip:</strong> Once you have a dashboard, click the "Set as my landing page"
                button to make it appear here automatically.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Additional Info */}
        <div className="text-sm text-muted-foreground space-y-1">
          <p>Looking for specific data?</p>
          <div className="flex flex-wrap gap-2 justify-center">
            <Button
              variant="link"
              size="sm"
              onClick={() => router.push('/charts')}
              className="text-xs"
            >
              Browse Charts
            </Button>
            <span className="text-muted-foreground">•</span>
            <Button
              variant="link"
              size="sm"
              onClick={() => router.push('/data')}
              className="text-xs"
            >
              View Data Sources
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
