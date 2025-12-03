'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  X,
  Send,
  Bot,
  CornerDownLeft,
  Loader2,
  Settings,
  Database,
  Shield,
  Info,
  MessageCircle,
  BarChart3,
  Eye,
  EyeOff,
  Sparkles,
  Download,
  Copy,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import {
  useDashboardChat,
  type ChatMessage,
  type DashboardChatSettings,
} from '@/hooks/api/useDashboardChat';
import { useAIStatus } from '@/hooks/api/useAIStatus';

// Component to format AI responses with better styling
const FormattedMessage = ({ content }: { content: string }) => {
  // Split content by lines and apply formatting
  const formatContent = (text: string) => {
    return (
      text
        // Convert **bold** to actual bold
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        // Convert ## headings to styled headings
        .replace(
          /^## (.*$)/gm,
          '<h3 class="font-semibold text-gray-900 mb-2 mt-3 flex items-center gap-2">$1</h3>'
        )
        // Convert > callouts to styled callouts
        .replace(
          /^> (.*$)/gm,
          '<div class="bg-blue-50 border-l-4 border-blue-500 p-3 my-2 rounded-r"><p class="text-blue-700 font-medium">$1</p></div>'
        )
        // Convert bullet points with emojis to styled lists
        .replace(/^- (.*$)/gm, '<li class="ml-4 mb-1">$1</li>')
        // Convert numbered lists
        .replace(/^(\d+)\. (.*$)/gm, '<li class="ml-4 mb-2 font-medium">$2</li>')
        // Handle line breaks
        .replace(/\n/g, '<br/>')
    );
  };

  const formattedContent = formatContent(content);

  return (
    <div className="formatted-message" dangerouslySetInnerHTML={{ __html: formattedContent }} />
  );
};

interface EnhancedDashboardChatProps {
  dashboardId: number;
  dashboardTitle?: string;
  selectedChartId?: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function EnhancedDashboardChat({
  dashboardId,
  dashboardTitle = 'Dashboard',
  selectedChartId = null,
  isOpen,
  onClose,
}: EnhancedDashboardChatProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // AI status from org settings
  const { aiEnabled, dataSharingEnabled } = useAIStatus();

  // Dashboard chat hook
  const {
    isLoading,
    error,
    context: dashboardContext,
    loadContext,
    sendMessage: sendChatMessage,
    updateSettings: updateChatSettings,
  } = useDashboardChat(dashboardId);

  // State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Chat settings - Initialize include_data based on org settings
  const [settings, setSettings] = useState<DashboardChatSettings>({
    include_data: dataSharingEnabled, // Set to true if org has enabled data sharing
    max_rows: 100,
    provider_type: undefined, // Use default
    auto_context: true,
  });

  // Update include_data when dataSharingEnabled changes
  useEffect(() => {
    setSettings((prev) => ({
      ...prev,
      include_data: dataSharingEnabled,
    }));
  }, [dataSharingEnabled]);

  // Initialize chat with welcome message
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const welcomeMessage: ChatMessage = {
        id: `welcome-${Date.now()}`,
        role: 'assistant',
        content: `👋 Hello! I'm your AI dashboard assistant for "${dashboardTitle}". I can help you understand your data, analyze trends, and provide insights.

${selectedChartId ? `I see you're focusing on a specific chart. ` : ''}What would you like to know about this dashboard?`,
        timestamp: new Date(),
      };

      setMessages([welcomeMessage]);

      // Auto-load context if enabled
      if (settings.auto_context) {
        loadDashboardContextWrapper();
      }
    }
  }, [isOpen, dashboardTitle, selectedChartId, settings.auto_context]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 300);
    }
  }, [isOpen]);

  const loadDashboardContextWrapper = useCallback(async () => {
    try {
      await loadContext({
        include_data: settings.include_data,
        max_rows: settings.max_rows,
      });
    } catch (error) {
      console.error('Error loading dashboard context:', error);
      toast({
        title: 'Context Loading Error',
        description: 'Failed to load dashboard context for AI analysis',
        variant: 'destructive',
      });
    }
  }, [loadContext, settings.include_data, settings.max_rows, toast]);

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    // Check if AI is still enabled before processing the request
    if (!aiEnabled) {
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content:
          'I am sorry. AI chat is disabled. Please ask your Account Manager to enable AI chat in Dalgo',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      setInputValue('');
      return;
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');

    try {
      const response = await sendChatMessage(
        messages.concat(userMessage),
        settings,
        selectedChartId
      );

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.content,
        timestamp: new Date(),
        metadata: {
          charts_analyzed: response.metadata?.charts_analyzed,
          data_included: response.data_included,
          usage: response.usage,
        },
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error sending message:', error);

      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `I apologize, but I encountered an error: ${error instanceof Error ? error.message : 'Failed to process your request'}. Please try again.`,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, errorMessage]);

      toast({
        title: 'Chat Error',
        description: error instanceof Error ? error.message : 'Failed to send message',
        variant: 'destructive',
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const updateSettings = async (newSettings: Partial<DashboardChatSettings>) => {
    const updatedSettings = { ...settings, ...newSettings };
    setSettings(updatedSettings);

    // If data sharing settings changed, reload context
    if (
      (newSettings.include_data !== undefined &&
        newSettings.include_data !== settings.include_data) ||
      (newSettings.max_rows !== undefined && newSettings.max_rows !== settings.max_rows)
    ) {
      if (updatedSettings.auto_context) {
        loadDashboardContextWrapper();
      }
    }

    try {
      await updateChatSettings(updatedSettings);
    } catch (error) {
      console.error('Error updating chat settings:', error);
      toast({
        title: 'Settings Error',
        description: 'Failed to update chat settings',
        variant: 'destructive',
      });
    }
  };

  const clearChat = () => {
    setMessages([]);
    // Re-add welcome message
    const welcomeMessage: ChatMessage = {
      id: `welcome-${Date.now()}`,
      role: 'assistant',
      content: `👋 Hello! I'm your AI dashboard assistant for "${dashboardTitle}". I can help you understand your data, analyze trends, and provide insights.

What would you like to know about this dashboard?`,
      timestamp: new Date(),
    };
    setMessages([welcomeMessage]);
  };

  const exportChat = () => {
    const chatExport = {
      dashboard_id: dashboardId,
      dashboard_title: dashboardTitle,
      exported_at: new Date().toISOString(),
      settings,
      messages: messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp.toISOString(),
        metadata: msg.metadata,
      })),
    };

    const dataStr = JSON.stringify(chatExport, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

    const exportFileDefaultName = `dashboard-chat-${dashboardId}-${new Date().toISOString().split('T')[0]}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const copyLastResponse = () => {
    const lastAssistantMessage = messages
      .slice()
      .reverse()
      .find((msg) => msg.role === 'assistant');
    if (lastAssistantMessage) {
      navigator.clipboard.writeText(lastAssistantMessage.content);
      toast({
        title: 'Copied to clipboard',
        description: 'The last AI response has been copied to your clipboard.',
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-white border-l shadow-lg flex flex-col z-50 h-screen overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-full">
            <Bot className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex flex-col">
            <h3 className="font-semibold text-gray-900">AI Assistant</h3>
            <p className="text-xs text-gray-500 truncate max-w-48">{dashboardTitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSettings(!showSettings)}
                  className="w-8 h-8 p-0"
                >
                  <Settings className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Chat Settings</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Button variant="ghost" size="sm" onClick={onClose} className="w-8 h-8 p-0">
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="border-b bg-gray-50 p-4 space-y-4 flex-shrink-0 max-h-60 overflow-y-auto">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">Chat Settings</h4>
            <Button variant="outline" size="sm" onClick={clearChat} className="text-xs">
              Clear Chat
            </Button>
          </div>

          {/* Data Sharing Toggle */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-gray-500" />
                <Label htmlFor="include-data" className="text-sm font-medium">
                  Share Data
                </Label>
              </div>
              <Switch
                id="include-data"
                checked={settings.include_data}
                onCheckedChange={(checked) => updateSettings({ include_data: checked })}
              />
            </div>

            <div className="text-xs text-gray-600 ml-6">
              {settings.include_data
                ? 'AI can see actual data values for detailed analysis'
                : 'AI can only see table structure and column names'}
            </div>

            {settings.include_data && (
              <div className="ml-6 space-y-2">
                <Label className="text-xs">Max rows per chart</Label>
                <Select
                  value={settings.max_rows.toString()}
                  onValueChange={(value) => updateSettings({ max_rows: parseInt(value) })}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="50">50 rows</SelectItem>
                    <SelectItem value="100">100 rows</SelectItem>
                    <SelectItem value="200">200 rows</SelectItem>
                    <SelectItem value="500">500 rows</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Context Info */}
          {dashboardContext && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-green-500" />
                <span className="text-xs font-medium">Dashboard Context Loaded</span>
              </div>
              <div className="text-xs text-gray-600 ml-6 space-y-1">
                <div>Charts analyzed: {dashboardContext.summary?.total_charts || 0}</div>
                <div>Filters available: {dashboardContext.filters?.length || 0}</div>
                {settings.include_data && (
                  <div className="text-green-600">✓ Data values included</div>
                )}
              </div>
            </div>
          )}

          {/* Privacy Notice */}
          <div className="flex items-start gap-2 p-2 bg-blue-50 rounded text-xs">
            <Shield className="w-3 h-3 text-blue-500 mt-0.5 flex-shrink-0" />
            <div className="text-blue-700">
              <strong>Privacy:</strong> Your data is processed securely and not stored by the AI
              service.
            </div>
          </div>
        </div>
      )}

      {/* Chat Messages */}
      <div className="flex-1 flex flex-col min-h-0">
        <ScrollArea ref={scrollAreaRef} className="flex-1 p-4 h-0">
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`flex gap-3 max-w-[90%] w-full ${
                    message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                  }`}
                >
                  {message.role === 'assistant' && (
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarFallback className="bg-blue-100 text-blue-600">
                        <Bot className="w-4 h-4" />
                      </AvatarFallback>
                    </Avatar>
                  )}

                  <div
                    className={cn(
                      'rounded-lg px-3 py-2 text-sm flex-1 min-w-0',
                      message.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-900'
                    )}
                  >
                    <div className="prose prose-sm max-w-none break-words">
                      <FormattedMessage content={message.content} />
                    </div>

                    <style jsx>{`
                      .formatted-message {
                        word-wrap: break-word;
                        overflow-wrap: break-word;
                        hyphens: auto;
                        white-space: pre-wrap;
                      }
                      .formatted-message ul {
                        list-style: none;
                        margin: 0.5rem 0;
                        padding: 0;
                      }
                      .formatted-message li {
                        margin: 0.25rem 0;
                        padding-left: 1rem;
                        word-wrap: break-word;
                      }
                      .formatted-message h3 {
                        color: #1f2937;
                        font-size: 1rem;
                        font-weight: 600;
                        margin: 1rem 0 0.5rem 0;
                        word-wrap: break-word;
                      }
                      .formatted-message strong {
                        word-wrap: break-word;
                      }
                    `}</style>

                    {/* Message metadata */}
                    {message.metadata && message.role === 'assistant' && (
                      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-200">
                        {message.metadata.charts_analyzed && (
                          <Badge variant="outline" className="text-xs">
                            <BarChart3 className="w-3 h-3 mr-1" />
                            {message.metadata.charts_analyzed} charts
                          </Badge>
                        )}
                        {message.metadata.data_included && (
                          <Badge variant="outline" className="text-xs">
                            <Database className="w-3 h-3 mr-1" />
                            Data included
                          </Badge>
                        )}
                        {message.metadata.usage?.total_tokens && (
                          <Badge variant="outline" className="text-xs">
                            <Sparkles className="w-3 h-3 mr-1" />
                            {message.metadata.usage.total_tokens} tokens
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>

                  {message.role === 'user' && (
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarFallback className="bg-gray-100 text-gray-600">U</AvatarFallback>
                    </Avatar>
                  )}
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="flex gap-3 max-w-[90%] w-full">
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarFallback className="bg-blue-100 text-blue-600">
                      <Bot className="w-4 h-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="rounded-lg px-3 py-2 bg-gray-100 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm text-gray-600">Thinking...</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Scroll anchor */}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Quick Actions */}
        <div className="px-4 py-2 border-t bg-gray-50 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-500">
              {selectedChartId && (
                <div className="flex items-center gap-1">
                  <Eye className="w-3 h-3" />
                  Focused on chart
                </div>
              )}
            </div>

            <div className="flex items-center gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={copyLastResponse}
                      className="w-8 h-8 p-0"
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Copy last response</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" onClick={exportChat} className="w-8 h-8 p-0">
                      <Download className="w-3 h-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Export chat</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={loadDashboardContextWrapper}
                      disabled={isLoading}
                      className="w-8 h-8 p-0"
                    >
                      {isLoading ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3 h-3" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Refresh context</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </div>

        {/* Input Area */}
        <div className="p-4 border-t flex-shrink-0">
          <form
            className="flex gap-2 relative"
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
          >
            <Input
              ref={inputRef}
              placeholder={`Ask about ${dashboardTitle}...`}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              className="pr-10"
            />
            <div className="absolute right-12 top-1/2 -translate-y-1/2 text-muted-foreground">
              {!isLoading && inputValue.trim() && <CornerDownLeft className="w-4 h-4 opacity-70" />}
            </div>
            <Button type="submit" size="icon" disabled={isLoading || !inputValue.trim()}>
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </form>

          {/* Context status */}
          <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
            <div className="flex items-center gap-2">
              {settings.include_data ? (
                <div className="flex items-center gap-1 text-green-600">
                  <Database className="w-3 h-3" />
                  Data sharing enabled
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  Schema only
                </div>
              )}
            </div>

            {!dashboardContext && settings.auto_context && (
              <Button
                variant="link"
                size="sm"
                onClick={loadDashboardContextWrapper}
                className="h-auto p-0 text-xs"
                disabled={isLoading}
              >
                Load context
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
