'use client';

import type { ErrorInfo, ReactNode } from 'react';
import React, { Component } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Eye, ExternalLink, AlertCircle, Clock } from 'lucide-react';
import { usePublicDashboard } from '@/hooks/api/useDashboards';
import { DashboardNativeView } from '@/components/dashboard/dashboard-native-view';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

interface PublicDashboardViewProps {
  token: string;
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

export function PublicDashboardView({ token }: PublicDashboardViewProps) {
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

  return (
    <div className="min-h-screen bg-gray-50 w-full overflow-x-hidden">
      {/* Public Header - Responsive */}
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
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Eye className="h-4 w-4 flex-shrink-0" />
                <span>Public View</span>
                <Badge variant="secondary" className="text-xs">
                  Read Only
                </Badge>
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

            {/* Organization name - conspicuous in top right */}
            <div className="flex items-center">
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
                <div className="text-sm font-semibold text-blue-900">{dashboard.org_name}</div>
                <div className="text-xs text-blue-600">Organization</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Dashboard Native View - Public Mode */}
      <DashboardNativeView
        dashboardId={dashboard.id}
        isPublicMode={true}
        publicToken={token}
        dashboardData={dashboard}
      />

      {/* Footer - Responsive */}
      <footer className="bg-white border-t">
        <div className="px-3 sm:px-4 py-4 sm:py-6 text-center text-xs sm:text-sm text-gray-600">
          <p className="leading-relaxed">
            This dashboard is powered by{' '}
            <Link
              href="https://dalgo.org"
              target="_blank"
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              Dalgo
            </Link>{' '}
            <span className="hidden sm:inline">
              - Open source data platform for social sector organizations
            </span>
            <span className="block sm:hidden mt-1">Open source data platform</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
