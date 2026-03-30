# PatRequiredModal Specification

## Overview

Modal for GitHub Personal Access Token (PAT) authentication required for git operations.

**v1 Source:** `webapp/src/components/TransformWorkflow/FlowEditor/Components/PatRequiredModal.tsx` (~144 lines)

**v2 Target:** `webapp_v2/src/components/transform/modals/PatRequiredModal.tsx`

**Complexity:** Low

---

## Visual Design

```
┌─────────────────────────────────────────────────────┐
│ Git Authentication Required                       ✕ │
├─────────────────────────────────────────────────────┤
│ Add your Personal Access Token to make changes to  │
│ this workspace. You can view the canvas without    │
│ authentication, but you'll need a Personal Access  │
│ Token to make changes or publish to Git.           │
│                                                     │
│ GitHub repo URL                                     │
│ [https://github.com/org/repo.git    ] (disabled)   │
│                                                     │
│ Personal Access Token                               │
│ [••••••••••••••••••••••••••••••••••]               │
│ Need a token? Create one on GitHub ↗               │
│                                                     │
│ ┌─────────────────────────────────────────────────┐ │
│ │               Connect                           │ │
│ └─────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────┐ │
│ │         Proceed without token                   │ │
│ └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

---

## API Endpoints

### Connect Git Remote
```typescript
PUT dbt/connect_git_remote/
{
  "gitrepoUrl": "https://github.com/org/repo.git",
  "gitrepoAccessToken": "ghp_xxxxxxxxxxxx"
}
// Response: { "success": true }
```

---

## Props Interface

```typescript
interface PatRequiredModalProps {
  open: boolean;
  onClose: () => void;
  onAddKey: () => void;       // Called after successful PAT submission
  onViewOnly: () => void;     // Called when user chooses to proceed without token
  gitRepoUrl: string;         // Pre-filled, read-only
}
```

---

## Implementation

```typescript
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { X, ExternalLink } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiPut } from '@/lib/api';
import { toast } from 'sonner';

interface PatRequiredModalProps {
  open: boolean;
  onClose: () => void;
  onAddKey: () => void;
  onViewOnly: () => void;
  gitRepoUrl: string;
}

interface PatFormData {
  gitrepoAccessToken: string;
}

export default function PatRequiredModal({
  open,
  onClose,
  onAddKey,
  onViewOnly,
  gitRepoUrl,
}: PatRequiredModalProps) {
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PatFormData>();

  const onSubmit = async (data: PatFormData) => {
    setLoading(true);
    try {
      await apiPut('dbt/connect_git_remote/', {
        gitrepoUrl: gitRepoUrl,
        gitrepoAccessToken: data.gitrepoAccessToken,
      });

      toast.success('Personal Access Token added successfully');
      reset();
      onAddKey();
      onClose();
    } catch (error: any) {
      console.error('Error adding PAT:', error);
      toast.error(error.message || 'Failed to add Personal Access Token');
    } finally {
      setLoading(false);
    }
  };

  const handleViewOnly = () => {
    reset();
    onViewOnly();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleViewOnly()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            Git Authentication Required
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Add your Personal Access Token to make changes to this workspace. You can view
            the canvas without authentication, but you'll need a Personal Access Token to
            make changes or publish to Git.
          </p>

          {/* Git Repo URL (read-only) */}
          <div className="space-y-2">
            <Label htmlFor="gitRepoUrl">GitHub repo URL</Label>
            <Input
              id="gitRepoUrl"
              value={gitRepoUrl}
              disabled
              className="bg-muted"
            />
          </div>

          {/* Personal Access Token */}
          <div className="space-y-2">
            <Label htmlFor="gitrepoAccessToken">Personal Access Token</Label>
            <Input
              id="gitrepoAccessToken"
              type="password"
              placeholder="Enter your GitHub Personal Access Token"
              disabled={loading}
              autoFocus
              {...register('gitrepoAccessToken', {
                required: 'Personal Access Token is required',
              })}
            />
            {errors.gitrepoAccessToken && (
              <p className="text-sm text-red-500">
                {errors.gitrepoAccessToken.message}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Need a token?{' '}
              <a
                href="https://github.com/settings/tokens"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                Create one on GitHub
                <ExternalLink className="w-3 h-3" />
              </a>
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 pt-4">
            <Button
              type="submit"
              disabled={loading}
              className="w-full"
              data-testid="connect-btn"
            >
              {loading ? 'Connecting...' : 'Connect'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleViewOnly}
              disabled={loading}
              className="w-full"
              data-testid="view-only-btn"
            >
              Proceed without token
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

---

## State Management

The modal is controlled by the parent component (Canvas) via:
- `patModalOpen` state in canvasStore
- Triggered when user attempts to make changes without PAT

---

## Key Features

1. **Controlled modal**: Open/close controlled by parent
2. **PAT validation**: Required field validation
3. **Two exit paths**: Connect with PAT or proceed in view-only mode
4. **External link**: Direct link to GitHub token creation
5. **Loading state**: Disable inputs during submission

---

## Integration Points

Called from Canvas when:
- User attempts to edit without PAT
- User attempts to publish without PAT
- After successful connection, triggers lock acquisition

---

## Implementation Checklist

- [ ] Create modal component
- [ ] Implement form with react-hook-form
- [ ] Add PAT input with password type
- [ ] Add Connect button with API call
- [ ] Add View Only button
- [ ] Handle loading states
- [ ] Add external link to GitHub
- [ ] Style with Tailwind
- [ ] Add data-testid attributes
