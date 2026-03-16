'use client';

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

export default function PublishModal({ open, onClose, onPublishSuccess }: PublishModalProps) {
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
      const response = await apiGet('/api/dbt/git_status/');
      setGitStatus(response);
    } catch (error: unknown) {
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
      const response = await apiPost('/api/dbt/publish_changes/', {
        commit_message: commitMessage.trim(),
      });

      if (response.success) {
        toast.success('Changes published successfully');
        onPublishSuccess?.();
        onClose();
      } else {
        toast.error(response.message || 'Failed to publish changes');
      }
    } catch (error: unknown) {
      console.error('Error publishing changes:', error);
      const message = error instanceof Error ? error.message : 'Failed to publish changes';
      toast.error(message);
    } finally {
      setPublishing(false);
    }
  };

  const hasChanges =
    gitStatus &&
    (gitStatus.added.length > 0 || gitStatus.modified.length > 0 || gitStatus.deleted.length > 0);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Publish Changes</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Review your changes and provide a commit message to publish to git
          </p>
        </DialogHeader>

        <div className="space-y-4">
          {/* Changes Section */}
          <div className="space-y-2">
            <Label className="text-base font-semibold">Changes to be published:</Label>

            <ScrollArea className="h-48 rounded-md border bg-muted/30 p-4">
              {loading ? (
                <div className="flex items-center gap-2 py-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Loading git status...</span>
                </div>
              ) : gitStatus ? (
                <div className="space-y-4">
                  {/* Added Files */}
                  {gitStatus.added.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-sm font-semibold">Added ({gitStatus.added.length})</p>
                      {gitStatus.added.map((file, index) => (
                        <p
                          key={index}
                          className="text-xs font-mono text-green-600 dark:text-green-400 pl-2"
                          data-testid={`added-file-${index}`}
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
                          data-testid={`modified-file-${index}`}
                        >
                          ~ {file}
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Deleted Files */}
                  {gitStatus.deleted.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-sm font-semibold">Deleted ({gitStatus.deleted.length})</p>
                      {gitStatus.deleted.map((file, index) => (
                        <p
                          key={index}
                          className="text-xs font-mono text-red-600 dark:text-red-400 pl-2"
                          data-testid={`deleted-file-${index}`}
                        >
                          - {file}
                        </p>
                      ))}
                    </div>
                  )}

                  {/* No changes */}
                  {!hasChanges && (
                    <p
                      className="text-sm text-muted-foreground italic"
                      data-testid="no-changes-message"
                    >
                      No changes to publish
                    </p>
                  )}
                </div>
              ) : (
                <p
                  className="text-sm text-muted-foreground italic"
                  data-testid="no-changes-message"
                >
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
