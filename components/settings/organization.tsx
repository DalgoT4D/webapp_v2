'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
import { useDashboards, type Dashboard } from '@/hooks/api/useDashboards';
import {
  type DashboardAIContext,
  type OrgDashboardAIChatMetadataStatus,
  type OrgDashboardAIChatSettings,
  useDashboardAIChatActions,
  useDashboardAIChatSettings,
  useDashboardAIContext,
  useDashboardMetadataStatus,
} from '@/hooks/api/useDashboardAIChat';
import { DashboardChatConsentCard } from '@/components/settings/dashboard-chat-consent-card';
import { DashboardChatMetadataCard } from '@/components/settings/dashboard-chat-metadata-card';
import { DashboardChatPIISettingsCard } from '@/components/settings/dashboard-chat-pii-settings-card';
import { MarkdownContextEditorCard } from '@/components/settings/markdown-context-editor-card';
import { SettingsStateCard } from '@/components/settings/settings-state-card';
import { ANALYTICS_EVENTS } from '@/constants/analytics';
import { trackEvent } from '@/lib/analytics';
import { toastError, toastSuccess } from '@/lib/toast';

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
          <p>Saved context changes appear in Dalgo AI after the next metadata rebuild.</p>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            data-testid="cancel-ai-dashboard-chat-consent-btn"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            data-testid="confirm-ai-dashboard-chat-consent-btn"
            onClick={onConfirm}
            disabled={isUpdatingConsent}
          >
            {isUpdatingConsent ? 'Enabling...' : 'Confirm and enable'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface DashboardChatSettingsContentProps {
  settings: OrgDashboardAIChatSettings;
  metadataStatus: OrgDashboardAIChatMetadataStatus | undefined;
  metadataStatusLoading: boolean;
  metadataStatusError: unknown;
  dashboardContext: DashboardAIContext | undefined;
  dashboardContextLoading: boolean;
  dashboardContextError: unknown;
  dashboardsLoading: boolean;
  nativeDashboards: Dashboard[];
  selectedDashboardId: number | null;
  orgContextDraft: string;
  dashboardContextDraft: string;
  isUpdatingConsent: boolean;
  isUpdatingPiiSharing: boolean;
  isSavingOrgContext: boolean;
  isSavingDashboardContext: boolean;
  isBuildingAllMetadata: boolean;
  isBuildingSelectedMetadata: boolean;
  canLoadProtectedData: boolean;
  piiRefreshToken: number;
  onConsentChange: (checked: boolean) => void | Promise<void>;
  onPiiSharingChange: (checked: boolean) => void | Promise<void>;
  onBuildAllMetadata: () => void | Promise<void>;
  onBuildSelectedMetadata: () => void | Promise<void>;
  onOrgContextDraftChange: (value: string) => void;
  onDashboardContextDraftChange: (value: string) => void;
  onSaveOrgContext: () => void | Promise<void>;
  onSaveDashboardContext: () => void | Promise<void>;
  onSelectedDashboardChange: (dashboardId: number) => void;
}

function DashboardChatSettingsContent({
  settings,
  metadataStatus,
  metadataStatusLoading,
  metadataStatusError,
  dashboardContext,
  dashboardContextLoading,
  dashboardContextError,
  dashboardsLoading,
  nativeDashboards,
  selectedDashboardId,
  orgContextDraft,
  dashboardContextDraft,
  isUpdatingConsent,
  isUpdatingPiiSharing,
  isSavingOrgContext,
  isSavingDashboardContext,
  isBuildingAllMetadata,
  isBuildingSelectedMetadata,
  canLoadProtectedData,
  piiRefreshToken,
  onConsentChange,
  onPiiSharingChange,
  onBuildAllMetadata,
  onBuildSelectedMetadata,
  onOrgContextDraftChange,
  onDashboardContextDraftChange,
  onSaveOrgContext,
  onSaveDashboardContext,
  onSelectedDashboardChange,
}: DashboardChatSettingsContentProps) {
  return (
    <>
      <DashboardChatConsentCard
        aiDataSharingEnabled={settings.ai_data_sharing_enabled}
        sharePiiWithLlms={settings.dashboard_chat_share_pii_with_llms}
        aiDataSharingConsentedAt={formatTimestamp(settings.ai_data_sharing_consented_at)}
        metadataLastBuiltAt={formatTimestamp(settings.metadata_last_built_at)}
        isUpdatingConsent={isUpdatingConsent}
        isUpdatingPiiSharing={isUpdatingPiiSharing}
        onConsentChange={onConsentChange}
        onPiiSharingChange={onPiiSharingChange}
      />

      {settings.ai_data_sharing_enabled ? (
        <>
          {metadataStatusLoading ? (
            <SettingsStateCard
              title="Dashboard chat metadata"
              description="Loading dashboard metadata status..."
            />
          ) : metadataStatusError ? (
            <SettingsStateCard
              title="Dashboard chat metadata"
              description={
                metadataStatusError instanceof Error
                  ? metadataStatusError.message
                  : 'Unable to load dashboard metadata status.'
              }
            />
          ) : metadataStatus ? (
            <DashboardChatMetadataCard
              dashboards={metadataStatus.dashboards}
              readyCount={metadataStatus.ready_dashboard_count}
              totalCount={metadataStatus.total_dashboard_count}
              lastBuiltAt={formatTimestamp(metadataStatus.last_built_at)}
              isLoading={metadataStatusLoading}
              isBuildingAll={isBuildingAllMetadata}
              isBuildingSelected={isBuildingSelectedMetadata}
              selectedDashboardId={selectedDashboardId}
              onBuildAll={onBuildAllMetadata}
              onBuildSelected={onBuildSelectedMetadata}
            />
          ) : null}

          <DashboardChatPIISettingsCard
            enabled={canLoadProtectedData && settings.ai_data_sharing_enabled}
            refreshToken={piiRefreshToken}
          />

          <MarkdownContextEditorCard
            title="Organization AI context"
            description="Add stable organization-level context that should be available to every dashboard chat."
            markdown={orgContextDraft}
            onMarkdownChange={onOrgContextDraftChange}
            onSave={onSaveOrgContext}
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
              onMarkdownChange={onDashboardContextDraftChange}
              onSave={onSaveDashboardContext}
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
                    onValueChange={(value) => onSelectedDashboardChange(Number(value))}
                    disabled={dashboardsLoading}
                  >
                    <SelectTrigger
                      id="dashboard-ai-context-select"
                      data-testid="dashboard-ai-context-select"
                    >
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
    </>
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
  const {
    status: metadataStatus,
    isLoading: metadataStatusLoading,
    error: metadataStatusError,
    mutate: mutateMetadataStatus,
  } = useDashboardMetadataStatus(canLoadProtectedData);
  const { updateSettings, updateDashboardContext, buildDashboardMetadata } =
    useDashboardAIChatActions();

  const [orgContextDraft, setOrgContextDraft] = useState('');
  const [dashboardContextDraft, setDashboardContextDraft] = useState('');
  const [isSavingOrgContext, setIsSavingOrgContext] = useState(false);
  const [isSavingDashboardContext, setIsSavingDashboardContext] = useState(false);
  const [isUpdatingConsent, setIsUpdatingConsent] = useState(false);
  const [isUpdatingPiiSharing, setIsUpdatingPiiSharing] = useState(false);
  const [piiRefreshToken, setPiiRefreshToken] = useState(0);
  const [consentDialogOpen, setConsentDialogOpen] = useState(false);
  const [isBuildingAllMetadata, setIsBuildingAllMetadata] = useState(false);
  const [isBuildingSelectedMetadata, setIsBuildingSelectedMetadata] = useState(false);

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
      toastSuccess.generic('AI data sharing has been turned off');
    } catch (error) {
      toastError.api(error, 'Failed to turn off AI data sharing. Please try again.');
    } finally {
      setIsUpdatingConsent(false);
    }
  };

  const confirmConsent = async () => {
    setIsUpdatingConsent(true);
    try {
      await updateSettings({ ai_data_sharing_enabled: true });
      await mutateSettings();
      toastSuccess.generic('AI data sharing has been enabled');
      setConsentDialogOpen(false);
    } catch (error) {
      toastError.api(error, 'Failed to turn on AI data sharing. Please try again.');
    } finally {
      setIsUpdatingConsent(false);
    }
  };

  const handlePiiSharingChange = async (checked: boolean) => {
    setIsUpdatingPiiSharing(true);
    try {
      await updateSettings({ dashboard_chat_share_pii_with_llms: checked });
      await mutateSettings();
      trackEvent(ANALYTICS_EVENTS.DASHBOARD_CHAT_PII_SHARING_UPDATED, {
        enabled: checked,
      });
      toastSuccess.generic(
        checked
          ? 'PII sharing with LLMs has been turned on'
          : 'PII sharing with LLMs has been turned off'
      );
    } catch (error) {
      toastError.api(error, 'Failed to update PII sharing. Please try again.');
    } finally {
      setIsUpdatingPiiSharing(false);
    }
  };

  const saveOrgContext = async () => {
    setIsSavingOrgContext(true);
    try {
      await updateSettings({ org_context_markdown: orgContextDraft });
      await mutateSettings();
      toastSuccess.generic('Organization AI context saved');
    } catch (error) {
      toastError.api(error, 'Failed to save organization AI context. Please try again.');
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
      toastSuccess.generic('Dashboard AI context saved');
    } catch (error) {
      toastError.api(error, 'Failed to save dashboard AI context. Please try again.');
    } finally {
      setIsSavingDashboardContext(false);
    }
  };

  const buildAllMetadata = async () => {
    setIsBuildingAllMetadata(true);
    try {
      await buildDashboardMetadata({ builder_model: 'o4-mini' });
      await Promise.all([mutateMetadataStatus(), mutateSettings(), mutateDashboardContext()]);
      setPiiRefreshToken((value) => value + 1);
      toastSuccess.generic('Dashboard chat metadata rebuilt for all dashboards');
    } catch (error) {
      toastError.api(error, 'Failed to build dashboard chat metadata. Please try again.');
    } finally {
      setIsBuildingAllMetadata(false);
    }
  };

  const buildSelectedMetadata = async () => {
    if (!selectedDashboardId) {
      return;
    }
    setIsBuildingSelectedMetadata(true);
    try {
      await buildDashboardMetadata({
        dashboard_id: selectedDashboardId,
        builder_model: 'o4-mini',
      });
      await Promise.all([mutateMetadataStatus(), mutateSettings(), mutateDashboardContext()]);
      setPiiRefreshToken((value) => value + 1);
      toastSuccess.generic('Dashboard chat metadata rebuilt for the selected dashboard');
    } catch (error) {
      toastError.api(error, 'Failed to build dashboard chat metadata. Please try again.');
    } finally {
      setIsBuildingSelectedMetadata(false);
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

        <DashboardChatSettingsContent
          settings={settings}
          metadataStatus={metadataStatus}
          metadataStatusLoading={metadataStatusLoading}
          metadataStatusError={metadataStatusError}
          dashboardContext={dashboardContext}
          dashboardContextLoading={dashboardContextLoading}
          dashboardContextError={dashboardContextError}
          dashboardsLoading={dashboardsLoading}
          nativeDashboards={nativeDashboards}
          selectedDashboardId={selectedDashboardId}
          orgContextDraft={orgContextDraft}
          dashboardContextDraft={dashboardContextDraft}
          isUpdatingConsent={isUpdatingConsent}
          isUpdatingPiiSharing={isUpdatingPiiSharing}
          isSavingOrgContext={isSavingOrgContext}
          isSavingDashboardContext={isSavingDashboardContext}
          isBuildingAllMetadata={isBuildingAllMetadata}
          isBuildingSelectedMetadata={isBuildingSelectedMetadata}
          canLoadProtectedData={canLoadProtectedData}
          piiRefreshToken={piiRefreshToken}
          onConsentChange={handleConsentChange}
          onPiiSharingChange={handlePiiSharingChange}
          onBuildAllMetadata={buildAllMetadata}
          onBuildSelectedMetadata={buildSelectedMetadata}
          onOrgContextDraftChange={setOrgContextDraft}
          onDashboardContextDraftChange={setDashboardContextDraft}
          onSaveOrgContext={saveOrgContext}
          onSaveDashboardContext={saveDashboardContext}
          onSelectedDashboardChange={setSelectedDashboardId}
        />
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
