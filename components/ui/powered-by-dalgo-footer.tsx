import Link from 'next/link';
import { cn } from '@/lib/utils';

interface PoweredByDalgoFooterProps {
  theme?: 'light' | 'dark';
  className?: string;
}

export function PoweredByDalgoFooter({ theme = 'light', className }: PoweredByDalgoFooterProps) {
  const isDark = theme === 'dark';

  return (
    <footer
      className={cn(
        'border-t flex-shrink-0',
        isDark ? 'bg-gray-800 border-gray-700' : 'bg-card border-border',
        className
      )}
    >
      <div
        className={cn(
          'px-3 sm:px-4 py-2 text-center text-xs',
          isDark ? 'text-gray-400' : 'text-muted-foreground'
        )}
      >
        <p>
          Powered by{' '}
          <Link
            href="https://dalgo.org/"
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'font-medium hover:underline',
              isDark ? 'text-blue-400' : 'text-blue-600'
            )}
          >
            Dalgo
          </Link>
        </p>
      </div>
    </footer>
  );
}
