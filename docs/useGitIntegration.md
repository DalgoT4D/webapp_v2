# useGitIntegration Hook Specification

## Overview

Hook for GitHub integration - checking PAT status, fetching repo info, and publishing changes.

**v1 Source:** Canvas.tsx git-related functions

**v2 Target:** `webapp_v2/src/hooks/api/useGitIntegration.ts`

---

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `dbt/dbt_workspace` | GET | Get DBT workspace info (includes git repo URL) |
| `dbt/github/` | POST | Publish changes to GitHub |
| `dbt/github_pat/` | GET | Check PAT status (exists in v1 but may vary) |

---

## Response Types

```typescript
interface DbtWorkspaceResponse {
  gitrepo_url: string;
  // Other workspace properties
}

interface PublishResponse {
  success: boolean;
  commit_sha?: string;
  pr_url?: string;
  message?: string;
}
```

---

## Hook Interface

```typescript
interface UseGitIntegrationReturn {
  /** Git repository URL */
  gitRepoUrl: string;
  /** Whether PAT is required */
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
```

---

## Implementation

```typescript
import useSWR from 'swr';
import { useState, useCallback, useMemo } from 'react';
import { apiGet, apiPost } from '@/lib/api';
import { useTransformStore } from '@/stores/transformStore';

interface DbtWorkspaceResponse {
  gitrepo_url: string;
}

export function useGitIntegration(): UseGitIntegrationReturn {
  const setGitRepoUrl = useTransformStore((s) => s.setGitRepoUrl);
  const setPatRequired = useTransformStore((s) => s.setPatRequired);

  const [isPublishing, setIsPublishing] = useState(false);
  const [patRequired, setPatRequiredLocal] = useState(false);

  const {
    data: workspace,
    error,
    isLoading,
    mutate,
  } = useSWR<DbtWorkspaceResponse>(
    'dbt/dbt_workspace',
    apiGet,
    {
      revalidateOnFocus: false,
      onSuccess: (data) => {
        if (data?.gitrepo_url) {
          setGitRepoUrl(data.gitrepo_url);
        }
      },
    }
  );

  const gitRepoUrl = workspace?.gitrepo_url ?? '';

  const checkPatStatus = useCallback(async (): Promise<boolean> => {
    try {
      // Check if publishing would fail due to missing PAT
      // This could be a dedicated endpoint or inferred from workspace
      const response = await apiGet('dbt/github_pat/');
      const hasToken = !!response?.has_pat;
      setPatRequiredLocal(!hasToken);
      setPatRequired(!hasToken);
      return hasToken;
    } catch (error) {
      // Assume PAT required if check fails
      setPatRequiredLocal(true);
      setPatRequired(true);
      return false;
    }
  }, [setPatRequired]);

  const publishToGithub = useCallback(async (message: string) => {
    setIsPublishing(true);
    try {
      const response = await apiPost<PublishResponse>('dbt/github/', {
        message,
      });
      return response;
    } catch (error: any) {
      // Check if error is due to missing PAT
      if (error.status === 401 || error.message?.includes('PAT')) {
        setPatRequiredLocal(true);
        setPatRequired(true);
      }
      throw error;
    } finally {
      setIsPublishing(false);
    }
  }, [setPatRequired]);

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
```

---

## Usage

### In Canvas Header

```typescript
function CanvasHeader() {
  const { gitRepoUrl, patRequired, isPublishing, publishToGithub } = useGitIntegration();
  const { openPublishModal, openPatModal } = useTransformStore();

  const handlePublishClick = () => {
    if (patRequired) {
      openPatModal();
    } else {
      openPublishModal();
    }
  };

  return (
    <div>
      {gitRepoUrl && (
        <a href={gitRepoUrl} target="_blank" rel="noopener noreferrer">
          <GitHubIcon />
        </a>
      )}
      <Button onClick={handlePublishClick} disabled={isPublishing}>
        Publish
      </Button>
    </div>
  );
}
```

### In Publish Modal

```typescript
function PublishModal() {
  const { publishToGithub, isPublishing } = useGitIntegration();
  const { closePublishModal, triggerRefresh } = useTransformStore();

  const handlePublish = async (message: string) => {
    try {
      await publishToGithub(message);
      toast.success('Changes published successfully');
      closePublishModal();
      triggerRefresh();
    } catch (error) {
      toast.error('Failed to publish changes');
    }
  };

  // ...
}
```

---

## PAT Modal Flow

1. User clicks "Publish"
2. If PAT required, show PAT modal
3. User can:
   - Add PAT key (navigate to settings)
   - Continue in view-only mode
4. After adding PAT, refresh and allow publish

---

## Edge Cases

1. **No git repo configured**: Hide publish button
2. **PAT expired**: Handle 401, show PAT modal
3. **Publish conflict**: Show merge instructions
4. **Network error**: Show retry option

---

## Implementation Checklist

- [ ] Create hook file at `hooks/api/useGitIntegration.ts`
- [ ] Add PAT check on canvas mount
- [ ] Create PublishModal component
- [ ] Create PatRequiredModal component
- [ ] Add toast notifications
- [ ] Test publish flow
- [ ] Test PAT modal flow
