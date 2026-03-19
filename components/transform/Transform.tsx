// components/transform/Transform.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
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
import { useUserPreferences } from '@/hooks/api/useNotifications';
import { apiPut } from '@/lib/api';
import { UITransformTab } from './UITransformTab';
import { DBTTransformTab } from './DBTTransformTab';
import { toastSuccess, toastError } from '@/lib/toast';

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
      if (savedTab === 'ui' || savedTab === 'github') {
        setActiveTab(savedTab);
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
    const tabValue = value as 'ui' | 'github';
    setActiveTab(tabValue);

    // Persist tab preference to backend (matching v1 cross-device sync)
    try {
      await apiPut('/api/userpreferences/', {
        last_visited_transform_tab: tabValue,
      });
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
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">Transform</h1>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Setup Failed</AlertTitle>
          <AlertDescription>{setupError}</AlertDescription>
        </Alert>
        <Button onClick={setupUnifiedWorkspace} disabled={setupLoading}>
          {setupLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Try Again
        </Button>
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
            <TabsList>
              <TabsTrigger value="ui" data-testid="ui-transform-tab">
                UI Transform
              </TabsTrigger>
              <TabsTrigger value="github" data-testid="github-transform-tab">
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
