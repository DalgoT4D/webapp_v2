'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useFeatureFlags, FeatureFlagKeys } from '@/hooks/api/useFeatureFlags';
import { useUserPermissions } from '@/hooks/api/usePermissions';
import { useDashboards } from '@/hooks/api/useDashboards';
import {
  useDashboardAIChatActions,
  useDashboardAIChatSettings,
  useDashboardAIContext,
} from '@/hooks/api/useDashboardAIChat';
import { DashboardChatConsentCard } from '@/components/settings/dashboard-chat-consent-card';
import { MarkdownContextEditorCard } from '@/components/settings/markdown-context-editor-card';
import { SettingsStateCard } from '@/components/settings/settings-state-card';

function formatTimestamp(timestamp: string | null) {
  if (!timestamp) {
    return 'Not available yet';
  }

  try {
    return new Date(timestamp).toLocaleString();
  } catch {
    return timestamp;
  }
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === 'string' && error) {
    return error;
  }
  return 'Please try again.';
}

function DashboardChatConsentDialog({
  open,
  isUpdatingConsent,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  isUpdatingConsent: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enable Chat with Dashboards</DialogTitle>
          <DialogDescription>
            Turning this on allows Dalgo AI to use dashboard context, saved AI context, and relevant
            warehouse information to answer questions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm text-slate-700">
          <p>
            Use this only if your organization approves sharing data with external AI services for
            dashboard question answering.
          </p>
          <p>Saved context changes appear in Dalgo AI after the next context refresh.</p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isUpdatingConsent}>
            {isUpdatingConsent ? 'Enabling...' : 'Confirm and enable'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function OrganizationSettings() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isFeatureFlagEnabled } = useFeatureFlags();
  const { hasPermission } = useUserPermissions();
  const featureEnabled = isFeatureFlagEnabled(FeatureFlagKeys.AI_DASHBOARD_CHAT);
  const canManageOrgSettings = hasPermission('can_manage_org_settings');
  const canLoadProtectedData = featureEnabled && canManageOrgSettings;

  const { data: dashboards, isLoading: dashboardsLoading } = useDashboards({
    dashboard_type: 'native',
  });
  const {
    settings,
    isLoading: settingsLoading,
    error: settingsError,
    mutate: mutateSettings,
  } = useDashboardAIChatSettings(canLoadProtectedData);
  const [selectedDashboardId, setSelectedDashboardId] = useState<number | null>(null);
  const {
    context: dashboardContext,
    isLoading: dashboardContextLoading,
    error: dashboardContextError,
    mutate: mutateDashboardContext,
  } = useDashboardAIContext(
    selectedDashboardId,
    canLoadProtectedData && !!settings?.ai_data_sharing_enabled && selectedDashboardId !== null
  );
  const { updateSettings, updateDashboardContext } = useDashboardAIChatActions();

  const [orgContextDraft, setOrgContextDraft] = useState('');
  const [dashboardContextDraft, setDashboardContextDraft] = useState('');
  const [isSavingOrgContext, setIsSavingOrgContext] = useState(false);
  const [isSavingDashboardContext, setIsSavingDashboardContext] = useState(false);
  const [isUpdatingConsent, setIsUpdatingConsent] = useState(false);
  const [consentDialogOpen, setConsentDialogOpen] = useState(false);

  const nativeDashboards = useMemo(
    () => dashboards.filter((dashboard) => dashboard.dashboard_type === 'native'),
    [dashboards]
  );

  useEffect(() => {
    if (!featureEnabled) {
      router.replace('/settings/about');
    }
  }, [featureEnabled, router]);

  useEffect(() => {
    const requestedDashboardId = Number(searchParams.get('dashboard_id'));
    if (
      Number.isFinite(requestedDashboardId) &&
      requestedDashboardId > 0 &&
      nativeDashboards.some((dashboard) => dashboard.id === requestedDashboardId)
    ) {
      setSelectedDashboardId(requestedDashboardId);
      return;
    }

    if (!selectedDashboardId && nativeDashboards.length > 0) {
      setSelectedDashboardId(nativeDashboards[0].id);
    }
  }, [nativeDashboards, searchParams, selectedDashboardId]);

  useEffect(() => {
    setOrgContextDraft(settings?.org_context_markdown ?? '');
  }, [settings?.org_context_markdown]);

  useEffect(() => {
    setDashboardContextDraft(dashboardContext?.dashboard_context_markdown ?? '');
  }, [dashboardContext?.dashboard_context_markdown, selectedDashboardId]);

  const handleConsentChange = async (checked: boolean) => {
    if (!settings) {
      return;
    }

    if (checked) {
      setConsentDialogOpen(true);
      return;
    }

    setIsUpdatingConsent(true);
    try {
      await updateSettings({ ai_data_sharing_enabled: false });
      await mutateSettings();
      toast.success('AI data sharing has been turned off');
    } catch (error) {
      toast.error(`Failed to turn off AI data sharing: ${getErrorMessage(error)}`);
    } finally {
      setIsUpdatingConsent(false);
    }
  };

  const confirmConsent = async () => {
    setIsUpdatingConsent(true);
    try {
      await updateSettings({ ai_data_sharing_enabled: true });
      await mutateSettings();
      toast.success('AI data sharing has been enabled');
      setConsentDialogOpen(false);
    } catch (error) {
      toast.error(`Failed to turn on AI data sharing: ${getErrorMessage(error)}`);
    } finally {
      setIsUpdatingConsent(false);
    }
  };

  const saveOrgContext = async () => {
    setIsSavingOrgContext(true);
    try {
      await updateSettings({ org_context_markdown: orgContextDraft });
      await mutateSettings();
      toast.success('Organization AI context saved');
    } catch (error) {
      toast.error(`Failed to save settings: ${getErrorMessage(error)}`);
    } finally {
      setIsSavingOrgContext(false);
    }
  };

  const saveDashboardContext = async () => {
    if (!selectedDashboardId) {
      return;
    }

    setIsSavingDashboardContext(true);
    try {
      await updateDashboardContext(selectedDashboardId, {
        dashboard_context_markdown: dashboardContextDraft,
      });
      await mutateDashboardContext();
      toast.success('Dashboard AI context saved');
    } catch (error) {
      toast.error(`Failed to save settings: ${getErrorMessage(error)}`);
    } finally {
      setIsSavingDashboardContext(false);
    }
  };

  if (!featureEnabled) {
    return null;
  }

  if (!canManageOrgSettings) {
    return (
      <SettingsStateCard
        title="Access denied"
        description="You do not have permission to manage organization AI settings."
      />
    );
  }

  if (settingsLoading) {
    return (
      <div className="container mx-auto max-w-4xl p-6">
        <div className="flex min-h-[240px] items-center justify-center text-sm text-muted-foreground">
          Loading AI settings...
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <SettingsStateCard
        title="Unable to load AI settings"
        description={
          settingsError instanceof Error ? settingsError.message : 'Please refresh and try again.'
        }
      />
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="container mx-auto max-w-4xl space-y-6 p-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">AI Settings</h1>
          <p className="text-muted-foreground">
            Manage Chat with Dashboards consent and the markdown context used to answer questions.
          </p>
        </div>

        <DashboardChatConsentCard
          aiDataSharingEnabled={settings.ai_data_sharing_enabled}
          aiDataSharingConsentedAt={formatTimestamp(settings.ai_data_sharing_consented_at)}
          vectorLastIngestedAt={formatTimestamp(settings.vector_last_ingested_at)}
          isUpdatingConsent={isUpdatingConsent}
          onConsentChange={handleConsentChange}
        />

        {settings.ai_data_sharing_enabled ? (
          <>
            <MarkdownContextEditorCard
              title="Organization AI context"
              description="Add stable organization-level context that should be available to every dashboard chat."
              markdown={orgContextDraft}
              onMarkdownChange={setOrgContextDraft}
              onSave={saveOrgContext}
              isSaving={isSavingOrgContext}
              updatedBy={settings.org_context_updated_by || 'nobody yet'}
              updatedAt={formatTimestamp(settings.org_context_updated_at)}
              saveLabel="Save organization context"
              placeholder="Add organization-wide context in markdown..."
              emptyPreviewMessage="Organization context preview will appear here."
            />

            {nativeDashboards.length === 0 ? (
              <SettingsStateCard
                title="Dashboard AI context"
                description="Create a native dashboard before adding dashboard-specific AI context."
              />
            ) : dashboardContextLoading ? (
              <SettingsStateCard
                title="Dashboard AI context"
                description="Loading dashboard context..."
              />
            ) : dashboardContextError ? (
              <SettingsStateCard
                title="Dashboard AI context"
                description={
                  dashboardContextError instanceof Error
                    ? dashboardContextError.message
                    : 'Unable to load dashboard context.'
                }
              />
            ) : (
              <MarkdownContextEditorCard
                title="Dashboard AI context"
                description="Add markdown context for a specific native dashboard."
                markdown={dashboardContextDraft}
                onMarkdownChange={setDashboardContextDraft}
                onSave={saveDashboardContext}
                isSaving={isSavingDashboardContext}
                updatedBy={dashboardContext?.dashboard_context_updated_by || 'nobody yet'}
                updatedAt={formatTimestamp(dashboardContext?.dashboard_context_updated_at ?? null)}
                saveLabel="Save dashboard context"
                placeholder="Add dashboard-specific context in markdown..."
                emptyPreviewMessage="Dashboard context preview will appear here."
                controls={
                  <div className="space-y-2">
                    <Label htmlFor="dashboard-ai-context-select">Dashboard</Label>
                    <Select
                      value={selectedDashboardId ? String(selectedDashboardId) : undefined}
                      onValueChange={(value) => setSelectedDashboardId(Number(value))}
                      disabled={dashboardsLoading}
                    >
                      <SelectTrigger id="dashboard-ai-context-select">
                        <SelectValue placeholder="Select a dashboard" />
                      </SelectTrigger>
                      <SelectContent>
                        {nativeDashboards.map((dashboard) => (
                          <SelectItem key={dashboard.id} value={String(dashboard.id)}>
                            {dashboard.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                }
                disabled={!selectedDashboardId}
              />
            )}
          </>
        ) : (
          <SettingsStateCard
            title="AI context editors"
            description="Turn on consent first to edit organization and dashboard context."
          />
        )}
      </div>

      <DashboardChatConsentDialog
        open={consentDialogOpen}
        isUpdatingConsent={isUpdatingConsent}
        onOpenChange={setConsentDialogOpen}
        onConfirm={confirmConsent}
      />
    </div>
  );
}
