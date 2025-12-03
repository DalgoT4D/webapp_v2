import useSWR from 'swr';
import { apiGet } from '@/lib/api';

interface AIStatusResponse {
  success: boolean;
  ai_enabled: boolean;
  data_sharing_enabled: boolean;
  logging_acknowledged: boolean;
}

export function useAIStatus() {
  const { data, error, isLoading, mutate } = useSWR<AIStatusResponse>(
    '/api/org-settings/ai-status',
    apiGet,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60000, // Cache for 1 minute
    }
  );

  return {
    aiEnabled: data?.ai_enabled ?? false,
    dataSharingEnabled: data?.data_sharing_enabled ?? false,
    loggingAcknowledged: data?.logging_acknowledged ?? false,
    isLoading,
    error,
    refetch: mutate,
  };
}
