'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Eye, ExternalLink, AlertCircle, Calendar } from 'lucide-react';
import { usePublicReport } from '@/hooks/api/useReports';
import { DashboardNativeView } from '@/components/dashboard/dashboard-native-view';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

interface PublicReportViewProps {
  token: string;
}

export function PublicReportView({ token }: PublicReportViewProps) {
  const { viewData, isLoading, isError } = usePublicReport(token);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading report...</p>
        </div>
      </div>
    );
  }

  if (isError || !viewData?.is_valid) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Report Not Found</h2>
            <p className="text-gray-600 mb-4">
              This report is no longer available or the link has expired.
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

  const { dashboard_data, report_metadata, frozen_chart_configs, org_name } = viewData;

  const formatDateShort = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 w-full overflow-x-hidden">
      {/* Public Header */}
      <header className="bg-white border-b">
        <div className="px-3 sm:px-4 py-3 sm:py-4">
          {/* Mobile Layout */}
          <div className="block sm:hidden">
            <div className="flex items-center justify-between mb-3">
              <Image
                src="/dalgo_logo.svg"
                alt="Dalgo"
                width={50}
                height={24}
                className="flex-shrink-0"
              />
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-2 py-1">
                <div className="text-xs font-semibold text-blue-900">{org_name}</div>
              </div>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
                {report_metadata.title}
              </h1>
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                <Calendar className="h-4 w-4 flex-shrink-0" />
                <span>
                  {report_metadata.period_start
                    ? formatDateShort(report_metadata.period_start)
                    : 'All'}{' '}
                  - {formatDateShort(report_metadata.period_end)}
                </span>
              </div>
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
              <Image
                src="/dalgo_logo.svg"
                alt="Dalgo"
                width={60}
                height={28}
                className="flex-shrink-0"
              />
              <div>
                <h1 className="text-xl font-semibold text-gray-900">{report_metadata.title}</h1>
                <div className="flex items-center gap-3 text-sm text-gray-600 mt-1">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" />
                    {report_metadata.period_start
                      ? formatDateShort(report_metadata.period_start)
                      : 'All'}{' '}
                    - {formatDateShort(report_metadata.period_end)}
                  </span>
                  <Eye className="h-4 w-4" />
                  <span>Public View</span>
                  <Badge variant="secondary" className="text-xs ml-2">
                    Read Only
                  </Badge>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
              <div className="text-sm font-semibold text-blue-900">{org_name}</div>
              <div className="text-xs text-blue-600">Organization</div>
            </div>
          </div>
        </div>
      </header>

      {/* Executive Summary (read-only) */}
      <DashboardNativeView
        dashboardId={0}
        dashboardData={dashboard_data}
        isReportMode={true}
        isPublicMode={true}
        publicToken={token}
        frozenChartConfigs={frozen_chart_configs}
        hideHeader={true}
        beforeContent={
          report_metadata.summary ? (
            <div className="border rounded-lg p-5 mb-2 bg-background">
              <h2 className="text-lg font-semibold mb-2">Executive Summary</h2>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {report_metadata.summary}
              </p>
            </div>
          ) : undefined
        }
      />

      {/* Footer */}
      <footer className="bg-white border-t">
        <div className="px-3 sm:px-4 py-2 text-center text-xs text-gray-600">
          <p>
            Powered by{' '}
            <Link
              href="https://dalgo.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-blue-600 hover:underline"
            >
              Dalgo
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
