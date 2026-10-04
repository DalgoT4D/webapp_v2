'use client';

import { Skeleton } from '@/components/ui/skeleton';
import {
  Table as TableComponent,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const SKELETON_ROW_COUNT = 8; // rows shown while the first page loads

/** Placeholder table shown while the chart list loads. */
export function ChartListSkeleton() {
  return (
    <div className="py-6">
      <div className="border rounded-lg bg-white">
        <TableComponent className="table-fixed">
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="w-[28%]">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-4" />
                </div>
              </TableHead>
              <TableHead className="w-[18%]">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-4" />
                </div>
              </TableHead>
              <TableHead className="w-[8%]">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-4 w-4" />
                </div>
              </TableHead>
              <TableHead className="w-[18%]">
                <Skeleton className="h-4 w-20" />
              </TableHead>
              <TableHead className="w-[14%]">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-4" />
                </div>
              </TableHead>
              <TableHead className="w-[14%]">
                <Skeleton className="h-4 w-16" />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(SKELETON_ROW_COUNT)].map((_, i) => (
              <TableRow key={i}>
                <TableCell className="py-4">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-8 w-8 rounded" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-24" />
                </TableCell>
                <TableCell>
                  <div className="flex">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-6 w-6 rounded-full" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-20" />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-8 w-8" />
                    <Skeleton className="h-8 w-8" />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </TableComponent>
      </div>
    </div>
  );
}
