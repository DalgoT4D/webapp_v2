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
import { SkeletonConfig } from './types';

interface DataTableSkeletonProps {
  config: SkeletonConfig;
}

export function DataTableSkeleton({ config }: DataTableSkeletonProps) {
  const { rowCount = 8, columns } = config;

  const renderSkeletonCell = (
    cellType: 'text' | 'icon' | 'avatar' | 'badge' | 'actions' = 'text',
    index: number
  ) => {
    switch (cellType) {
      case 'icon':
        return (
          <div className="flex justify-center">
            <Skeleton className="h-10 w-10 rounded-lg" />
          </div>
        );
      case 'avatar':
        return (
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-6 rounded-full" />
            <Skeleton className="h-4 w-20" />
          </div>
        );
      case 'badge':
        return <Skeleton className="h-6 w-16" />;
      case 'actions':
        return (
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-8" />
          </div>
        );
      case 'text':
      default:
        // First column usually has icon + text
        if (index === 0) {
          return (
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded" />
              <Skeleton className="h-4 w-32" />
            </div>
          );
        }
        return <Skeleton className="h-4 w-24" />;
    }
  };

  return (
    <div className="py-6">
      <div className="border rounded-lg bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              {columns.map((col, idx) => (
                <TableHead key={idx} className={col.width}>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-4" />
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(rowCount)].map((_, rowIdx) => (
              <TableRow key={rowIdx}>
                {columns.map((col, colIdx) => (
                  <TableCell key={colIdx} className="py-4">
                    {renderSkeletonCell(col.cellType, colIdx)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
