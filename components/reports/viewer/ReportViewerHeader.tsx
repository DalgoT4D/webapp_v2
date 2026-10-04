'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  Calendar,
  Download,
  LayoutGrid,
  Loader2,
  Mail,
  Share2,
  User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RequestEditPill } from '@/components/access/request-edit-pill';
import { formatDateShort } from '@/components/reports/utils';
import type { ReportMetadata, SnapshotViewData } from '@/types/reports';

interface ReportViewerHeaderProps {
  reportId: number;
  reportMetadata: ReportMetadata;
  accessLevel: SnapshotViewData['access_level'];
  /** Share + Email PDF buttons. */
  canShare: boolean;
  isExporting: boolean;
  onBack: () => void;
  onDownload: () => void;
  onShare: () => void;
  onEmail: () => void;
}

/** Report viewer header: Back, title, period / created by / source dashboard, and the actions. */
export function ReportViewerHeader({
  reportId,
  reportMetadata,
  accessLevel,
  canShare,
  isExporting,
  onBack,
  onDownload,
  onShare,
  onEmail,
}: ReportViewerHeaderProps) {
  return (
    <div className="flex-shrink-0 border-b bg-background shadow-sm px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <Button variant="ghost" size="sm" data-testid="report-back-btn" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold text-foreground" data-testid="report-title">
              {reportMetadata.title}
            </h1>
            {/* Metadata below title */}
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1" data-testid="report-period">
                <Calendar className="w-3 h-3" />
                {reportMetadata.period_start
                  ? formatDateShort(reportMetadata.period_start)
                  : 'All'}{' '}
                - {formatDateShort(reportMetadata.period_end)}
              </span>
              {reportMetadata.created_by && (
                <span className="flex items-center gap-1" data-testid="report-created-by">
                  <User className="w-3 h-3" />
                  Created by: {reportMetadata.created_by}
                </span>
              )}
              {reportMetadata.dashboard_title &&
                (reportMetadata.dashboard_id ? (
                  <Link
                    href={`/dashboards/${reportMetadata.dashboard_id}`}
                    className="flex items-center gap-1 hover:text-primary transition-colors"
                    data-testid="report-dashboard-link"
                  >
                    <LayoutGrid className="w-3 h-3" />
                    {reportMetadata.dashboard_title}
                  </Link>
                ) : (
                  <span className="flex items-center gap-1" data-testid="report-dashboard-title">
                    <LayoutGrid className="w-3 h-3" />
                    {reportMetadata.dashboard_title}
                  </span>
                ))}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <RequestEditPill rtype="report" resourceId={reportId} resourceAccessLevel={accessLevel} />
          <Button
            data-testid="report-download-btn"
            variant="outline"
            size="sm"
            aria-label="Download report as PDF"
            onClick={onDownload}
            disabled={isExporting}
          >
            {isExporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
          </Button>
          {canShare && (
            <>
              <Button
                data-testid="report-share-btn"
                variant="outline"
                size="sm"
                aria-label="Share report"
                onClick={onShare}
              >
                <Share2 className="w-4 h-4" />
              </Button>
              <Button
                data-testid="report-email-pdf-btn"
                variant="outline"
                size="sm"
                aria-label="Email PDF"
                onClick={onEmail}
              >
                <Mail className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
