// components/transform/Transform.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useTransformStore } from '@/stores/transformStore';
import {
  useTransformType,
  setupTransformWorkspace,
  createTransformTasks,
  syncSources,
  deleteDbtRepo,
} from '@/hooks/api/useTransform';
import { useUserPreferences, updateUserPreference } from '@/hooks/api/useNotifications';
import { UITransformTab } from './ui-transform/UITransformTab';
import { DBTTransformTab } from './dbt-transform/DBTTransformTab';
import { toastSuccess, toastError } from '@/lib/toast';
import { TransformTab } from '@/constants/transform';

export default function Transform() {
  const [workspaceSetup, setWorkspaceSetup] = useState(false);
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupError, setSetupError] = useState('');
  const [gitConnected, setGitConnected] = useState(false);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const hasInitiatedSetup = useRef(false);

  const { activeTab, setActiveTab } = useTransformStore();
  const { data: transformTypeData, isLoading: transformTypeLoading } = useTransformType();
  const { preferences, mutate: mutatePreferences } = useUserPreferences();

  useEffect(() => {
    if (transformTypeLoading) return;

    const initializeWorkspace = async () => {
      const transformType = transformTypeData?.transform_type;

      if (['ui', 'github', 'dbtcloud'].includes(transformType as string)) {
        setWorkspaceSetup(true);
        setGitConnected(true);
      } else if (!hasInitiatedSetup.current) {
        hasInitiatedSetup.current = true;
        await setupUnifiedWorkspace();
      }
    };

    initializeWorkspace();
  }, [transformTypeData, transformTypeLoading]);

  // Load saved tab preference from backend (matching v1 cross-device persistence)
  useEffect(() => {
    if (preferences && !preferencesLoaded) {
      const savedTab = preferences.last_visited_transform_tab;
      if (savedTab === TransformTab.UI || savedTab === TransformTab.GITHUB) {
        setActiveTab(savedTab as TransformTab);
      }
      setPreferencesLoaded(true);
    }
  }, [preferences, preferencesLoaded, setActiveTab]);

  const setupUnifiedWorkspace = async () => {
    setSetupLoading(true);
    setSetupError('');

    try {
      // Setup local project for unified experience
      await setupTransformWorkspace('intermediate');

      // Create system transform tasks
      await createTransformTasks();

      // Hit sync sources api
      await syncSources();

      setWorkspaceSetup(true);
      toastSuccess.generic('Transform workspace setup complete');
    } catch (err: unknown) {
      console.error('Error occurred while setting up unified workspace:', err);

      const fallback = 'Failed to set up transform workspace. Please try again.';
      const errorMessage =
        err instanceof Error ? err.message : typeof err === 'string' ? err : fallback;

      setSetupError(errorMessage);

      // Try to cleanup - if it fails, ignore
      try {
        await deleteDbtRepo();
      } catch (cleanupError) {
        console.warn('Cleanup failed (workspace might not exist):', cleanupError);
      }

      setWorkspaceSetup(false);
    } finally {
      setSetupLoading(false);
    }
  };

  const handleTabChange = async (value: string) => {
    const tabValue = value as TransformTab;
    setActiveTab(tabValue);

    // Persist tab preference to backend (matching v1 cross-device sync)
    try {
      await updateUserPreference({ last_visited_transform_tab: tabValue });
      mutatePreferences();
    } catch {
      // Non-critical — don't show error for preference save failure
    }
  };

  // Loading state
  if (transformTypeLoading || setupLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">
          {setupLoading ? 'Setting up your transform workspace...' : 'Loading...'}
        </p>
      </div>
    );
  }

  // Error state
  if (setupError) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-shrink-0 border-b bg-background">
          <div className="p-6 pb-6">
            <h1 className="text-3xl font-bold">Transform</h1>
            <p className="text-muted-foreground mt-1">
              Build and manage data transformation workflows
            </p>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-xl w-full space-y-6 text-center">
            <Alert variant="warning" className="p-8 border-amber-200 bg-amber-50/50 shadow-sm">
              <div className="flex flex-col items-center gap-4">
                <div className="flex items-center gap-3">
                  <TriangleAlert className="h-6 w-6 text-amber-600" />
                  <AlertTitle className="text-xl font-bold text-amber-900 leading-none">
                    Setup Failed
                  </AlertTitle>
                </div>
                <AlertDescription className="text-sm text-amber-800 leading-relaxed">
                  {setupError}
                </AlertDescription>
              </div>
            </Alert>
            <Button
              onClick={setupUnifiedWorkspace}
              disabled={setupLoading}
              variant="ghost"
              className="text-white hover:opacity-90 shadow-sm px-10 py-6 text-base font-semibold"
              style={{ backgroundColor: 'var(--primary)' }}
              data-testid="transform-setup-retry-btn"
            >
              {setupLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              TRY AGAIN
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Main UI
  if (workspaceSetup) {
    return (
      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="h-full flex flex-col"
        data-testid="transform-page"
      >
        {/* Header - Fixed */}
        <div className="flex-shrink-0 border-b bg-background">
          <div className="p-6 pb-4">
            <h1 className="text-3xl font-bold">Transform</h1>
            <p className="text-muted-foreground mt-2">
              Build and manage data transformation workflows
            </p>
          </div>

          <div className="px-6">
            <TabsList className="bg-transparent p-0 h-auto gap-4">
              <TabsTrigger
                value="ui"
                data-testid="ui-transform-tab"
                className="relative bg-transparent border-0 shadow-none rounded-none px-1 py-2.5 text-sm font-medium uppercase tracking-wide text-gray-500 cursor-pointer hover:text-teal-600 data-[state=active]:text-teal-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-transparent data-[state=active]:after:bg-teal-600"
              >
                UI Transform
              </TabsTrigger>
              <TabsTrigger
                value="github"
                data-testid="github-transform-tab"
                className="relative bg-transparent border-0 shadow-none rounded-none px-1 py-2.5 text-sm font-medium uppercase tracking-wide text-gray-500 cursor-pointer hover:text-teal-600 data-[state=active]:text-teal-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-transparent data-[state=active]:after:bg-teal-600"
              >
                DBT Transform
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 min-h-0 overflow-hidden px-6 pb-6 mt-6">
          <div className="h-full overflow-y-auto">
            <TabsContent value="ui" className="mt-0 h-full">
              <UITransformTab
                onGitConnected={() => setGitConnected(true)}
                gitConnected={gitConnected}
              />
            </TabsContent>

            <TabsContent value="github" className="mt-0 h-full">
              <DBTTransformTab onConnectGit={() => setGitConnected(true)} />
            </TabsContent>
          </div>
        </div>
      </Tabs>
    );
  }

  // Fallback
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <p className="text-muted-foreground">Preparing your transform workspace...</p>
    </div>
  );
}
