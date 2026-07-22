'use client';

import { buildDocsUrl } from '@/components/ui/docs-link';

/**
 * "Learn how roles and access work" link for the People/Groups empty
 * states. Reuses DocsLink's buildDocsUrl helper only; renders plain text
 * when NEXT_PUBLIC_DOCS_BASE_URL isn't configured, same as DocsLink.
 */
export function LearnAccessLink() {
  const href = buildDocsUrl('/access');
  const label = 'Learn how roles and access work';

  if (!href) {
    return (
      <span data-testid="learn-access-link" className="text-sm text-muted-foreground">
        {label}
      </span>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="learn-access-link"
      className="text-sm text-primary underline hover:no-underline"
    >
      {label}
    </a>
  );
}
