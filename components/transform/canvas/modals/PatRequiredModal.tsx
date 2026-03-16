'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { ExternalLink } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
      await apiPut('/api/dbt/connect_git_remote/', {
        gitrepoUrl: gitRepoUrl,
        gitrepoAccessToken: data.gitrepoAccessToken,
      });

      toast.success('Personal Access Token added successfully');
      reset();
      onAddKey();
      onClose();
    } catch (error: unknown) {
      console.error('Error adding PAT:', error);
      const message =
        error instanceof Error ? error.message : 'Failed to add Personal Access Token';
      toast.error(message);
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
          <DialogTitle className="text-xl font-semibold">Git Authentication Required</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Add your Personal Access Token to make changes to this workspace. You can view the
            canvas without authentication, but you&apos;ll need a Personal Access Token to make
            changes or publish to Git.
          </p>

          {/* Git Repo URL (read-only) */}
          <div className="space-y-2">
            <Label htmlFor="gitRepoUrl">GitHub repo URL</Label>
            <Input
              id="gitRepoUrl"
              value={gitRepoUrl}
              disabled
              className="bg-muted"
              data-testid="git-repo-url-input"
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
              data-testid="pat-input"
              {...register('gitrepoAccessToken', {
                required: 'Personal Access Token is required',
              })}
            />
            {errors.gitrepoAccessToken && (
              <p className="text-sm text-red-500">{errors.gitrepoAccessToken.message}</p>
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
            <Button type="submit" disabled={loading} className="w-full" data-testid="connect-btn">
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
