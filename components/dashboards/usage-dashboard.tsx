'use client';

import { useEffect, useState, useRef } from 'react';
import { apiPost } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

// These should come from environment variables
const USAGE_DASHBOARD_ID = process.env.NEXT_PUBLIC_USAGE_DASHBOARD_ID || '';
const USAGE_DASHBOARD_DOMAIN = process.env.NEXT_PUBLIC_USAGE_DASHBOARD_DOMAIN || '';

export default function UsageDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { currentOrg } = useAuthStore();
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchEmbedToken = async () => {
    try {
      const response = await apiPost(`/api/superset/embed_token/${USAGE_DASHBOARD_ID}/`, {});
      return response.embed_token;
    } catch (err: any) {
      console.error('Failed to fetch embed token:', err);
      throw new Error('Failed to load usage dashboard. Please try again later.');
    }
  };

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const { currentOrg } = useAuthStore.getState();

        if (!currentOrg?.viz_url) {
          setError('You have not subscribed to Superset for Visualisation.');
          setLoading(false);
          return;
        }

        const embedToken = await fetchEmbedToken();

        // Use ref instead of getElementById
        const mountHTMLElement = containerRef.current;

        if (!mountHTMLElement) {
          throw new Error('Dashboard container not found');
        }

        if (!embedToken) {
          throw new Error('No embed token received');
        }

        // Dynamically import the Superset SDK to ensure it only runs on client
        const { embedDashboard } = await import('@superset-ui/embedded-sdk');

        console.log('About to embed dashboard with:', {
          id: USAGE_DASHBOARD_ID,
          domain: USAGE_DASHBOARD_DOMAIN,
          hasToken: !!embedToken,
          hasContainer: !!mountHTMLElement,
        });

        const embedResult = embedDashboard({
          id: USAGE_DASHBOARD_ID,
          supersetDomain: USAGE_DASHBOARD_DOMAIN,
          mountPoint: mountHTMLElement,
          fetchGuestToken: () => embedToken,
          dashboardUiConfig: {
            hideTitle: true,
            filters: {
              expanded: true,
            },
          },
        });

        console.log('Embed result:', embedResult);

        // Check if iframe was created after a short delay
        setTimeout(() => {
          const iframe = mountHTMLElement.querySelector('iframe');
          console.log('Iframe created:', !!iframe);
          if (!iframe) {
            setError('Dashboard failed to load - no iframe created');
          }
        }, 2000);
      } catch (err: any) {
        console.error('Dashboard loading error:', err);
        setError(err.message || 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Loading usage dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen space-y-4">
        <h2 className="text-2xl font-semibold">{error}</h2>
        {!currentOrg?.viz_url && (
          <p className="text-muted-foreground">
            Please contact the Dalgo team at{' '}
            <a href="mailto:support@dalgo.org" className="text-primary underline">
              support@dalgo.org
            </a>{' '}
            for more information
          </p>
        )}
      </div>
    );
  }

  return (
    <main className="usage-dashboard w-full h-screen flex flex-col">
      <div className="flex items-center justify-between p-6 border-b bg-white flex-shrink-0">
        <h1 className="text-3xl font-bold">Usage Dashboard</h1>
      </div>
      <div className="flex-1 p-6 pb-10 overflow-auto">
        <div ref={containerRef} className="w-full h-full bg-white rounded-lg shadow-sm" />
      </div>
    </main>
  );
}
