import { cn } from '@/lib/utils';

/** The bordered mono block the design uses for every piece of SQL */
export function SqlBlock({ sql, className }: { sql: string; className?: string }) {
  return (
    <pre
      className={cn(
        'max-h-52 w-full overflow-auto rounded-lg border border-[#E8ECEF] bg-white px-3.5 py-2.5 font-mono text-xs leading-[1.4] text-[#334155]',
        className
      )}
    >
      {sql}
    </pre>
  );
}
