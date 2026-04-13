// components/transform/DBTRepositoryCard.tsx
'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Loader2, Info } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { useDbtWorkspace, switchGitRepo, updateSchema } from '@/hooks/api/useDbtWorkspace';
import { useUserPermissions } from '@/hooks/api/usePermissions';
import { toastSuccess, toastError, toastInfo } from '@/lib/toast';
import Image from 'next/image';
import type { DbtWorkspaceFormData } from '@/types/transform';

// Placeholder shown in PAT field when editing an existing connection
const PAT_PLACEHOLDER = '*********';

interface DBTRepositoryCardProps {
  onConnectGit?: () => void;
}

export function DBTRepositoryCard({ onConnectGit }: DBTRepositoryCardProps) {
  const { data: workspace, mutate } = useDbtWorkspace();
  const { hasPermission } = useUserPermissions();
  const [showDialog, setShowDialog] = useState(false);
  const [loading, setLoading] = useState(false);

  const isConnected = !!(workspace && workspace.gitrepo_url);
  const canCreate = hasPermission('can_create_dbt_workspace');
  const canEdit = hasPermission('can_edit_dbt_workspace');

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
        gitrepoAccessToken: isConnected ? PAT_PLACEHOLDER : '',
        defaultSchema: workspace.default_schema || 'intermediate',
      });
    }
  }, [showDialog, workspace, form, isConnected]);

  const handleSubmit = async (data: DbtWorkspaceFormData) => {
    setLoading(true);
    try {
      if (isConnected) {
        // Smart update: detect what changed
        const schemaChanged = workspace?.default_schema !== data.defaultSchema;
        const gitRepoChanged =
          workspace?.gitrepo_url !== data.gitrepoUrl ||
          (data.gitrepoAccessToken && data.gitrepoAccessToken !== PAT_PLACEHOLDER);

        if (schemaChanged && !gitRepoChanged) {
          // Only schema changed — use the schema-only endpoint
          await updateSchema(data.defaultSchema);
          toastSuccess.updated('Schema');
        } else if (gitRepoChanged) {
          // Git repo changed — use the switch_git_repo endpoint
          await switchGitRepo(data.gitrepoUrl, data.gitrepoAccessToken);
          toastSuccess.updated('Git repository');
          // If schema also changed, update it separately
          if (schemaChanged) {
            await updateSchema(data.defaultSchema);
          }
        } else {
          // Nothing changed
          toastInfo.noChanges();
          setLoading(false);
          return;
        }
      } else {
        // First-time connection — same endpoints as v1
        await switchGitRepo(data.gitrepoUrl, data.gitrepoAccessToken);
        // Update schema if not the default
        if (data.defaultSchema) {
          await updateSchema(data.defaultSchema);
        }
        toastSuccess.generic('Git repository connected successfully');
      }

      mutate(); // Revalidate workspace data
      setShowDialog(false);
      form.reset();
      onConnectGit?.();
    } catch (error: unknown) {
      toastError.save(error, 'Git repository');
    } finally {
      setLoading(false);
    }
  };

  const getButtonText = () => {
    if (isConnected) return 'EDIT';
    return 'CONNECT TO GITHUB';
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
            <CardTitle className="mb-1 text-xl font-semibold">DBT Repository</CardTitle>
            <CardDescription className="break-words text-base">
              {isConnected ? (
                <span className="flex items-center flex-wrap gap-1">
                  Connected:{' '}
                  <a
                    href={workspace.gitrepo_url || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {workspace.gitrepo_url}
                  </a>
                  {workspace.default_schema && (
                    <span className="text-sm bg-muted px-2 py-0.5 rounded">
                      {workspace.default_schema}
                    </span>
                  )}
                  {workspace.is_repo_managed_by_system && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex items-center text-muted-foreground hover:text-foreground"
                          aria-label="Repository info"
                        >
                          <Info className="w-4 h-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent
                        className="w-80 text-sm bg-popover text-popover-foreground border shadow-md rounded-md p-4 [&_svg]:!hidden"
                        side="bottom"
                        align="start"
                        sideOffset={4}
                      >
                        <div className="space-y-3">
                          <h4 className="font-semibold text-base">Managed Repository</h4>
                          <ul className="space-y-2 list-disc pl-4">
                            <li>
                              This Git repository is <strong>created and managed by Dalgo</strong>{' '}
                              on your behalf.
                            </li>
                            <li>
                              The repository is <strong>private by default</strong> and not
                              accessible directly over the internet.
                            </li>
                            <li>
                              If you want access to the repository or wish to manage it yourself,
                              please refer to our{' '}
                              <a
                                href={process.env.NEXT_PUBLIC_TRANSFORM_DOCS_URL || '#'}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline font-medium"
                              >
                                documentation
                              </a>{' '}
                              for steps on how to switch to your own GitHub repository.
                            </li>
                          </ul>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </span>
              ) : (
                'Connect your DBT project Git repository'
              )}
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
            <DialogContent className="sm:max-w-[550px]">
              <DialogHeader>
                <DialogTitle className="text-2xl font-semibold text-gray-900">
                  {isConnected ? 'Edit Git Repository' : 'Connect to GitHub'}
                </DialogTitle>
              </DialogHeader>

              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5 mt-2">
                {/* GitHub repo URL */}
                <div className="space-y-2">
                  <Label
                    htmlFor="gitrepoUrl"
                    className="text-base font-medium text-muted-foreground"
                  >
                    GitHub repo URL<span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="gitrepoUrl"
                    placeholder="https://github.com/username/repository-name"
                    className="bg-gray-50 h-12 text-base"
                    {...form.register('gitrepoUrl', {
                      required: 'Git repository URL is required',
                      pattern: {
                        value: /^https?:\/\/(www\.)?github\.com\/[\w\-.]+\/[\w\-.]+\/?$/,
                        message:
                          'Must be a valid GitHub repository URL (e.g., https://github.com/username/repo)',
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

                {/* Personal access token */}
                <div className="space-y-2">
                  <Label
                    htmlFor="gitrepoAccessToken"
                    className="text-base font-medium text-muted-foreground"
                  >
                    Personal access token{!isConnected && <span className="text-red-500">*</span>}
                  </Label>
                  <Input
                    id="gitrepoAccessToken"
                    type="password"
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                    className="bg-gray-50 h-12 text-base"
                    {...form.register('gitrepoAccessToken', {
                      required: isConnected ? false : 'Access token is required',
                    })}
                    data-testid="git-token-input"
                  />
                  {form.formState.errors.gitrepoAccessToken && (
                    <p className="text-sm text-destructive mt-1">
                      {form.formState.errors.gitrepoAccessToken.message}
                    </p>
                  )}
                </div>

                {/* Dbt default Schema */}
                <div className="space-y-2">
                  <Label
                    htmlFor="defaultSchema"
                    className="text-base font-medium text-muted-foreground"
                  >
                    Dbt default Schema<span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="defaultSchema"
                    placeholder="intermediate"
                    className="bg-gray-50 h-12 text-base"
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

                {/* Warning callout */}
                <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                  <span className="text-amber-500 mt-0.5 text-lg">&#9888;</span>
                  <p className="text-sm text-amber-800">
                    Make sure your Personal Access Token has the following permissions:{' '}
                    <strong>repo, workflow</strong>
                  </p>
                </div>

                {/* Stacked full-width buttons */}
                <div className="space-y-3 pt-1">
                  <Button
                    type="submit"
                    disabled={loading}
                    data-testid="save-git-btn"
                    variant="ghost"
                    className="w-full h-12 text-base font-semibold text-white hover:opacity-90 shadow-xs"
                    style={{ backgroundColor: 'var(--primary)' }}
                  >
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isConnected ? 'SAVE & UPDATE' : 'SAVE & CONNECT'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowDialog(false)}
                    disabled={loading}
                    className="w-full h-12 text-base font-semibold"
                    style={{ color: 'var(--primary)', borderColor: 'var(--primary)' }}
                  >
                    Cancel
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
