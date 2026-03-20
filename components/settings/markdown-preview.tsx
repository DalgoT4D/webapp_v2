'use client';

import { Fragment } from 'react';

interface MarkdownPreviewProps {
  markdown: string;
  emptyMessage?: string;
}

function renderInlineText(text: string) {
  return text;
}

export function MarkdownPreview({
  markdown,
  emptyMessage = 'Nothing to preview yet.',
}: MarkdownPreviewProps) {
  const trimmedMarkdown = markdown.trim();

  if (!trimmedMarkdown) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  const blocks = trimmedMarkdown
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  return (
    <div className="space-y-4 text-sm leading-6 text-slate-700">
      {blocks.map((block) => {
        const lines = block
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean);

        if (lines.length === 1 && lines[0].startsWith('### ')) {
          return (
            <h3 key={`heading-3-${lines[0]}`} className="text-base font-semibold text-slate-900">
              {renderInlineText(lines[0].slice(4))}
            </h3>
          );
        }

        if (lines.length === 1 && lines[0].startsWith('## ')) {
          return (
            <h2 key={`heading-2-${lines[0]}`} className="text-lg font-semibold text-slate-900">
              {renderInlineText(lines[0].slice(3))}
            </h2>
          );
        }

        if (lines.length === 1 && lines[0].startsWith('# ')) {
          return (
            <h1 key={`heading-1-${lines[0]}`} className="text-xl font-semibold text-slate-900">
              {renderInlineText(lines[0].slice(2))}
            </h1>
          );
        }

        if (lines.every((line) => line.startsWith('- '))) {
          return (
            <ul key={`list-${lines.join('|')}`} className="list-disc space-y-1 pl-5">
              {lines.map((line) => (
                <li key={`${block}-${line}`}>{renderInlineText(line.slice(2))}</li>
              ))}
            </ul>
          );
        }

        return (
          <p key={`paragraph-${lines.join('|')}`}>
            {lines.map((line, lineIndex) => (
              <Fragment key={`${block}-${line}`}>
                {lineIndex > 0 ? <br /> : null}
                {renderInlineText(line)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
