# PublishModal Specification

## Overview

Modal for publishing changes to git with commit message and git status review.

**v1 Source:** `webapp/src/components/TransformWorkflow/FlowEditor/Components/PublishModal.tsx` (~285 lines)

**v2 Target:** `webapp_v2/src/components/transform/modals/PublishModal.tsx`

**Complexity:** Medium

---

## Visual Design

```
┌─────────────────────────────────────────────────────┐
│ Publish Changes                                     │
│ Review your changes and provide a commit message    │
│ to publish to git                                   │
├─────────────────────────────────────────────────────┤
│ Changes to be published:                            │
│ ┌─────────────────────────────────────────────────┐ │
│ │ Added (2)                                       │ │
│ │   + models/staging/stg_orders.sql               │ │
│ │   + models/staging/stg_customers.sql            │ │
│ │                                                 │ │
│ │ Modified (1)                                    │ │
│ │   ~ models/marts/dim_products.sql               │ │
│ │                                                 │ │
│ │ Deleted (1)                                     │ │
│ │   - models/staging/stg_old_orders.sql           │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ ─────────────────────────────────────────────────── │
│                                                     │
│ Commit message: *                                   │
│ ┌─────────────────────────────────────────────────┐ │
│ │ Enter a descriptive commit message...           │ │
│ │                                                 │ │
│ │                                                 │ │
│ └─────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────┤
│                        [Cancel]  [Publish Changes]  │
└─────────────────────────────────────────────────────┘
```

---

## API Endpoints

### Fetch Git Status
```typescript
GET dbt/git_status/
// Response: {
//   "added": ["models/staging/stg_orders.sql", "models/staging/stg_customers.sql"],
//   "modified": ["models/marts/dim_products.sql"],
//   "deleted": ["models/staging/stg_old_orders.sql"]
// }
```

### Publish Changes
```typescript
POST dbt/publish_changes/
{
  "commit_message": "Add staging models for orders and customers"
}
// Response: { "success": true }
```

---

## Props Interface

```typescript
interface PublishModalProps {
  open: boolean;
  onClose: () => void;
  onPublishSuccess?: () => void;  // Called after successful publish
}

interface GitStatusSummary {
  added: string[];
  modified: string[];
  deleted: string[];
}
```

---

## Implementation

```typescript
import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { apiGet, apiPost } from '@/lib/api';
import { toast } from 'sonner';

interface PublishModalProps {
  open: boolean;
  onClose: () => void;
  onPublishSuccess?: () => void;
}

interface GitStatusSummary {
  added: string[];
  modified: string[];
  deleted: string[];
}

export default function PublishModal({
  open,
  onClose,
  onPublishSuccess,
}: PublishModalProps) {
  const [commitMessage, setCommitMessage] = useState('');
  const [gitStatus, setGitStatus] = useState<GitStatusSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // Fetch git status when modal opens
  useEffect(() => {
    if (open) {
      fetchGitStatus();
    }
  }, [open]);

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setCommitMessage('');
      setGitStatus(null);
      setLoading(false);
      setPublishing(false);
    }
  }, [open]);

  const fetchGitStatus = async () => {
    setLoading(true);
    try {
      const response = await apiGet('dbt/git_status/');
      setGitStatus(response);
    } catch (error: any) {
      console.error('Error fetching git status:', error);
      toast.error('Failed to load git status');
      setGitStatus(null);
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!commitMessage.trim()) {
      toast.error('Commit message is required');
      return;
    }

    setPublishing(true);
    try {
      const response = await apiPost('dbt/publish_changes/', {
        commit_message: commitMessage.trim(),
      });

      if (response.success) {
        toast.success('Changes published successfully');
        onPublishSuccess?.();
        onClose();
      } else {
        toast.error(response.message || 'Failed to publish changes');
      }
    } catch (error: any) {
      console.error('Error publishing changes:', error);
      toast.error(error.message || 'Failed to publish changes');
    } finally {
      setPublishing(false);
    }
  };

  const hasChanges = gitStatus && (
    gitStatus.added.length > 0 ||
    gitStatus.modified.length > 0 ||
    gitStatus.deleted.length > 0
  );

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            Publish Changes
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Review your changes and provide a commit message to publish to git
          </p>
        </DialogHeader>

        <div className="space-y-4">
          {/* Changes Section */}
          <div className="space-y-2">
            <Label className="text-base font-semibold">
              Changes to be published:
            </Label>

            <ScrollArea className="h-48 rounded-md border bg-muted/30 p-4">
              {loading ? (
                <div className="flex items-center gap-2 py-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">
                    Loading git status...
                  </span>
                </div>
              ) : gitStatus ? (
                <div className="space-y-4">
                  {/* Added Files */}
                  {gitStatus.added.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-sm font-semibold">
                        Added ({gitStatus.added.length})
                      </p>
                      {gitStatus.added.map((file, index) => (
                        <p
                          key={index}
                          className="text-xs font-mono text-green-600 dark:text-green-400 pl-2"
                        >
                          + {file}
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Modified Files */}
                  {gitStatus.modified.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-sm font-semibold">
                        Modified ({gitStatus.modified.length})
                      </p>
                      {gitStatus.modified.map((file, index) => (
                        <p
                          key={index}
                          className="text-xs font-mono text-yellow-600 dark:text-yellow-400 pl-2"
                        >
                          ~ {file}
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Deleted Files */}
                  {gitStatus.deleted.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-sm font-semibold">
                        Deleted ({gitStatus.deleted.length})
                      </p>
                      {gitStatus.deleted.map((file, index) => (
                        <p
                          key={index}
                          className="text-xs font-mono text-red-600 dark:text-red-400 pl-2"
                        >
                          - {file}
                        </p>
                      ))}
                    </div>
                  )}

                  {/* No changes */}
                  {!hasChanges && (
                    <p className="text-sm text-muted-foreground italic">
                      No changes to publish
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  No changes to publish
                </p>
              )}
            </ScrollArea>
          </div>

          <Separator />

          {/* Commit Message Section */}
          <div className="space-y-2">
            <Label htmlFor="commitMessage" className="text-base font-semibold">
              Commit message: <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="commitMessage"
              placeholder="Enter a descriptive commit message..."
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              disabled={publishing}
              rows={3}
              data-testid="commit-message-input"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={publishing}
            data-testid="cancel-btn"
          >
            Cancel
          </Button>
          <Button
            onClick={handlePublish}
            disabled={!commitMessage.trim() || publishing || !hasChanges}
            data-testid="publish-btn"
          >
            {publishing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Publishing...
              </>
            ) : (
              'Publish Changes'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

---

## State Flow

```
Modal Opens
    ↓
Fetch git_status/
    ↓
Display changes (added/modified/deleted)
    ↓
User enters commit message
    ↓
User clicks Publish
    ↓
POST publish_changes/
    ↓
On success → close modal, trigger callback
```

---

## Key Features

1. **Auto-fetch status**: Fetches git status when modal opens
2. **Categorized changes**: Shows added, modified, deleted files separately
3. **Color-coded**: Green for added, yellow for modified, red for deleted
4. **Required commit message**: Validation before publish
5. **Loading states**: Loading spinner for status fetch and publish
6. **Empty state**: Shows "No changes" when nothing to publish
7. **Disabled publish**: Button disabled when no message or no changes

---

## Integration Points

Called from Canvas toolbar:
- User clicks "Publish" button
- Must have PAT connected (otherwise PatRequiredModal shown first)
- After success, may trigger canvas refresh

---

## Implementation Checklist

- [ ] Create modal component
- [ ] Implement git status fetching with SWR
- [ ] Display categorized file changes
- [ ] Add commit message textarea
- [ ] Implement publish API call
- [ ] Handle loading states
- [ ] Handle empty state
- [ ] Handle error states
- [ ] Style with Tailwind
- [ ] Add data-testid attributes
