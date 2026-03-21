// hooks/api/useGitIntegration.ts
'use client';

import useSWR from 'swr';
import { useState, useCallback } from 'react';
import { apiGet, apiPost } from '@/lib/api';
import { useTransformStore } from '@/stores/transformStore';

interface DbtWorkspaceResponse {
  gitrepo_url: string;
  default_schema: string;
  target_type?: string;
  transform_type?: string;
  gitrepo_access_token_secret?: string | null;
}

interface PublishResponse {
  success: boolean;
  commit_sha?: string;
  pr_url?: string;
  message?: string;
}

interface UseGitIntegrationReturn {
  /** Git repository URL */
  gitRepoUrl: string;
  /** Whether PAT is required (no token configured) */
  patRequired: boolean;
  /** Loading state */
  isLoading: boolean;
  /** Publishing state */
  isPublishing: boolean;
  /** Check if PAT exists */
  checkPatStatus: () => Promise<boolean>;
  /** Publish changes to GitHub */
  publishToGithub: (message: string) => Promise<PublishResponse>;
  /** Refresh workspace info */
  refreshWorkspace: () => Promise<void>;
}

export function useGitIntegration(): UseGitIntegrationReturn {
  const setGitRepoUrl = useTransformStore((s) => s.setGitRepoUrl);
  const setPatRequired = useTransformStore((s) => s.setPatRequired);

  const [isPublishing, setIsPublishing] = useState(false);
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
      // Only check PAT for GitHub transform type
      if (data?.transform_type === 'github') {
        if ('gitrepo_access_token_secret' in (data || {})) {
          const hasToken = !!data?.gitrepo_access_token_secret;
          setPatRequiredLocal(!hasToken);
          setPatRequired(!hasToken);
        }
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
      // Only check PAT for GitHub transform type
      if (data?.transform_type === 'github') {
        if ('gitrepo_access_token_secret' in (data || {})) {
          const hasToken = !!data?.gitrepo_access_token_secret;
          setPatRequiredLocal(!hasToken);
          setPatRequired(!hasToken);
          return hasToken;
        }
      }
      // Non-GitHub or field not in response — assume PAT is configured
      setPatRequiredLocal(false);
      setPatRequired(false);
      return true;
    } catch (error) {
      // On error, don't block — assume configured
      setPatRequiredLocal(false);
      setPatRequired(false);
      return true;
    }
  }, [setPatRequired, mutate]);

  const publishToGithub = useCallback(
    async (message: string): Promise<PublishResponse> => {
      setIsPublishing(true);
      try {
        const response = await apiPost<PublishResponse>('/api/dbt/github/', {
          message,
        });
        return response;
      } catch (error: unknown) {
        // Check if error is due to missing PAT
        const err = error as { status?: number; message?: string };
        if (err.status === 401 || err.message?.includes('PAT')) {
          setPatRequiredLocal(true);
          setPatRequired(true);
        }
        throw error;
      } finally {
        setIsPublishing(false);
      }
    },
    [setPatRequired]
  );

  const refreshWorkspace = useCallback(async () => {
    await mutate();
  }, [mutate]);

  return {
    gitRepoUrl,
    patRequired,
    isLoading,
    isPublishing,
    checkPatStatus,
    publishToGithub,
    refreshWorkspace,
  };
}
