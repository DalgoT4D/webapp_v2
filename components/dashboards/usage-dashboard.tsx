'use client';

import { use, useEffect, useState } from 'react';
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
  const [mount, setMount] = useState<boolean>(false);

  console.log('UsageDashboard render:', { loading, error, mount, hasCurrentOrg: !!currentOrg });

  useEffect(() => {
    if (!mount) setMount(true);
  }, []);

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
    if (!mount) return;

    if (!currentOrg?.viz_url) {
      setError('You have not subscribed to Superset for Visualisation.');
      setLoading(false);
      return;
    }

    const loadDashboard = async () => {
      try {
        const embedToken = await fetchEmbedToken();

        // Wait for DOM element to be available
        let mountHTMLElement = null;
        let attempts = 0;
        while (!mountHTMLElement && attempts < 10) {
          mountHTMLElement = document.getElementById('dashboard-container');
          if (!mountHTMLElement) {
            await new Promise((resolve) => setTimeout(resolve, 100));
            attempts++;
          }
        }

        if (mountHTMLElement && embedToken) {
          console.log('Embedding dashboard with:', {
            id: USAGE_DASHBOARD_ID,
            domain: USAGE_DASHBOARD_DOMAIN,
            element: mountHTMLElement,
            token: embedToken.substring(0, 20) + '...',
          });

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

          // Check for iframe after embedding
          setTimeout(() => {
            const iframe = mountHTMLElement.querySelector('iframe');
            console.log('Iframe check:', {
              hasIframe: !!iframe,
              containerChildren: mountHTMLElement.children.length,
              containerHTML: mountHTMLElement.innerHTML.substring(0, 200),
            });
          }, 3000);
        } else {
          console.log('Missing requirements:', {
            hasElement: !!mountHTMLElement,
            hasToken: !!embedToken,
          });
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, [mount, currentOrg]);

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

  console.log('Rendering main dashboard component');

  return (
    <main className="usage-dashboard w-full h-screen flex flex-col">
      <div className="flex items-center justify-between p-6 border-b bg-white flex-shrink-0">
        <h1 className="text-3xl font-bold">Usage Dashboard</h1>
        <div className="text-sm text-gray-500">DEBUG: Component loaded successfully</div>
      </div>
      <div className="flex-1 p-6 pb-10 overflow-auto">
        <div
          id="dashboard-container"
          className="w-full h-full bg-white rounded-lg shadow-sm border-2 border-red-500"
        />
      </div>
    </main>
  );
}
