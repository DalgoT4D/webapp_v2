// hooks/api/useGitIntegration.ts
'use client';

import useSWR from 'swr';
import { useState, useCallback } from 'react';
import { apiGet } from '@/lib/api';
import { useTransformStore } from '@/stores/transformStore';

interface DbtWorkspaceResponse {
  gitrepo_url: string;
  default_schema: string;
  target_type?: string;
  transform_type?: string;
  gitrepo_access_token?: string | null;
}

interface UseGitIntegrationReturn {
  /** Git repository URL */
  gitRepoUrl: string;
  /** Whether PAT is required (no token configured) */
  patRequired: boolean;
  /** Loading state */
  isLoading: boolean;
  /** Check if PAT exists */
  checkPatStatus: () => Promise<boolean>;
  /** Refresh workspace info */
  refreshWorkspace: () => Promise<void>;
}

export function useGitIntegration(): UseGitIntegrationReturn {
  const setGitRepoUrl = useTransformStore((s) => s.setGitRepoUrl);
  const setPatRequired = useTransformStore((s) => s.setPatRequired);

  const [patRequired, setPatRequiredLocal] = useState(false);

  const {
    data: workspace,
    isLoading,
    mutate,
  } = useSWR<DbtWorkspaceResponse>('/api/dbt/dbt_workspace', apiGet, {
    revalidateOnFocus: false,
    onSuccess: (data) => {
      if (data?.gitrepo_url) {
        setGitRepoUrl(data.gitrepo_url);
      }
      // Only GitHub transform type needs PAT — matches v1 Canvas behavior:
      // needsPAT = transform_type === 'github' && gitrepo_access_token === null
      if (data?.transform_type === 'github') {
        const hasToken =
          data?.gitrepo_access_token !== null && data?.gitrepo_access_token !== undefined;
        setPatRequiredLocal(!hasToken);
        setPatRequired(!hasToken);
      } else {
        // Non-GitHub transform types don't need PAT
        setPatRequiredLocal(false);
        setPatRequired(false);
      }
    },
  });

  const gitRepoUrl = workspace?.gitrepo_url ?? '';

  const checkPatStatus = useCallback(async (): Promise<boolean> => {
    try {
      // Re-fetch workspace to check PAT status
      const data = await mutate();
      // Only GitHub transform type needs PAT and remote sync
      if (data?.transform_type === 'github') {
        const hasToken =
          data?.gitrepo_access_token !== null && data?.gitrepo_access_token !== undefined;
        setPatRequiredLocal(!hasToken);
        setPatRequired(!hasToken);
        return hasToken;
      }
      // Non-GitHub transform types don't have a git remote — no PAT needed, no sync needed.
      // Return true so the caller doesn't treat this as "missing token".
      setPatRequiredLocal(false);
      setPatRequired(false);
      return true;
    } catch (error) {
      // On error, don't block canvas — but don't attempt sync either
      setPatRequiredLocal(false);
      setPatRequired(false);
      return false;
    }
  }, [setPatRequired, mutate]);

  const refreshWorkspace = useCallback(async () => {
    await mutate();
  }, [mutate]);

  return {
    gitRepoUrl,
    patRequired,
    isLoading,
    checkPatStatus,
    refreshWorkspace,
  };
}
