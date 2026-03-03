// components/transform/DBTRepositoryCard.tsx
'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import {
  useDbtWorkspace,
  connectGitRepository,
  updateGitRepository,
} from '@/hooks/api/useDbtWorkspace';
import { useUserPermissions } from '@/hooks/api/usePermissions';
import { toast } from 'sonner';
import Image from 'next/image';
import type { DbtWorkspaceFormData } from '@/types/transform';

interface DBTRepositoryCardProps {
  onConnectGit?: () => void;
}

export function DBTRepositoryCard({ onConnectGit }: DBTRepositoryCardProps) {
  const { data: workspace, mutate } = useDbtWorkspace();
  const { permissions } = useUserPermissions();
  const [showDialog, setShowDialog] = useState(false);
  const [loading, setLoading] = useState(false);

  const isConnected = !!(workspace && workspace.gitrepo_url);
  const canCreate = permissions.includes('can_create_dbt_workspace');
  const canEdit = permissions.includes('can_edit_dbt_workspace');

  const form = useForm<DbtWorkspaceFormData>({
    defaultValues: {
      gitrepoUrl: '',
      gitrepoAccessToken: '',
      defaultSchema: 'intermediate',
    },
  });

  // Load workspace data into form when dialog opens
  useEffect(() => {
    if (showDialog && workspace) {
      form.reset({
        gitrepoUrl: workspace.gitrepo_url || '',
        gitrepoAccessToken: '', // Never prefill token
        defaultSchema: workspace.default_schema || 'intermediate',
      });
    }
  }, [showDialog, workspace, form]);

  const handleSubmit = async (data: DbtWorkspaceFormData) => {
    setLoading(true);
    try {
      if (isConnected) {
        await updateGitRepository(data);
        toast.success('Git repository updated successfully');
      } else {
        await connectGitRepository(data);
        toast.success('Git repository connected successfully');
      }

      mutate(); // Revalidate workspace data
      setShowDialog(false);
      form.reset();
      onConnectGit?.();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save Git repository');
    } finally {
      setLoading(false);
    }
  };

  const getButtonText = () => {
    if (isConnected) return 'Edit';
    return 'Connect to Github';
  };

  const isButtonDisabled = () => {
    if (isConnected) return !canEdit;
    return !canCreate;
  };

  return (
    <Card data-testid="dbt-repository-card">
      <CardHeader>
        <div className="flex items-start gap-4">
          <div className="rounded-lg bg-muted p-2">
            <Image
              src="/images/dbt.png"
              alt="DBT"
              width={32}
              height={32}
              className="object-contain"
            />
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className="mb-1">GitHub Repository</CardTitle>
            <CardDescription className="break-words">
              {isConnected
                ? `Connected: ${workspace.gitrepo_url}`
                : 'Connect your DBT project Git repository'}
            </CardDescription>
          </div>
          <Dialog open={showDialog} onOpenChange={setShowDialog}>
            <DialogTrigger asChild>
              <Button
                variant={isConnected ? 'outline' : 'default'}
                disabled={isButtonDisabled()}
                data-testid="connect-git-btn"
              >
                {getButtonText()}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>
                  {isConnected ? 'Edit Git Repository' : 'Connect Git Repository'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <div>
                  <Label htmlFor="gitrepoUrl">Git Repository URL</Label>
                  <Input
                    id="gitrepoUrl"
                    placeholder="https://github.com/username/repo"
                    {...form.register('gitrepoUrl', {
                      required: 'Git repository URL is required',
                      pattern: {
                        value: /^https?:\/\/.+/,
                        message: 'Must be a valid URL starting with http:// or https://',
                      },
                    })}
                    data-testid="git-url-input"
                  />
                  {form.formState.errors.gitrepoUrl && (
                    <p className="text-sm text-destructive mt-1">
                      {form.formState.errors.gitrepoUrl.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="gitrepoAccessToken">Personal Access Token (PAT)</Label>
                  <Input
                    id="gitrepoAccessToken"
                    type="password"
                    placeholder="ghp_xxxxxxxxxxxx"
                    {...form.register('gitrepoAccessToken', {
                      required: 'Access token is required',
                    })}
                    data-testid="git-token-input"
                  />
                  {form.formState.errors.gitrepoAccessToken && (
                    <p className="text-sm text-destructive mt-1">
                      {form.formState.errors.gitrepoAccessToken.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="defaultSchema">Default Schema</Label>
                  <Input
                    id="defaultSchema"
                    placeholder="intermediate"
                    {...form.register('defaultSchema', {
                      required: 'Default schema is required',
                    })}
                    data-testid="default-schema-input"
                  />
                  {form.formState.errors.defaultSchema && (
                    <p className="text-sm text-destructive mt-1">
                      {form.formState.errors.defaultSchema.message}
                    </p>
                  )}
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowDialog(false)}
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={loading} data-testid="save-git-btn">
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isConnected ? 'Update' : 'Connect'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
    </Card>
  );
}
