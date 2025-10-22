import useSWR from 'swr';
import { apiGet } from '@/lib/api';

export enum TransformType {
  GITHUB = 'github',
  UI = 'ui',
}

export type TransformTypeValue = 'github' | 'ui';

interface TransformTypeResponse {
  transform_type: TransformTypeValue;
}

export const useTransformType = () => {
  const { data, error, isLoading } = useSWR<TransformTypeResponse>(
    '/api/dbt/dbt_transform',
    apiGet
  );

  return {
    transformType: data?.transform_type,
    isUI: data?.transform_type === TransformType.UI,
    isGithub: data?.transform_type === TransformType.GITHUB,
    isLoading,
    error,
  };
};
