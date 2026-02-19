import useSWR from 'swr';
import { apiGet } from '@/lib/api';
import { ElementarySetupStatusResponse } from '@/components/data-quality/types';

export function useElementaryStatus() {
  const { data, error, mutate, isLoading } = useSWR<ElementarySetupStatusResponse>(
    '/api/dbt/elementary-setup-status',
    apiGet,
    {
      revalidateOnFocus: false,
      shouldRetryOnError: false,
    }
  );

  return {
    status: data?.status ?? null,
    isLoading,
    error,
    mutate,
  };
}
