'use client';

import { HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export function buildDocsUrl(path: string): string | null {
  const baseUrl = process.env.NEXT_PUBLIC_DOCS_BASE_URL;
  if (!baseUrl) return null;
  return `${baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}

interface DocsLinkProps {
  path: string;
  /** The title element (typically an h1) that the link wraps. */
  children: React.ReactNode;
  label?: string;
  className?: string;
}

export function DocsLink({
  path,
  children,
  label = 'View documentation',
  className,
}: DocsLinkProps) {
  const href = buildDocsUrl(path);
  // Without a configured docs base URL we render the title as-is — no link, no icon.
  if (!href) return <>{children}</>;

  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={label}
          data-testid="docs-link"
          className={cn('group inline-flex items-center gap-2', className)}
        >
          <span className="group-hover:underline">{children}</span>
          <HelpCircle className="w-4 h-4 text-muted-foreground group-hover:text-teal-600 transition-colors" />
        </a>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
