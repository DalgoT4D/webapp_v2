import type { JSONContent } from '@tiptap/core';

export interface UnifiedTextConfig {
  content: string;
  richText?: JSONContent;
  type: 'paragraph' | 'heading';
  headingLevel?: 1 | 2 | 3;
  fontSize: number;
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
  textDecoration: 'none' | 'underline';
  textAlign: 'left' | 'center' | 'right';
  color: string;
  backgroundColor?: string;
  contentConstraints?: { minWidth: number; minHeight: number };
}

const TEXT_ALIGNMENTS = new Set(['left', 'center', 'right']);
const ALLOWED_MARKS = new Set(['bold', 'italic', 'underline', 'textStyle']);
export const MIN_RICH_TEXT_FONT_SIZE = 10;
export const MAX_RICH_TEXT_FONT_SIZE = 32;
type RichTextMark = NonNullable<JSONContent['marks']>[number];

function legacyTextMarks(config: UnifiedTextConfig): RichTextMark[] {
  const marks: RichTextMark[] = [];
  if (config.fontWeight === 'bold') marks.push({ type: 'bold' });
  if (config.fontStyle === 'italic') marks.push({ type: 'italic' });
  if (config.textDecoration === 'underline') marks.push({ type: 'underline' });
  marks.push({
    type: 'textStyle',
    attrs: { color: config.color || '#000000', fontSize: `${config.fontSize || 16}px` },
  });
  return marks;
}

export function legacyConfigToRichText(config: UnifiedTextConfig): JSONContent {
  return {
    type: 'doc',
    content: (config.content || '').split('\n').map((line) => ({
      type: config.type === 'heading' ? 'heading' : 'paragraph',
      attrs:
        config.type === 'heading'
          ? { level: config.headingLevel || 2, textAlign: config.textAlign || 'left' }
          : { textAlign: config.textAlign || 'left' },
      ...(line ? { content: [{ type: 'text', text: line, marks: legacyTextMarks(config) }] } : {}),
    })),
  };
}

function sanitizeColor(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed;
  const shortHex = trimmed.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i);
  if (shortHex) {
    return `#${shortHex
      .slice(1)
      .map((part) => `${part}${part}`)
      .join('')}`;
  }

  // Browsers commonly normalize colors from pasted HTML to rgb()/rgba(), even
  // when the source used a hex value. Persist the same canonical JSON shape the
  // dashboard color controls produce.
  const rgb = trimmed.match(
    /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(\d*\.?\d+)\s*)?\)$/i
  );
  if (!rgb || (rgb[4] !== undefined && Number(rgb[4]) !== 1)) return undefined;
  const channels = rgb.slice(1, 4).map(Number);
  if (channels.some((channel) => channel < 0 || channel > 255)) return undefined;
  return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

function sanitizeFontSize(value: unknown): string | undefined {
  if (typeof value !== 'string' || !/^\d+(?:\.\d+)?px$/.test(value)) return undefined;
  const parsed = Number.parseFloat(value);
  if (Number.isNaN(parsed)) return undefined;
  return `${Math.max(MIN_RICH_TEXT_FONT_SIZE, Math.min(MAX_RICH_TEXT_FONT_SIZE, parsed))}px`;
}

export function sanitizeRichTextDocument(value: JSONContent): JSONContent {
  const sanitizeInlineNode = (node: JSONContent): JSONContent | null => {
    if (node.type === 'hardBreak') return { type: 'hardBreak' };
    if (node.type === 'text') {
      if (typeof node.text !== 'string' || !node.text.length) return null;
      const sanitized: JSONContent = { type: 'text', text: node.text };
      const candidateMarks = (node.marks || [])
        .filter((mark) => ALLOWED_MARKS.has(mark.type))
        .map((mark) => {
          if (mark.type !== 'textStyle') return { type: mark.type };
          const color = sanitizeColor(mark.attrs?.color);
          const fontSize = sanitizeFontSize(mark.attrs?.fontSize);
          return color || fontSize
            ? {
                type: 'textStyle',
                attrs: { ...(color ? { color } : {}), ...(fontSize ? { fontSize } : {}) },
              }
            : null;
        })
        .filter(Boolean) as RichTextMark[];
      // ProseMirror mark sets contain at most one mark of a given type. Merge
      // repeated textStyle attributes and discard duplicate boolean marks so
      // arbitrary persisted JSON is normalized before it reaches the editor.
      const marks = candidateMarks.reduce<RichTextMark[]>((result, mark) => {
        const existingIndex = result.findIndex((entry) => entry.type === mark.type);
        if (existingIndex < 0) return [...result, mark];
        if (mark.type === 'textStyle') {
          result[existingIndex] = {
            type: 'textStyle',
            attrs: { ...result[existingIndex].attrs, ...mark.attrs },
          };
        }
        return result;
      }, []);
      if (marks.length) sanitized.marks = marks;
      return sanitized;
    }
    return null;
  };

  const sanitizeBlockNode = (node: JSONContent): JSONContent | null => {
    if (node.type !== 'paragraph' && node.type !== 'heading') return null;
    const sanitized: JSONContent = { type: node.type };
    if (node.type === 'heading') {
      const level = Number(node.attrs?.level);
      sanitized.attrs = {
        level: [1, 2, 3].includes(level) ? level : 2,
        textAlign: TEXT_ALIGNMENTS.has(node.attrs?.textAlign) ? node.attrs?.textAlign : 'left',
      };
    } else {
      sanitized.attrs = {
        textAlign: TEXT_ALIGNMENTS.has(node.attrs?.textAlign) ? node.attrs?.textAlign : 'left',
      };
    }

    const content = (node.content || []).map(sanitizeInlineNode).filter(Boolean) as JSONContent[];
    if (content.length) sanitized.content = content;
    return sanitized;
  };

  if (value.type !== 'doc') return { type: 'doc', content: [{ type: 'paragraph' }] };
  const content = (value.content || []).map(sanitizeBlockNode).filter(Boolean) as JSONContent[];
  return { type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] };
}

export function richTextDocumentsEqual(left: JSONContent, right: JSONContent): boolean {
  const compare = (leftValue: unknown, rightValue: unknown): boolean => {
    if (leftValue === rightValue) return true;
    if (leftValue === null || rightValue === null) return false;
    if (typeof leftValue !== 'object' || typeof rightValue !== 'object') return false;
    if (Array.isArray(leftValue) || Array.isArray(rightValue)) {
      if (!Array.isArray(leftValue) || !Array.isArray(rightValue)) return false;
      return (
        leftValue.length === rightValue.length &&
        leftValue.every((entry, index) => compare(entry, rightValue[index]))
      );
    }

    const leftRecord = leftValue as Record<string, unknown>;
    const rightRecord = rightValue as Record<string, unknown>;
    const leftKeys = Object.keys(leftRecord);
    const rightKeys = Object.keys(rightRecord);
    return (
      leftKeys.length === rightKeys.length &&
      leftKeys.every(
        (key) => Object.hasOwn(rightRecord, key) && compare(leftRecord[key], rightRecord[key])
      )
    );
  };

  return compare(left, right);
}
