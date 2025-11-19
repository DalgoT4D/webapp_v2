'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/components/ui/use-toast';
import { MessageCircle, Bot, Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EnhancedDashboardChat } from './enhanced-dashboard-chat';
import { useAIStatus } from '@/hooks/api/useAIStatus';

interface DashboardChatTriggerProps {
  dashboardId: number;
  dashboardTitle?: string;
  selectedChartId?: string | null;
  className?: string;
  isPublicMode?: boolean;
}

export function DashboardChatTrigger({
  dashboardId,
  dashboardTitle,
  selectedChartId = null,
  className,
  isPublicMode = false,
}: DashboardChatTriggerProps) {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [hasNewActivity, setHasNewActivity] = useState(false);
  const { aiEnabled, isLoading: aiStatusLoading } = useAIStatus();
  const { toast } = useToast();

  // Don't show chat in public mode unless specifically enabled
  if (isPublicMode) {
    return null;
  }

  const handleOpenChat = () => {
    // Check if AI is enabled before opening chat
    if (!aiEnabled) {
      toast({
        title: 'AI Chat Disabled',
        description: 'Please ask your account manager to give consent to use AI in Dalgo',
        variant: 'default',
        duration: 5000,
      });
      return;
    }

    setIsChatOpen(true);
    setHasNewActivity(false);
  };

  const handleCloseChat = () => {
    setIsChatOpen(false);
  };

  return (
    <>
      {/* Floating Chat Trigger */}
      <div className={cn('fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2', className)}>
        {/* Chart Selection Indicator */}
        {selectedChartId && !isChatOpen && (
          <div className="bg-white border border-blue-200 rounded-lg p-3 shadow-lg max-w-xs animate-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-center gap-2 text-sm text-blue-700">
              <Bot className="w-4 h-4" />
              <span>Chart selected - Ask me about it!</span>
            </div>
          </div>
        )}

        {/* Main Chat Trigger Button */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={handleOpenChat}
                disabled={isChatOpen || aiStatusLoading}
                className={cn(
                  'h-14 w-14 rounded-full shadow-lg transition-all duration-300',
                  aiEnabled
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'
                    : 'bg-gradient-to-r from-gray-400 to-gray-500 hover:from-gray-500 hover:to-gray-600',
                  'border-2 border-white hover:scale-105',
                  isChatOpen && 'opacity-50 cursor-not-allowed',
                  !aiEnabled && 'cursor-pointer', // Allow clicking to show message
                  hasNewActivity &&
                    aiEnabled &&
                    'ring-4 ring-blue-200 ring-opacity-75 animate-pulse'
                )}
              >
                {isChatOpen ? (
                  <X className="w-6 h-6 text-white" />
                ) : (
                  <div className="relative">
                    <MessageCircle className="w-6 h-6 text-white" />
                    {hasNewActivity && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white" />
                    )}
                  </div>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-xs">
              <div className="space-y-1">
                <p className="font-medium">
                  {isChatOpen
                    ? 'Chat is open'
                    : aiEnabled
                      ? 'Ask AI about this dashboard'
                      : 'Please contact your Account Manager to enable AI chat in Dalgo'}
                </p>
                <p className="text-xs text-gray-500">
                  {aiEnabled
                    ? 'Get insights, analyze data, and ask questions about your dashboard'
                    : 'Please ask your account manager to give consent to use AI in Dalgo'}
                </p>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Feature Highlight Badge */}
        {!isChatOpen && (
          <div
            className={cn(
              'text-white text-xs px-3 py-1 rounded-full shadow-md',
              aiEnabled
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 animate-bounce'
                : 'bg-gradient-to-r from-gray-400 to-gray-500'
            )}
          >
            <div className="flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              <span>{aiEnabled ? 'AI Assistant' : 'AI Disabled'}</span>
            </div>
          </div>
        )}
      </div>

      {/* Chat Panel - Only render when AI is enabled */}
      {aiEnabled && (
        <EnhancedDashboardChat
          dashboardId={dashboardId}
          dashboardTitle={dashboardTitle}
          selectedChartId={selectedChartId}
          isOpen={isChatOpen}
          onClose={handleCloseChat}
        />
      )}
    </>
  );
}
