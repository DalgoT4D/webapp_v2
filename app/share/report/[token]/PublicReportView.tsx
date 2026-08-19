'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { PoweredByDalgoImage } from '@/components/ui/powered-by-dalgo-image';
import { Eye, ExternalLink, AlertCircle, Calendar } from 'lucide-react';
import { usePublicReport } from '@/hooks/api/useReports';
import { formatDateShort } from '@/components/reports/utils';
import { DashboardNativeView } from '@/components/dashboard/dashboard-native-view';
import { PrintLayout } from '@/components/reports/print-layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { PoweredByDalgoFooter } from '@/components/ui/powered-by-dalgo-footer';
import { OrgBrand } from '@/components/ui/org-brand';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';

interface PublicReportViewProps {
  token: string;
  printMode?: boolean;
}

export function PublicReportView({ token, printMode = false }: PublicReportViewProps) {
  const { viewData, isLoading, isError } = usePublicReport(token);

  // Public views are anonymous: no identified person and no organization group to attach,
  // so org_name rides along as an event property (the documented exception to "don't put
  // org on events"). Unlike the public dashboard payload this one carries no org_slug, so
  // org_name is the only breakdown key available here.
  //
  // printMode is excluded on purpose: `?print=true` renders this same component for the
  // PDF-capture pass, so counting it would log a machine fetch as a human read every time
  // someone exports. Ref keyed on the token so an SWR revalidation, a re-render, or
  // StrictMode's double effect in dev can't double-fire it.
  const trackedTokenRef = useRef<string | null>(null);
  useEffect(() => {
    if (printMode || !viewData?.is_valid) return;
    if (trackedTokenRef.current === token) return;
    trackedTokenRef.current = token;
    trackEvent(ANALYTICS_EVENTS.PUBLIC_REPORT_VIEWED, {
      org_name: viewData.org_name,
      report_id: viewData.report_metadata?.snapshot_id,
    });
  }, [
    printMode,
    viewData?.is_valid,
    viewData?.org_name,
    viewData?.report_metadata?.snapshot_id,
    token,
  ]);

  if (isLoading) {
    if (printMode) return null;
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

  const { dashboard_data, report_metadata, frozen_chart_configs, org_name, org_logo_url } =
    viewData;

  // Print mode: document-flow layout for page-break-safe PDF capture
  if (printMode) {
    return (
      <div className="bg-white w-full" data-pdf-ready="true">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          {/* Left: org logo + report title */}
          <div className="flex items-center gap-4">
            <OrgBrand logoUrl={org_logo_url} name={org_name} />
            <div>
              <h1 className="text-xl font-semibold text-gray-900">{report_metadata.title}</h1>
              <div className="flex items-center gap-2 text-sm text-gray-600 mt-1 flex-wrap">
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  {report_metadata.period_start
                    ? formatDateShort(report_metadata.period_start)
                    : 'All'}{' '}
                  - {formatDateShort(report_metadata.period_end)}
                </span>
                {report_metadata.created_by && (
                  <>
                    <span className="text-gray-300">|</span>
                    <span>Created by: {report_metadata.created_by}</span>
                  </>
                )}
                {report_metadata.dashboard_title && (
                  <>
                    <span className="text-gray-300">|</span>
                    <span>{report_metadata.dashboard_title}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          {/* Right: Powered by Dalgo */}
          <PoweredByDalgoImage imageClassName="max-h-16" />
        </div>

        {report_metadata.summary && (
          <div className="border rounded-lg p-5 m-6 bg-background overflow-hidden">
            <h2 className="text-lg font-semibold mb-2">Executive Summary</h2>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">
              {report_metadata.summary}
            </p>
          </div>
        )}

        <PrintLayout
          dashboardData={dashboard_data}
          frozenChartConfigs={frozen_chart_configs}
          publicToken={token}
          isPublicMode={true}
        />
      </div>
    );
  }

  // Normal public view
  return (
    <div className="min-h-screen bg-gray-50 w-full overflow-x-hidden">
      {/* Public Header */}
      <header className="bg-white border-b">
        <div className="px-6 py-4 flex items-center justify-between">
          {/* Left: Org logo + report title + status */}
          <div className="flex items-center gap-4">
            <OrgBrand logoUrl={org_logo_url} name={org_name} />
            <div>
              <h1 className="text-lg font-bold text-gray-900">{report_metadata.title}</h1>
              <div className="flex items-center gap-2 text-sm text-gray-500 mt-0.5 flex-wrap">
                <Calendar className="h-3.5 w-3.5" />
                <span>
                  {report_metadata.period_start
                    ? formatDateShort(report_metadata.period_start)
                    : 'All'}{' '}
                  - {formatDateShort(report_metadata.period_end)}
                </span>
                <span className="text-gray-300">|</span>
                <Eye className="h-3.5 w-3.5" />
                <span>Public View</span>
                <span className="text-gray-300">|</span>
                <Badge variant="secondary" className="text-xs">
                  Read Only
                </Badge>
              </div>
            </div>
          </div>

          {/* Right: Powered by Dalgo */}
          <PoweredByDalgoImage imageClassName="max-h-12" />
        </div>
      </header>

      {/* Dashboard canvas — filter sidebar spans full height alongside summary + tabs + charts */}
      <DashboardNativeView
        dashboardId={0}
        dashboardData={dashboard_data}
        isReportMode={true}
        isPublicMode={true}
        publicToken={token}
        frozenChartConfigs={frozen_chart_configs}
        hideHeader={true}
        topRightContent={
          report_metadata.summary ? (
            <div className="flex-shrink-0 px-4 sm:px-6 pt-4 pb-2">
              <div className="border rounded-lg p-5 bg-background overflow-hidden">
                <h2 className="text-lg font-semibold mb-2">Executive Summary</h2>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">
                  {report_metadata.summary}
                </p>
              </div>
            </div>
          ) : undefined
        }
      />

      {/* Footer */}
      <PoweredByDalgoFooter />
    </div>
  );
}
