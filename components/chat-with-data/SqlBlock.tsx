import { format } from 'sql-formatter';
import { cn } from '@/lib/utils';

function formatSql(sql: string): string {
  try {
    return format(sql, { language: 'sql', tabWidth: 2 });
  } catch {
    return sql;
  }
}

/** The bordered mono block the design uses for every piece of SQL */
export function SqlBlock({ sql, className }: { sql: string; className?: string }) {
  return (
    <pre
      className={cn(
        'font-roboto-mono w-full whitespace-pre-wrap rounded-lg border border-[#E8ECEF] bg-white px-3.5 py-2.5 text-[#334155]',
        className
      )}
      style={{ fontSize: '11px', lineHeight: '15px' }}
    >
      {formatSql(sql)}
    </pre>
  );
}
