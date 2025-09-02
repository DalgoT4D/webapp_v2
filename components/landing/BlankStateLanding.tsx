'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Home, ArrowRight, BarChart3, Plus, Database, Layers } from 'lucide-react';
import { useCharts } from '@/hooks/api/useCharts';
import { useDashboards } from '@/hooks/api/useDashboards';

export function BlankStateLanding() {
  const router = useRouter();
  const { data: charts, isLoading: chartsLoading, isError: chartsError } = useCharts();
  const {
    data: dashboards,
    isLoading: dashboardsLoading,
    isError: dashboardsError,
  } = useDashboards();

  const isLoading = chartsLoading || dashboardsLoading;
  const hasCharts = charts && charts.length > 0;
  const hasDashboards = dashboards && dashboards.length > 0;

  if (isLoading) {
    return (
      <div className="container mx-auto p-4 md:p-6">
        <div className="space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64 mx-auto" />
            <Skeleton className="h-4 w-48 mx-auto" />
          </div>
          <div className="grid gap-4 md:grid-cols-2 max-w-4xl mx-auto">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-8">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
          <Home className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Welcome to Impact at a Glance</h1>
          <p className="text-muted-foreground mt-2">
            Your personalized landing page is not set up yet. Let's get you started!
          </p>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid gap-6 md:grid-cols-2 max-w-4xl mx-auto">
        {/* Dashboards Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Layers className="h-5 w-5" />
              Dashboards
              {hasDashboards && (
                <Badge variant="secondary" className="text-xs">
                  {dashboards.length} available
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {hasDashboards ? (
              <>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Great! You have {dashboards.length} dashboard
                    {dashboards.length !== 1 ? 's' : ''} available.
                  </p>
                  <div className="text-xs space-y-1">
                    {dashboards.slice(0, 3).map((dashboard) => (
                      <div key={dashboard.id} className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary/60" />
                        <span className="truncate">{dashboard.dashboard_title}</span>
                      </div>
                    ))}
                    {dashboards.length > 3 && (
                      <div className="text-muted-foreground">+{dashboards.length - 3} more...</div>
                    )}
                  </div>
                </div>
                <Button onClick={() => router.push('/dashboards')} className="w-full">
                  Choose a Landing Dashboard
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <div className="text-xs text-muted-foreground">
                  Visit any dashboard and select <strong>"Set as my landing page"</strong>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  {dashboardsError
                    ? 'Unable to load dashboards. Please try again later.'
                    : 'No dashboards found. Create your first dashboard to get started.'}
                </p>
                {!dashboardsError && (
                  <Button
                    onClick={() => router.push('/dashboards/create')}
                    className="w-full"
                    variant="outline"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Create Dashboard
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Charts Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <BarChart3 className="h-5 w-5" />
              Charts
              {hasCharts && (
                <Badge variant="secondary" className="text-xs">
                  {charts.length} available
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {hasCharts ? (
              <>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    You have {charts.length} chart{charts.length !== 1 ? 's' : ''} ready to use in
                    dashboards.
                  </p>
                  <div className="text-xs space-y-1">
                    {charts.slice(0, 3).map((chart) => (
                      <div key={chart.id} className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500/60" />
                        <span className="truncate">{chart.title}</span>
                        <Badge variant="outline" className="text-xs ml-auto">
                          {chart.chart_type}
                        </Badge>
                      </div>
                    ))}
                    {charts.length > 3 && (
                      <div className="text-muted-foreground">+{charts.length - 3} more...</div>
                    )}
                  </div>
                </div>
                <Button onClick={() => router.push('/charts')} variant="outline" className="w-full">
                  Browse Charts
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  {chartsError
                    ? 'Unable to load charts. Please try again later.'
                    : 'No charts found. Create charts to build dashboards.'}
                </p>
                {!chartsError && (
                  <Button
                    onClick={() => router.push('/charts/new')}
                    variant="outline"
                    className="w-full"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Create Chart
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Getting Started Guide */}
      {!hasDashboards && (
        <Card className="max-w-2xl mx-auto border-dashed">
          <CardContent className="pt-6 text-center space-y-4">
            <Database className="h-12 w-12 mx-auto text-muted-foreground" />
            <div>
              <h3 className="font-semibold mb-2">Get Started in 3 Steps</h3>
              <div className="text-sm text-muted-foreground space-y-2">
                <div className="flex items-center gap-3 text-left max-w-sm mx-auto">
                  <Badge
                    variant="outline"
                    className="w-6 h-6 rounded-full p-0 flex items-center justify-center text-xs"
                  >
                    1
                  </Badge>
                  <span>Connect your data sources or upload data</span>
                </div>
                <div className="flex items-center gap-3 text-left max-w-sm mx-auto">
                  <Badge
                    variant="outline"
                    className="w-6 h-6 rounded-full p-0 flex items-center justify-center text-xs"
                  >
                    2
                  </Badge>
                  <span>Create charts from your data</span>
                </div>
                <div className="flex items-center gap-3 text-left max-w-sm mx-auto">
                  <Badge
                    variant="outline"
                    className="w-6 h-6 rounded-full p-0 flex items-center justify-center text-xs"
                  >
                    3
                  </Badge>
                  <span>Build dashboards and set as landing page</span>
                </div>
              </div>
            </div>
            <Button onClick={() => router.push('/data')} className="mt-4">
              <Database className="mr-2 h-4 w-4" />
              Start with Data
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
