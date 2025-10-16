'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, Clock, Eye } from 'lucide-react';
import { DashboardNativeView } from '@/components/dashboard/dashboard-native-view';
import { Card, CardContent } from '@/components/ui/card';
import type { PrivateEmbedOptions, ValidateTokenResponse } from '@/types/embed-tokens';

interface PrivateEmbedDashboardViewProps {
  token: string;
  embedOptions: PrivateEmbedOptions;
}

// Validation function using actual API endpoint
async function validateToken(token: string): Promise<ValidateTokenResponse> {
  try {
    const response = await fetch(`/api/embed-tokens/validate/${token}`);
    if (!response.ok) {
      throw new Error('Failed to validate token');
    }
    return await response.json();
  } catch (error) {
    console.error('Token validation failed:', error);
    return {
      valid: false,
      error: 'Failed to validate token',
    };
  }
}

// Function to track view using actual API endpoint
async function trackView(token: string) {
  try {
    await fetch(`/api/embed-tokens/validate/${token}/track-view`, { method: 'POST' });
    console.log('View tracked for token:', token);
  } catch (error) {
    console.error('Failed to track view:', error);
  }
}

export function PrivateEmbedDashboardView({ token, embedOptions }: PrivateEmbedDashboardViewProps) {
  const [validationState, setValidationState] = useState<{
    loading: boolean;
    result?: ValidateTokenResponse;
  }>({ loading: true });

  useEffect(() => {
    validateToken(token).then((result) => {
      setValidationState({ loading: false, result });

      // Track view if token is valid
      if (result.valid) {
        trackView(token);
      }
    });
  }, [token]);

  // Loading state
  if (validationState.loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">Validating access...</p>
        </div>
      </div>
    );
  }

  // Invalid token
  if (!validationState.result?.valid) {
    return (
      <div className="flex items-center justify-center h-screen p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Access Denied</h2>
            <p className="text-gray-600 mb-4">
              {validationState.result?.error ||
                'This embed link has expired, been revoked, or is invalid.'}
            </p>
            <Link href="https://dalgo.org" target="_blank">
              <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                Learn about Dalgo
              </button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { dashboard, token_info } = validationState.result;

  // Apply theme and padding options
  const containerClasses = `h-full flex flex-col w-full overflow-x-hidden ${
    embedOptions.theme === 'dark' ? 'bg-gray-900' : 'bg-white'
  } ${embedOptions.showPadding ? 'p-4' : ''}`;

  return (
    <div className={containerClasses}>
      {/* Embed Mode Title/Organization - Show when enabled */}
      {(embedOptions.showTitle || embedOptions.showOrganization) && (
        <div
          className={`px-4 py-3 border-b flex-shrink-0 ${
            embedOptions.theme === 'dark'
              ? 'bg-gray-800 border-gray-700'
              : 'bg-white border-gray-200'
          }`}
        >
          <div className="flex items-center justify-between">
            {/* Title - Left side */}
            {embedOptions.showTitle && (
              <div className="flex-1">
                <h1
                  className={`font-semibold ${
                    embedOptions.theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}
                  style={{ fontSize: '24px' }}
                >
                  {dashboard?.title}
                </h1>
              </div>
            )}

            {/* Organization - Right side */}
            {embedOptions.showOrganization && (
              <div className={`${embedOptions.showTitle ? 'ml-4' : 'flex-1'} text-right`}>
                <div
                  className={`font-medium ${
                    embedOptions.theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}
                  style={{ fontSize: '22px' }}
                >
                  {dashboard?.org_name}
                </div>
              </div>
            )}
          </div>

          {/* Token Info Badge */}
          <div className="mt-2 flex items-center gap-2 text-xs">
            <div
              className={`flex items-center gap-1 px-2 py-1 rounded ${
                embedOptions.theme === 'dark'
                  ? 'bg-gray-700 text-gray-300'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              <Eye className="h-3 w-3" />
              <span>{token_info?.view_count} views</span>
            </div>
            {token_info?.restrictions?.max_views && (
              <div
                className={`flex items-center gap-1 px-2 py-1 rounded ${
                  embedOptions.theme === 'dark'
                    ? 'bg-gray-700 text-gray-300'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                <span>Limit: {token_info.restrictions.max_views}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dashboard Content */}
      <div className="flex-1 overflow-auto">
        <DashboardNativeView
          dashboardId={dashboard?.id || 0}
          isPublicMode={true}
          dashboardData={dashboard?.data}
          isEmbedMode={true}
          embedTheme={embedOptions.theme}
        />
      </div>

      {/* Footer - Powered by Dalgo */}
      <footer
        className={`border-t flex-shrink-0 ${
          embedOptions.theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        }`}
      >
        <div
          className={`px-3 sm:px-4 py-2 text-center text-xs ${
            embedOptions.theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
          }`}
        >
          <p>
            Powered by{' '}
            <Link
              href="https://dalgo.org/"
              target="_blank"
              rel="noopener noreferrer"
              className={`font-medium hover:underline ${
                embedOptions.theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
              }`}
            >
              Dalgo
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
