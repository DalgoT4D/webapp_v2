'use client';

import { FileText, Mail, MoreVertical, Share2, Trash2, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TableCell, TableRow } from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ReportSnapshot } from '@/types/reports';
import { formatCreatedOn } from '@/components/reports/utils';
import { canDeleteListRow, hasEditAccess } from '@/components/access/logic/resource-permissions';

interface ReportListRowProps {
  snapshot: ReportSnapshot;
  canDelete: boolean;
  onOpenReport: (snapshotId: number) => void;
  onShare: (snapshot: ReportSnapshot) => void;
  onEmail: (snapshot: ReportSnapshot) => void;
  onDelete: (snapshot: ReportSnapshot) => void;
}

/** One report in the /reports table; the whole row opens the viewer. */
export function ReportListRow({
  snapshot,
  canDelete,
  onOpenReport,
  onShare,
  onEmail,
  onDelete,
}: ReportListRowProps) {
  return (
    <TableRow
      data-testid={`report-row-${snapshot.id}`}
      className="hover:bg-gray-50 cursor-pointer"
      onClick={() => onOpenReport(snapshot.id)}
    >
      <TableCell className="py-4">
        <span
          className="font-medium text-lg text-gray-900"
          data-testid={`report-row-title-${snapshot.id}`}
        >
          {snapshot.title}
        </span>
      </TableCell>
      <TableCell
        className="py-4 text-base text-gray-700"
        data-testid={`report-row-dashboard-${snapshot.id}`}
      >
        {snapshot.dashboard_title || '—'}
      </TableCell>
      <TableCell className="py-4">
        {snapshot.created_by && (
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center">
              <User className="w-3 h-3 text-gray-600" />
            </div>
            <span
              className="text-base text-gray-700"
              data-testid={`report-row-created-by-${snapshot.id}`}
            >
              {snapshot.created_by}
            </span>
          </div>
        )}
      </TableCell>
      <TableCell
        className="py-4 text-base text-gray-600"
        data-testid={`report-row-created-on-${snapshot.id}`}
      >
        {formatCreatedOn(snapshot.created_at)}
      </TableCell>
      <TableCell className="py-4">
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {hasEditAccess(snapshot.access_level) && (
            <Button
              data-testid={`report-share-${snapshot.id}`}
              variant="ghost"
              size="icon"
              className="h-8 w-8 p-0 hover:bg-gray-100"
              aria-label="Share report"
              onClick={() => onShare(snapshot)}
            >
              <Share2 className="w-4 h-4 text-gray-600" />
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                data-testid={`report-actions-${snapshot.id}`}
                variant="ghost"
                size="icon"
                className="h-8 w-8 p-0 hover:bg-gray-100"
                aria-label="Report actions"
              >
                <MoreVertical className="w-4 h-4 text-gray-600" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                data-testid={`report-view-${snapshot.id}`}
                onClick={() => onOpenReport(snapshot.id)}
              >
                <FileText className="h-4 w-4 mr-2" />
                View Report
              </DropdownMenuItem>
              {hasEditAccess(snapshot.access_level) && (
                <DropdownMenuItem
                  data-testid={`report-email-pdf-${snapshot.id}`}
                  onClick={() => onEmail(snapshot)}
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Email PDF
                </DropdownMenuItem>
              )}
              {canDeleteListRow('report', canDelete, snapshot.access_level) && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    data-testid={`report-delete-${snapshot.id}`}
                    onClick={() => onDelete(snapshot)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </TableCell>
    </TableRow>
  );
}
