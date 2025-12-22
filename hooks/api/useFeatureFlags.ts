import useSWR from 'swr';
import { apiGet } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

export enum FeatureFlagKeys {
  LOG_SUMMARIZATION = 'LOG_SUMMARIZATION',
  EMBED_SUPERSET = 'EMBED_SUPERSET',
  USAGE_DASHBOARD = 'USAGE_DASHBOARD',
  DATA_QUALITY = 'DATA_QUALITY',
  AI_DATA_ANALYSIS = 'AI_DATA_ANALYSIS',
  DATA_STATISTICS = 'DATA_STATISTICS',
  AI_DASHBOARD_CHAT = 'AI_DASHBOARD_CHAT',
}

interface FeatureFlags {
  [key: string]: boolean;
}

interface UseFeatureFlagsReturn {
  flags: FeatureFlags | undefined;
  isLoading: boolean;
  error: any;
  isFeatureFlagEnabled: (flagName: FeatureFlagKeys) => boolean;
}

export const useFeatureFlags = (): UseFeatureFlagsReturn => {
  const { isAuthenticated } = useAuthStore();

  const {
    data: flags,
    error,
    isLoading,
  } = useSWR<FeatureFlags>(isAuthenticated ? '/api/organizations/flags' : null, apiGet, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    dedupingInterval: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const isFeatureFlagEnabled = (flagName: FeatureFlagKeys): boolean => {
    return Boolean(flags?.[flagName]);
  };

  return {
    flags,
    isLoading,
    error,
    isFeatureFlagEnabled,
  };
};
