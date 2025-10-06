'use client';

import { useEffect, useState } from 'react';
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
    if (!currentOrg?.viz_url) {
      setError('You have not subscribed to Superset for Visualisation.');
      setLoading(false);
      return;
    }

    const loadDashboard = async () => {
      try {
        const embedToken = await fetchEmbedToken();
        const mountHTMLElement = document.getElementById('dashboard-container');

        if (mountHTMLElement && embedToken) {
          embedDashboard({
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
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, [currentOrg]);

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
    <main className="w-full h-screen p-12 pb-20 overflow-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Usage Dashboard</h1>
      </div>
      <div
        id="dashboard-container"
        className="w-full overflow-auto"
        style={{
          height: 'calc(100vh - 200px)',
          width: '100%',
        }}
      />
      <style jsx global>{`
        #dashboard-container {
          overflow: auto;
        }
        #dashboard-container iframe {
          height: 100vh !important;
          width: 120% !important;
          border: none !important;
          transform: scale(0.8, 0.8);
          transform-origin: 0 0;
          min-height: 800px;
        }
      `}</style>
    </main>
  );
}
