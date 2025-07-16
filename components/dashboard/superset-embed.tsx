'use client';

import { useEffect, useRef, useState } from 'react';
import { embedDashboard } from '@superset-ui/embedded-sdk';
import { apiPost } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface SupersetEmbedProps {
  dashboardId: number;
  dashboardUuid: string;
  className?: string;
}

export function SupersetEmbed({ dashboardId, dashboardUuid, className = '' }: SupersetEmbedProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [embedInstance, setEmbedInstance] = useState<any>(null);

  useEffect(() => {
    let unmounted = false;

    const fetchGuestToken = async (): Promise<string> => {
      try {
        // This function is called automatically by the SDK
        // whenever it needs a fresh token
        const response = await apiPost(`/api/superset/dashboards/${dashboardId}/guest_token/`, {
          dashboard_uuid: dashboardUuid,
        });

        if (unmounted) {
          throw new Error('Component unmounted');
        }

        // Return the token for the SDK to use
        return response.guest_token;
      } catch (error: any) {
        console.error('Failed to fetch guest token:', error);
        setError('Failed to authenticate. Please try refreshing.');
        throw error; // Let SDK handle the error
      }
    };

    // Initialize embedding
    const embed = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Get the Superset domain from the guest token response
        const tokenResponse = await apiPost(
          `/api/superset/dashboards/${dashboardId}/guest_token/`,
          { dashboard_uuid: dashboardUuid }
        );

        if (unmounted) return;

        // Clear any existing content
        if (mountRef.current) {
          mountRef.current.innerHTML = '';
        }

        // Embed the dashboard
        const instance = await embedDashboard({
          id: dashboardUuid,
          supersetDomain: tokenResponse.superset_domain,
          mountPoint: mountRef.current!,
          fetchGuestToken, // SDK will call this automatically when needed
          dashboardUiConfig: {
            // Show dashboard title
            hideTitle: false,
            // Show filter bar expanded
            filters: {
              expanded: true,
              visible: true,
            },
            // Allow chart controls
            hideChartControls: false,
            // URL parameters if needed
            urlParams: {},
          },
          // Enable debug mode in development
          debug: process.env.NODE_ENV === 'development',
        });

        if (!unmounted) {
          setIsLoading(false);
          setEmbedInstance(instance);
        }
      } catch (error: any) {
        if (!unmounted) {
          console.error('Failed to embed dashboard:', error);
          setError(error.message || 'Failed to embed dashboard. Please try again.');
          setIsLoading(false);
        }
      }
    };

    // Start embedding process
    embed();

    return () => {
      unmounted = true;
      // Clean up embedded iframe
      if (mountRef.current) {
        mountRef.current.innerHTML = '';
      }
      // Clean up embed instance if it exists
      if (embedInstance && typeof embedInstance.unmount === 'function') {
        embedInstance.unmount();
      }
    };
  }, [dashboardId, dashboardUuid, embedInstance]);

  const handleRefresh = () => {
    // Re-trigger the embedding process
    window.location.reload();
  };

  if (error) {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center">
              <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
              <h3 className="text-lg font-semibold mb-2">Failed to Load Dashboard</h3>
              <p className="text-sm text-muted-foreground mb-4">{error}</p>
              <Button onClick={handleRefresh} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh Page
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
          <div className="text-center">
            <Skeleton className="h-96 w-full max-w-4xl mb-4" />
            <p className="text-sm text-muted-foreground">Loading dashboard...</p>
          </div>
        </div>
      )}
      {/* The dashboard will be embedded here */}
      <div
        ref={mountRef}
        className="w-full h-full min-h-[600px]"
        style={{
          // Ensure the iframe fills the container
          position: 'relative',
          // Prevent scrollbar issues
          overflow: 'auto',
        }}
      />
    </div>
  );
}
