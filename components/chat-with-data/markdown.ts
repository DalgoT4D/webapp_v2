/**
 * Parser for the answer markdown SUBSET the chat agent is allowed to emit
 * (see DDP_backend prompts.py "How to answer"). Deliberately hand-rolled:
 * everything outside the subset renders as literal text, so the model can
 * never inject links, HTML, or headings we don't style.
 */

export type InlineNode = { type: 'text' | 'bold'; text: string };

export type Block =
  | { type: 'p' | 'h' | 'callout'; children: InlineNode[] }
  | { type: 'ul' | 'ol'; items: InlineNode[][] };

const UL_ITEM = /^[-*]\s+(.*)$/;
const OL_ITEM = /^\d+[.)]\s+(.*)$/;
// any #-depth collapses to one topic-heading style — chat has no hierarchy
const HEADING = /^#{1,6}\s+(.*)$/;
const CALLOUT = /^>\s+(.*)$/;

// **bold** — non-greedy, no nesting (the prompt only asks for bold runs)
const INLINE_TOKEN = /\*\*([^*]+)\*\*/g;

export function parseInline(text: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  let last = 0;
  for (const match of text.matchAll(INLINE_TOKEN)) {
    if (match.index > last) {
      nodes.push({ type: 'text', text: text.slice(last, match.index) });
    }
    nodes.push({ type: 'bold', text: match[1] });
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    nodes.push({ type: 'text', text: text.slice(last) });
  }
  return nodes;
}

export function parseBlocks(content: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];

  const flushParagraph = () => {
    const text = paragraph.join('\n').trim();
    if (text) blocks.push({ type: 'p', children: parseInline(text) });
    paragraph = [];
  };

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trimEnd();
    const headingMatch = line.match(HEADING);
    if (headingMatch) {
      flushParagraph();
      blocks.push({ type: 'h', children: parseInline(headingMatch[1]) });
      continue;
    }

    const calloutMatch = line.match(CALLOUT);
    if (calloutMatch) {
      flushParagraph();
      blocks.push({ type: 'callout', children: parseInline(calloutMatch[1]) });
      continue;
    }

    const ulMatch = line.match(UL_ITEM);
    const olMatch = line.match(OL_ITEM);

    if (ulMatch || olMatch) {
      flushParagraph();
      const type = ulMatch ? 'ul' : 'ol';
      const item = parseInline((ulMatch ?? olMatch)![1]);
      const previous = blocks[blocks.length - 1];
      if (previous && previous.type === type) {
        previous.items.push(item);
      } else {
        blocks.push({ type, items: [item] });
      }
    } else if (!line.trim()) {
      flushParagraph();
    } else {
      paragraph.push(line);
    }
  }
  flushParagraph();
  return blocks;
}
