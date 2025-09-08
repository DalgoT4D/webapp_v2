'use client';

import useSWR from 'swr';
import { ErrorBoundary } from 'react-error-boundary';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, ExternalLink, Share2, RefreshCw, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { apiGet } from '@/lib/api';
import { SupersetEmbed } from './superset-embed';

interface IndividualDashboardViewProps {
  dashboardId: string;
  hideHeader?: boolean; // Hide header when used as landing page
  showMinimalHeader?: boolean; // Show only title when used as landing page
}

interface Dashboard {
  id: number;
  uuid: string;
  dashboard_title: string;
  slug?: string;
  published: boolean;
  json_metadata?: string;
  position_json?: string;
  css?: string;
  certified_by?: string;
  certification_details?: string;
  changed_on: string;
  changed_on_utc: string;
  changed_on_humanized?: string;
  changed_by?: {
    first_name: string;
    last_name: string;
    username: string;
  };
  owners?: Array<{
    first_name: string;
    last_name: string;
    username: string;
  }>;
  roles?: Array<{
    id: number;
    name: string;
  }>;
  tags?: Array<{
    id: number;
    name: string;
    type: string;
  }>;
  url?: string;
}

function ErrorFallback({ error }: { error: Error }) {
  return (
    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
      <h2 className="text-base font-bold text-red-800">Dashboard Error:</h2>
      <p className="text-sm text-red-600">{error.message}</p>
    </div>
  );
}

export function IndividualDashboardView({
  dashboardId,
  hideHeader = false,
  showMinimalHeader = false,
}: IndividualDashboardViewProps) {
  const router = useRouter();

  // Fetch dashboard details using SWR
  const {
    data: dashboard,
    error,
    mutate,
  } = useSWR<Dashboard>(`/api/superset/dashboards/${dashboardId}/`, apiGet, {
    revalidateOnFocus: false,
    onError: (error) => {
      console.error('Failed to fetch dashboard:', error);
    },
  });

  const isLoading = !dashboard && !error;

  const handleOpenInSuperset = () => {
    if (dashboard?.url) {
      window.open(dashboard.url, '_blank');
    }
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      // TODO: Show success toast
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  const handleRefresh = () => {
    mutate();
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-6 border-b">
          <div className="mb-6">
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-96" />
          </div>
        </div>
        <div className="flex-1 p-6">
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center">
              <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
              <h2 className="text-lg font-semibold mb-2">Error Loading Dashboard</h2>
              <p className="text-sm text-muted-foreground mb-4">
                {error.message || 'Failed to load dashboard'}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => router.push('/dashboards')}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboards
                </Button>
                <Button variant="outline" onClick={handleRefresh}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Dashboard not found</p>
          <Button variant="outline" onClick={() => router.push('/dashboards')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboards
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header - Conditional rendering for landing page */}
      {!hideHeader && !showMinimalHeader && (
        <div className="p-6 border-b">
          <div className="flex items-center justify-between mb-4">
            <Button variant="ghost" onClick={() => router.push('/dashboards')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboards
            </Button>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleShare}>
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>
              <Button variant="outline" size="sm" onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              {dashboard.url && (
                <Button variant="outline" size="sm" onClick={handleOpenInSuperset}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open in Superset
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl font-bold">{dashboard.dashboard_title}</h1>

            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              {dashboard.changed_by && (
                <>
                  <span>
                    Modified by {dashboard.changed_by.first_name} {dashboard.changed_by.last_name}
                  </span>
                  <span>•</span>
                </>
              )}
              <span>
                {dashboard.changed_on_humanized ||
                  (dashboard.changed_on
                    ? format(new Date(dashboard.changed_on), 'MMM d, yyyy h:mm a')
                    : 'Recently')}
              </span>
              {dashboard.published && (
                <>
                  <span>•</span>
                  <Badge variant="default">Published</Badge>
                </>
              )}
              {dashboard.certified_by && (
                <>
                  <span>•</span>
                  <Badge variant="secondary" title={dashboard.certification_details}>
                    Certified
                  </Badge>
                </>
              )}
            </div>

            {dashboard.tags && dashboard.tags.length > 0 && (
              <div className="flex gap-2 mt-2">
                {dashboard.tags.map((tag) => (
                  <Badge key={tag.id} variant="outline">
                    {tag.name}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Minimal Header - Show only title for landing page */}
      {showMinimalHeader && (
        <div className="p-6 border-b">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-2">{dashboard.dashboard_title}</h1>
          </div>
        </div>
      )}

      {/* Dashboard Content - Embedded Superset */}
      <div className="flex-1 overflow-hidden">
        <ErrorBoundary FallbackComponent={ErrorFallback}>
          <SupersetEmbed
            dashboardId={dashboard.id}
            dashboardUuid={dashboard.uuid}
            className="h-full"
          />
        </ErrorBoundary>
      </div>
    </div>
  );
}
