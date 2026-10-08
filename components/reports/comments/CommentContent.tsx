'use client';

import { memo, useMemo } from 'react';
import { parseCommentMentions } from '@/components/reports/utils';

/** Comment text with @mentions shown as highlighted emails. */
export const CommentContent = memo(function CommentContent({ content }: { content: string }) {
  const parts = useMemo(() => parseCommentMentions(content), [content]);

  return (
    <p className="text-sm mt-0.5 whitespace-pre-wrap break-all">
      {/* Index-as-key is safe: parts are derived from a static string, never reordered */}
      {parts.map((part, index) =>
        part.type === 'mention' ? (
          <span key={`mention-${index}`} className="text-primary font-medium">
            {part.value}
          </span>
        ) : (
          <span key={`text-${index}`}>{part.value}</span>
        )
      )}
    </p>
  );
});
