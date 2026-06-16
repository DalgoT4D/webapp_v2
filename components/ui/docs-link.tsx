'use client';

import { BookOpen } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export function buildDocsUrl(path: string): string | null {
  const baseUrl = process.env.NEXT_PUBLIC_DOCS_BASE_URL;
  if (!baseUrl) return null;
  return `${baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}

interface DocsLinkProps {
  path: string;
  label?: string;
  className?: string;
}

export function DocsLink({ path, label = 'View documentation', className }: DocsLinkProps) {
  const href = buildDocsUrl(path);
  if (!href) return null;

  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={label}
          data-testid="docs-link"
          className={cn(
            'inline-flex items-center justify-center text-muted-foreground hover:text-teal-600 transition-colors',
            className
          )}
        >
          <BookOpen className="w-5 h-5" />
        </a>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
