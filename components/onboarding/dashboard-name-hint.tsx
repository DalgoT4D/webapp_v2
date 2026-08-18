import { cn } from '@/lib/utils';

interface DashboardNameHintProps {
  id: string;
  className?: string;
}

export function DashboardNameHint({ id, className }: DashboardNameHintProps) {
  return (
    <span id={id} className={cn('text-xs font-normal text-muted-foreground', className)}>
      Use a clear name so it’s easy to find when adding it to a dashboard.
    </span>
  );
}
