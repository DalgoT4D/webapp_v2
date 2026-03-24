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

  const lines = trimmedMarkdown.split('\n');
  const elements: React.ReactNode[] = [];
  let paragraphLines: string[] = [];
  let bulletItems: string[] = [];

  const flushParagraph = () => {
    if (paragraphLines.length === 0) {
      return;
    }

    const key = `paragraph-${elements.length}-${paragraphLines.join('|')}`;
    const lineOccurrences = new Map<string, number>();
    elements.push(
      <p key={key} className="text-sm leading-7 text-slate-700">
        {paragraphLines.map((line) => {
          const occurrence = lineOccurrences.get(line) ?? 0;
          lineOccurrences.set(line, occurrence + 1);

          return (
            <Fragment key={`${key}-${line}-${occurrence}`}>
              {occurrence > 0 ? <br /> : null}
              {renderInlineText(line)}
            </Fragment>
          );
        })}
      </p>
    );
    paragraphLines = [];
  };

  const flushBullets = () => {
    if (bulletItems.length === 0) {
      return;
    }

    const key = `list-${elements.length}-${bulletItems.join('|')}`;
    const itemOccurrences = new Map<string, number>();
    elements.push(
      <ul key={key} className="list-disc space-y-1 pl-5 text-sm leading-7 text-slate-700">
        {bulletItems.map((item) => {
          const occurrence = itemOccurrences.get(item) ?? 0;
          itemOccurrences.set(item, occurrence + 1);

          return <li key={`${key}-${item}-${occurrence}`}>{renderInlineText(item)}</li>;
        })}
      </ul>
    );
    bulletItems = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      flushBullets();
      continue;
    }

    if (line.startsWith('### ')) {
      flushParagraph();
      flushBullets();
      elements.push(
        <h3
          key={`heading-3-${elements.length}-${line}`}
          className="text-lg font-semibold tracking-tight text-slate-900"
        >
          {renderInlineText(line.slice(4))}
        </h3>
      );
      continue;
    }

    if (line.startsWith('## ')) {
      flushParagraph();
      flushBullets();
      elements.push(
        <h2
          key={`heading-2-${elements.length}-${line}`}
          className="text-xl font-semibold tracking-tight text-slate-900"
        >
          {renderInlineText(line.slice(3))}
        </h2>
      );
      continue;
    }

    if (line.startsWith('# ')) {
      flushParagraph();
      flushBullets();
      elements.push(
        <h1
          key={`heading-1-${elements.length}-${line}`}
          className="text-2xl font-bold tracking-tight text-slate-900"
        >
          {renderInlineText(line.slice(2))}
        </h1>
      );
      continue;
    }

    if (line.startsWith('- ')) {
      flushParagraph();
      bulletItems.push(line.slice(2));
      continue;
    }

    flushBullets();
    paragraphLines.push(line);
  }

  flushParagraph();
  flushBullets();

  return <div className="space-y-4">{elements}</div>;
}
