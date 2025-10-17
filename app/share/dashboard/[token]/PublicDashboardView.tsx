'use client';

import type { ErrorInfo, ReactNode } from 'react';
import React, { Component, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Eye, ExternalLink, AlertCircle, Clock, Code, Copy, Check } from 'lucide-react';
import { usePublicDashboard } from '@/hooks/api/useDashboards';
import { DashboardNativeView } from '@/components/dashboard/dashboard-native-view';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

interface EmbedOptions {
  showTitle: boolean;
  showOrganization: boolean;
  theme: 'light' | 'dark';
  showPadding: boolean;
}

interface PublicDashboardViewProps {
  token: string;
  isEmbedMode?: boolean;
  embedOptions?: EmbedOptions;
}

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('DashboardNativeView Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-red-200 p-4 m-4">
          <p>ERROR in DashboardNativeView: {this.state.error?.message}</p>
          <p>Stack: {this.state.error?.stack}</p>
        </div>
      );
    }

    return this.props.children;
  }
}

interface EmbedCodeDropdownProps {
  token: string;
  dashboardTitle: string;
}

function EmbedCodeDropdown({ token, dashboardTitle }: EmbedCodeDropdownProps) {
  const [copied, setCopied] = useState(false);
  const [embedOptions, setEmbedOptions] = useState({
    showTitle: true,
    showOrganization: true,
    theme: 'light' as 'light' | 'dark',
    showPadding: true,
    width: 800,
    height: 600,
  });

  const generateEmbedCode = () => {
    const baseUrl = window.location.origin;
    const params = new URLSearchParams({
      embed: 'true',
      title: embedOptions.showTitle.toString(),
      org: embedOptions.showOrganization.toString(),
      theme: embedOptions.theme,
      padding: embedOptions.showPadding.toString(),
    });

    const embedUrl = `${baseUrl}/share/dashboard/${token}?${params.toString()}`;

    return `<!-- allow-popups permission enables the "Powered by Dalgo" link to open in a new tab -->
<iframe
  src="${embedUrl}"
  width="${embedOptions.width}"
  height="${embedOptions.height}"
  frameborder="0"
  allowfullscreen
  title="${dashboardTitle}"
  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
></iframe>`;
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(generateEmbedCode());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy embed code:', error);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Code className="h-4 w-4" />
          Copy Code
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-4">
        <div className="space-y-4">
          <div>
            <h3 className="font-medium mb-3">Embed Dashboard</h3>

            {/* Embed Options */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Show title</Label>
                <Switch
                  checked={embedOptions.showTitle}
                  onCheckedChange={(checked) =>
                    setEmbedOptions((prev) => ({ ...prev, showTitle: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-sm">Show organization</Label>
                <Switch
                  checked={embedOptions.showOrganization}
                  onCheckedChange={(checked) =>
                    setEmbedOptions((prev) => ({ ...prev, showOrganization: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-sm">Show padding</Label>
                <Switch
                  checked={embedOptions.showPadding}
                  onCheckedChange={(checked) =>
                    setEmbedOptions((prev) => ({ ...prev, showPadding: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-sm">Theme</Label>
                <select
                  value={embedOptions.theme}
                  onChange={(e) =>
                    setEmbedOptions((prev) => ({
                      ...prev,
                      theme: e.target.value as 'light' | 'dark',
                    }))
                  }
                  className="text-sm border rounded px-2 py-1"
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-gray-600">Width</Label>
                  <input
                    type="number"
                    value={embedOptions.width}
                    onChange={(e) =>
                      setEmbedOptions((prev) => ({
                        ...prev,
                        width: parseInt(e.target.value) || 800,
                      }))
                    }
                    className="w-full text-sm border rounded px-2 py-1 mt-1"
                    min="300"
                    max="1200"
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-600">Height</Label>
                  <input
                    type="number"
                    value={embedOptions.height}
                    onChange={(e) =>
                      setEmbedOptions((prev) => ({
                        ...prev,
                        height: parseInt(e.target.value) || 600,
                      }))
                    }
                    className="w-full text-sm border rounded px-2 py-1 mt-1"
                    min="300"
                    max="1000"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Generated Code */}
          <div className="space-y-2">
            <Label className="text-sm">Embed Code</Label>
            <textarea
              value={generateEmbedCode()}
              readOnly
              className="w-full text-xs font-mono p-2 border rounded bg-gray-50 resize-none"
              rows={5}
            />
            <Button
              onClick={handleCopyCode}
              variant={copied ? 'default' : 'outline'}
              size="sm"
              className="w-full"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Embed Code
                </>
              )}
            </Button>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function PublicDashboardView({
  token,
  isEmbedMode = false,
  embedOptions,
}: PublicDashboardViewProps) {
  const { dashboard, isLoading, isError } = usePublicDashboard(token);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (isError || !dashboard?.is_valid) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Dashboard Not Found</h2>
            <p className="text-gray-600 mb-4">
              This dashboard is no longer available or the link has expired.
            </p>
            <Link href="https://dalgo.org" target="_blank">
              <Button variant="outline">
                Learn about Dalgo
                <ExternalLink className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Apply theme and padding options
  const containerClasses = isEmbedMode
    ? `h-full flex flex-col w-full overflow-x-hidden ${
        embedOptions?.theme === 'dark' ? 'bg-gray-900' : 'bg-white'
      } ${embedOptions?.showPadding ? 'p-4' : ''}`
    : 'min-h-screen bg-gray-50 w-full overflow-x-hidden';

  return (
    <div className={containerClasses}>
      {/* Public Header - Responsive - Hidden in embed mode */}
      {!isEmbedMode && (
        <header className="bg-white border-b">
          <div className="px-3 sm:px-4 py-3 sm:py-4">
            {/* Mobile Layout */}
            <div className="block sm:hidden">
              {/* Mobile Top Row - Logo and Org */}
              <div className="flex items-center justify-between mb-3">
                <Image
                  src="/dalgo_logo.svg"
                  alt="Dalgo"
                  width={50}
                  height={24}
                  className="flex-shrink-0"
                />
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-2 py-1">
                  <div className="text-xs font-semibold text-blue-900">{dashboard.org_name}</div>
                </div>
              </div>
              {/* Mobile Bottom Row - Title and Status */}
              <div>
                <h1 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
                  {dashboard.title}
                </h1>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Eye className="h-4 w-4 flex-shrink-0" />
                    <span>Public View</span>
                    <Badge variant="secondary" className="text-xs">
                      Read Only
                    </Badge>
                  </div>
                  <EmbedCodeDropdown token={token} dashboardTitle={dashboard.title} />
                </div>
              </div>
            </div>

            {/* Desktop Layout */}
            <div className="hidden sm:flex items-center justify-between">
              <div className="flex items-center gap-4">
                {/* Dalgo Logo - sized and aligned like main app */}
                <Image
                  src="/dalgo_logo.svg"
                  alt="Dalgo"
                  width={60}
                  height={28}
                  className="flex-shrink-0"
                />
                <div>
                  <h1 className="text-xl font-semibold text-gray-900">{dashboard.title}</h1>
                  <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                    <Eye className="h-4 w-4" />
                    <span>Public View</span>
                    <Badge variant="secondary" className="text-xs ml-2">
                      Read Only
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Organization name and Copy Code button */}
              <div className="flex items-center gap-3">
                <EmbedCodeDropdown token={token} dashboardTitle={dashboard.title} />
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
                  <div className="text-sm font-semibold text-blue-900">{dashboard.org_name}</div>
                  <div className="text-xs text-blue-600">Organization</div>
                </div>
              </div>
            </div>
          </div>
        </header>
      )}

      {/* Embed Mode Title/Organization - Show when enabled */}
      {isEmbedMode && (embedOptions?.showTitle || embedOptions?.showOrganization) && (
        <div
          className={`px-4 py-3 border-b flex-shrink-0 ${
            embedOptions.theme === 'dark'
              ? 'bg-gray-800 border-gray-700'
              : 'bg-white border-gray-200'
          }`}
        >
          <div className="flex items-center justify-between">
            {/* Title - Left side */}
            {embedOptions?.showTitle && (
              <div className="flex-1">
                <h1
                  className={`font-semibold ${
                    embedOptions.theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}
                  style={{ fontSize: '24px' }}
                >
                  {dashboard.title}
                </h1>
              </div>
            )}

            {/* Organization - Right side */}
            {embedOptions?.showOrganization && (
              <div className={`${embedOptions?.showTitle ? 'ml-4' : 'flex-1'} text-right`}>
                <div
                  className={`font-medium ${
                    embedOptions.theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}
                  style={{ fontSize: '22px' }}
                >
                  {dashboard.org_name}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dashboard Native View - Public Mode */}
      <div className={isEmbedMode ? 'flex-1 overflow-auto' : ''}>
        <DashboardNativeView
          dashboardId={dashboard.id}
          isPublicMode={true}
          publicToken={token}
          dashboardData={dashboard}
          isEmbedMode={isEmbedMode}
          embedTheme={embedOptions?.theme}
        />
      </div>

      {/* Footer - Responsive - Only show in embed mode */}
      {isEmbedMode && (
        <footer
          className={`border-t flex-shrink-0 ${
            embedOptions?.theme === 'dark'
              ? 'bg-gray-800 border-gray-700'
              : 'bg-white border-gray-200'
          }`}
        >
          <div
            className={`px-3 sm:px-4 py-2 text-center text-xs ${
              embedOptions?.theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            }`}
          >
            <p>
              Powered by{' '}
              <Link
                href="https://dalgo.org/"
                target="_blank"
                rel="noopener noreferrer"
                className={`font-medium hover:underline ${
                  embedOptions?.theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                }`}
              >
                Dalgo
              </Link>
            </p>
          </div>
        </footer>
      )}
    </div>
  );
}
