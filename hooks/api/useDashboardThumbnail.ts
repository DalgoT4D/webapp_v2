import { useState, useEffect } from 'react';
import { apiPostBinary } from '@/lib/api';

interface UseDashboardThumbnailOptions {
  dashboardId: number;
  thumbnailUrl?: string;
  enabled?: boolean;
}

export function useDashboardThumbnail({
  dashboardId,
  thumbnailUrl,
  enabled = true,
}: UseDashboardThumbnailOptions) {
  const [thumbnailDataUrl, setThumbnailDataUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!enabled || !dashboardId) {
      return () => {}; // Return empty cleanup function
    }

    let objectUrl: string | null = null;

    const fetchThumbnail = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const blob = await apiPostBinary(`/api/superset/dashboards/${dashboardId}/thumbnail/`, {
          thumbnail_url: thumbnailUrl || `dashboard-${dashboardId}`,
        });

        // Convert blob to object URL
        objectUrl = URL.createObjectURL(blob);
        setThumbnailDataUrl(objectUrl);
      } catch (err) {
        setError(err as Error);
        setThumbnailDataUrl(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchThumbnail();

    // Cleanup function to revoke object URL
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [dashboardId, thumbnailUrl, enabled]);

  return { thumbnailDataUrl, isLoading, error };
}
