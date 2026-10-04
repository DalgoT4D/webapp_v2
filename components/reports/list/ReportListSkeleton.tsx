'use client';

import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const SKELETON_ROW_COUNT = 8; // rows shown while the list loads

/** Placeholder table shown while the reports list first loads (no filter set). */
export function ReportListSkeleton() {
  return (
    <div className="py-6" data-testid="report-list-skeleton">
      <div className="border rounded-lg bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="w-[25%]">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-4" />
                </div>
              </TableHead>
              <TableHead className="w-[30%]">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-4" />
                </div>
              </TableHead>
              <TableHead className="w-[20%]">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-4" />
                </div>
              </TableHead>
              <TableHead className="w-[15%]">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-4" />
                </div>
              </TableHead>
              <TableHead className="w-[10%]">
                <Skeleton className="h-4 w-16" />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(SKELETON_ROW_COUNT)].map((_, i) => (
              <TableRow key={i}>
                <TableCell className="py-4">
                  <Skeleton className="h-4 w-32" />
                </TableCell>
                <TableCell className="py-4">
                  <Skeleton className="h-4 w-28" />
                </TableCell>
                <TableCell className="py-4">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-6 w-6 rounded-full" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                </TableCell>
                <TableCell className="py-4">
                  <Skeleton className="h-4 w-24" />
                </TableCell>
                <TableCell className="py-4">
                  <Skeleton className="h-8 w-8" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
