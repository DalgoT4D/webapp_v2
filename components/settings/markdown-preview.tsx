'use client';

import { MarkdownContent } from '@/components/ui/markdown-content';

interface MarkdownPreviewProps {
  markdown: string;
  emptyMessage?: string;
}

export function MarkdownPreview({
  markdown,
  emptyMessage = 'Nothing to preview yet.',
}: MarkdownPreviewProps) {
  return <MarkdownContent markdown={markdown} emptyMessage={emptyMessage} />;
}
