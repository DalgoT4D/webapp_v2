'use client';

import { buildDocsUrl } from '@/components/ui/docs-link';

/**
 * The "Learn how roles and access work" link shared by the People and Groups
 * empty states (F1). Plain underlined text, no icon/tooltip — unlike
 * `DocsLink` (which wraps a page title), this is a standalone CTA link, so it
 * doesn't reuse that component directly, only its `buildDocsUrl` helper (the
 * app's one existing docs-base-URL mechanism — never a hand-rolled URL).
 * Renders the label as plain text (no link) when NEXT_PUBLIC_DOCS_BASE_URL
 * isn't configured — same degrade-quietly behavior as DocsLink.
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
