'use client';

import { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFeatureFlags, FeatureFlagKeys } from '@/hooks/api/useFeatureFlags';
import { useDashboardAIChatStatus } from '@/hooks/api/useDashboardAIChat';
import { DashboardChat } from '@/components/dashboard/dashboard-chat';

interface DashboardChatTriggerProps {
  dashboardId: number;
  dashboardTitle: string;
  isPublicMode?: boolean;
}

export function DashboardChatTrigger({
  dashboardId,
  dashboardTitle,
  isPublicMode = false,
}: DashboardChatTriggerProps) {
  const [open, setOpen] = useState(false);
  const { isFeatureFlagEnabled } = useFeatureFlags();
  const featureEnabled = isFeatureFlagEnabled(FeatureFlagKeys.AI_DASHBOARD_CHAT);
  const { status, isLoading } = useDashboardAIChatStatus(featureEnabled && !isPublicMode);
  const chatAvailable = featureEnabled && !isPublicMode && !!status?.chat_available;

  if (!chatAvailable || isLoading) {
    return null;
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="fixed right-6 bottom-6 z-40 h-14 rounded-full px-5 shadow-lg"
      >
        <MessageCircle className="mr-2 h-5 w-5" />
        Dalgo AI
      </Button>
      <DashboardChat
        dashboardId={dashboardId}
        dashboardTitle={dashboardTitle}
        open={open}
        onOpenChange={setOpen}
        enabled={chatAvailable}
      />
    </>
  );
}
