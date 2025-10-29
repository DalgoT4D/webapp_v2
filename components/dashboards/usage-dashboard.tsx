'use client';

import { useEffect, useState, useRef } from 'react';
import { embedDashboard } from '@superset-ui/embedded-sdk';
import { apiPost } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

// These should come from environment variables
const USAGE_DASHBOARD_ID = process.env.NEXT_PUBLIC_USAGE_DASHBOARD_ID || '';
const USAGE_DASHBOARD_DOMAIN = process.env.NEXT_PUBLIC_USAGE_DASHBOARD_DOMAIN || '';

export default function UsageDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { currentOrg } = useAuthStore();
  const containerRef = useRef<HTMLDivElement | null>(null);

  const fetchEmbedToken = async () => {
    try {
      const response = await apiPost(`/api/superset/embed_token/${USAGE_DASHBOARD_ID}/`, {});
      console.log('Embed token response:', response);
      return response.embed_token;
    } catch (err: any) {
      console.error('Failed to fetch embed token:', err);
      throw new Error('Failed to load usage dashboard. Please try again later.');
    }
  };

  useEffect(() => {
    if (!currentOrg?.viz_url) {
      setError('You have not subscribed to Superset for Visualisation.');
      setLoading(false);
      return;
    }

    const loadDashboard = async () => {
      try {
        const embedToken = await fetchEmbedToken();
        const mountHTMLElement = containerRef.current;

        if (mountHTMLElement && embedToken) {
          // ensure fetchGuestToken returns a Promise
          try {
            const result = await embedDashboard({
              id: USAGE_DASHBOARD_ID,
              supersetDomain: USAGE_DASHBOARD_DOMAIN,
              mountPoint: mountHTMLElement,
              fetchGuestToken: async () => embedToken,
              dashboardUiConfig: {
                hideTitle: true,
                filters: {
                  expanded: true,
                },
              },
              debug: true,
            });

            // extra check after a short delay to ensure iframe was created
            setTimeout(() => {
              const iframe = mountHTMLElement.querySelector('iframe');
              console.log('Iframe created:', !!iframe, iframe);
              if (!iframe) {
                console.error(
                  'No iframe found — mount point innerHTML:',
                  mountHTMLElement.innerHTML
                );
                setError('Dashboard failed to load - no iframe created');
              }
            }, 4000);
          } catch (sdkErr) {
            console.error('embedDashboard threw:', sdkErr);
            setError((sdkErr as any)?.message || 'Failed to embed dashboard');
          }
        }
      } catch (err: any) {
        console.error('Dashboard loading error:', err);
        setError(err.message || 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    };

    // small delay to ensure DOM has rendered
    loadDashboard();
  }, [currentOrg]);

  return (
    <main className="usage-dashboard w-full h-screen flex flex-col">
      <div className="flex items-center justify-between p-6 border-b bg-white flex-shrink-0">
        <h1 className="text-3xl font-bold">Usage Dashboard</h1>
      </div>
      <div className="flex-1 p-6 pb-10 overflow-auto relative">
        {/* always render the container so ref is available */}
        <div
          ref={containerRef}
          id="dashboard-container"
          className="w-full h-full bg-white rounded-lg shadow-sm"
        />

        {/* loading overlay */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80">
            <div className="text-lg">Loading usage dashboard...</div>
          </div>
        )}

        {/* error overlay */}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4">
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
        )}
      </div>
    </main>
  );
}
