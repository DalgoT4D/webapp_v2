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
        className="fixed right-6 bottom-6 z-40 h-14 rounded-full px-4 shadow-lg"
      >
        <span className="grid grid-cols-[20px_auto_20px] items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          <span className="text-center">Dalgo AI</span>
          <span aria-hidden="true" className="h-5 w-5" />
        </span>
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
