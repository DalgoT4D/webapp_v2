'use client';

import { parseBlocks, type InlineNode } from './markdown';

function Inline({ nodes }: { nodes: InlineNode[] }) {
  return (
    <>
      {nodes.map((node, i) => {
        if (node.type === 'bold') {
          return (
            // eslint-disable-next-line react/no-array-index-key
            <strong key={i} className="font-semibold">
              {node.text}
            </strong>
          );
        }
        if (node.type === 'code') {
          return (
            // eslint-disable-next-line react/no-array-index-key
            <code key={i} className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
              {node.text}
            </code>
          );
        }
        // eslint-disable-next-line react/no-array-index-key
        return <span key={i}>{node.text}</span>;
      })}
    </>
  );
}

/** Renders the agent's answer markdown subset. Plain text passes through unchanged. */
export function AssistantMarkdown({ content }: { content: string }) {
  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {parseBlocks(content).map((block, i) => {
        if (block.type === 'ul' || block.type === 'ol') {
          const List = block.type;
          return (
            <List
              // eslint-disable-next-line react/no-array-index-key
              key={i}
              className={
                block.type === 'ul' ? 'list-disc space-y-1 pl-5' : 'list-decimal space-y-1 pl-5'
              }
            >
              {block.items.map((item, j) => (
                // eslint-disable-next-line react/no-array-index-key
                <li key={j}>
                  <Inline nodes={item} />
                </li>
              ))}
            </List>
          );
        }
        if (block.type === 'callout') {
          return (
            <p
              // eslint-disable-next-line react/no-array-index-key
              key={i}
              data-testid="chat-answer-callout"
              className="rounded-md border-l-2 border-primary bg-primary/5 px-3 py-2 font-medium"
            >
              <Inline nodes={block.children} />
            </p>
          );
        }
        if (block.type === 'h') {
          return (
            // eslint-disable-next-line react/no-array-index-key
            <h3 key={i} className="pt-1 text-sm font-semibold">
              <Inline nodes={block.children} />
            </h3>
          );
        }
        return (
          // eslint-disable-next-line react/no-array-index-key
          <p key={i} className="whitespace-pre-wrap">
            <Inline nodes={block.children} />
          </p>
        );
      })}
    </div>
  );
}
