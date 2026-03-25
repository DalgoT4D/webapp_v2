'use client';

import { Fragment, type ReactNode } from 'react';

interface MarkdownContentProps {
  markdown: string;
  emptyMessage?: string;
  className?: string;
}

function renderInlineMarkdown(text: string, keyPrefix: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g).filter(Boolean);
  const occurrences = new Map<string, number>();

  return parts.map((part) => {
    const occurrence = occurrences.get(part) ?? 0;
    occurrences.set(part, occurrence + 1);
    const key = `${keyPrefix}-${part}-${occurrence}`;

    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={key}>{part.slice(2, -2)}</strong>;
    }

    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={key}
          className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.9em] text-slate-900"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      return (
        <a
          key={key}
          href={linkMatch[2]}
          target="_blank"
          rel="noreferrer"
          className="text-blue-700 underline underline-offset-2"
        >
          {linkMatch[1]}
        </a>
      );
    }

    return <Fragment key={key}>{part}</Fragment>;
  });
}

export function MarkdownContent({
  markdown,
  emptyMessage = 'Nothing to preview yet.',
  className = '',
}: MarkdownContentProps) {
  const trimmedMarkdown = markdown.trim();

  if (!trimmedMarkdown) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  const lines = trimmedMarkdown.split('\n');
  const elements: ReactNode[] = [];
  let paragraphLines: string[] = [];
  let bulletItems: string[] = [];
  let orderedItems: string[] = [];

  const flushParagraph = () => {
    if (paragraphLines.length === 0) {
      return;
    }

    const key = `paragraph-${elements.length}-${paragraphLines.join('|')}`;
    const lineOccurrences = new Map<string, number>();
    elements.push(
      <p key={key} className="text-sm leading-7 text-slate-700">
        {paragraphLines.map((line, index) => {
          const occurrence = lineOccurrences.get(line) ?? 0;
          lineOccurrences.set(line, occurrence + 1);

          return (
            <Fragment key={`${key}-${line}-${occurrence}`}>
              {index > 0 ? <br /> : null}
              {renderInlineMarkdown(line, `${key}-${occurrence}`)}
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

    const key = `bullets-${elements.length}-${bulletItems.join('|')}`;
    const itemOccurrences = new Map<string, number>();
    elements.push(
      <ul key={key} className="list-disc space-y-1 pl-5 text-sm leading-7 text-slate-700">
        {bulletItems.map((item) => {
          const occurrence = itemOccurrences.get(item) ?? 0;
          itemOccurrences.set(item, occurrence + 1);
          return (
            <li key={`${key}-${item}-${occurrence}`}>
              {renderInlineMarkdown(item, `${key}-${occurrence}`)}
            </li>
          );
        })}
      </ul>
    );
    bulletItems = [];
  };

  const flushOrdered = () => {
    if (orderedItems.length === 0) {
      return;
    }

    const key = `ordered-${elements.length}-${orderedItems.join('|')}`;
    const itemOccurrences = new Map<string, number>();
    elements.push(
      <ol key={key} className="list-decimal space-y-1 pl-5 text-sm leading-7 text-slate-700">
        {orderedItems.map((item) => {
          const occurrence = itemOccurrences.get(item) ?? 0;
          itemOccurrences.set(item, occurrence + 1);
          return (
            <li key={`${key}-${item}-${occurrence}`}>
              {renderInlineMarkdown(item, `${key}-${occurrence}`)}
            </li>
          );
        })}
      </ol>
    );
    orderedItems = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      flushBullets();
      flushOrdered();
      continue;
    }

    if (line.startsWith('### ')) {
      flushParagraph();
      flushBullets();
      flushOrdered();
      elements.push(
        <h3
          key={`heading-3-${elements.length}-${line}`}
          className="text-lg font-semibold tracking-tight text-slate-900"
        >
          {renderInlineMarkdown(line.slice(4), `heading-3-${elements.length}`)}
        </h3>
      );
      continue;
    }

    if (line.startsWith('## ')) {
      flushParagraph();
      flushBullets();
      flushOrdered();
      elements.push(
        <h2
          key={`heading-2-${elements.length}-${line}`}
          className="text-xl font-semibold tracking-tight text-slate-900"
        >
          {renderInlineMarkdown(line.slice(3), `heading-2-${elements.length}`)}
        </h2>
      );
      continue;
    }

    if (line.startsWith('# ')) {
      flushParagraph();
      flushBullets();
      flushOrdered();
      elements.push(
        <h1
          key={`heading-1-${elements.length}-${line}`}
          className="text-2xl font-bold tracking-tight text-slate-900"
        >
          {renderInlineMarkdown(line.slice(2), `heading-1-${elements.length}`)}
        </h1>
      );
      continue;
    }

    if (line.startsWith('- ')) {
      flushParagraph();
      flushOrdered();
      bulletItems.push(line.slice(2));
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      flushParagraph();
      flushBullets();
      orderedItems.push(line.replace(/^\d+\.\s+/, ''));
      continue;
    }

    flushBullets();
    flushOrdered();
    paragraphLines.push(line);
  }

  flushParagraph();
  flushBullets();
  flushOrdered();

  return <div className={`space-y-4 ${className}`.trim()}>{elements}</div>;
}
