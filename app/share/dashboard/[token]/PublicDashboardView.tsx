'use client';

import type { ErrorInfo, ReactNode } from 'react';
import React, { Component } from 'react';
import Link from 'next/link';

import { Eye, ExternalLink, AlertCircle, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { usePublicDashboard } from '@/hooks/api/useDashboards';
import { DashboardNativeView } from '@/components/dashboard/dashboard-native-view';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { PoweredByDalgoFooter } from '@/components/ui/powered-by-dalgo-footer';
import { PoweredByDalgoImage } from '@/components/ui/powered-by-dalgo-image';
import { OrgBrand } from '@/components/ui/org-brand';

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
      {/* Public Header - Hidden in embed mode */}
      {!isEmbedMode && (
        <header className="bg-white border-b">
          <div className="px-6 py-4 flex items-center justify-between">
            {/* Left: Org logo + dashboard title + status */}
            <div className="flex items-center gap-4">
              <OrgBrand logoUrl={dashboard.org_logo_url} name={dashboard.org_name} />
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-bold text-gray-900">{dashboard.title}</h1>
                  <Eye className="h-3.5 w-3.5 text-gray-500 flex-shrink-0" />
                  <span className="text-sm text-gray-500">Public View</span>
                  <span className="text-gray-300 text-sm">|</span>
                  <Badge variant="secondary" className="text-xs">
                    Read Only
                  </Badge>
                  {dashboard.updated_at && (
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <Clock className="h-3 w-3" />
                      <span>
                        Modified{' '}
                        {formatDistanceToNow(new Date(dashboard.updated_at), { addSuffix: true })}
                      </span>
                    </div>
                  )}
                </div>
                {dashboard.description && (
                  <p className="text-sm text-gray-600 mt-0.5">{dashboard.description}</p>
                )}
              </div>
            </div>

            {/* Right: Powered by Dalgo */}
            <PoweredByDalgoImage imageClassName="max-h-12" />
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
        <PoweredByDalgoFooter theme={embedOptions?.theme === 'dark' ? 'dark' : 'light'} />
      )}
    </div>
  );
}
