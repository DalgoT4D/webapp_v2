import {
  legacyConfigToRichText,
  richTextDocumentsEqual,
  sanitizeRichTextDocument,
} from '../rich-text-config';

const legacyConfig = {
  content: 'Hello\nworld',
  type: 'paragraph' as const,
  fontSize: 18,
  fontWeight: 'bold' as const,
  fontStyle: 'italic' as const,
  textDecoration: 'underline' as const,
  textAlign: 'center' as const,
  color: '#3B82F6',
};

describe('dashboard rich-text compatibility', () => {
  it('converts legacy whole-box formatting into equivalent structured content', () => {
    const document = legacyConfigToRichText(legacyConfig);
    expect(document.type).toBe('doc');
    expect(document.content).toHaveLength(2);
    expect(document.content?.[0]).toMatchObject({
      type: 'paragraph',
      attrs: { textAlign: 'center' },
      content: [
        {
          type: 'text',
          text: 'Hello',
          marks: expect.arrayContaining([
            { type: 'bold' },
            { type: 'italic' },
            { type: 'underline' },
            { type: 'textStyle', attrs: { color: '#3B82F6', fontSize: '18px' } },
          ]),
        },
      ],
    });
  });

  it('converts a legacy heading without an explicit level to H2', () => {
    const document = legacyConfigToRichText({
      ...legacyConfig,
      content: 'Legacy heading',
      type: 'heading',
      headingLevel: undefined,
    });

    expect(document.content?.[0]).toMatchObject({
      type: 'heading',
      attrs: { level: 2, textAlign: 'center' },
      content: [expect.objectContaining({ text: 'Legacy heading' })],
    });
  });

  it('keeps supported formatting and strips unsafe or unsupported content', () => {
    const document = sanitizeRichTextDocument({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          attrs: { textAlign: 'center', onclick: 'alert(1)' },
          content: [
            {
              type: 'text',
              text: 'Safe',
              marks: [
                { type: 'bold', attrs: { onclick: 'alert(1)' } },
                { type: 'link', attrs: { href: 'javascript:alert(1)' } },
                { type: 'textStyle', attrs: { color: '#ff0000', fontSize: '72px' } },
                { type: 'textStyle', attrs: { fontSize: '12px<script>' } },
              ],
            },
          ],
        },
        { type: 'image', attrs: { src: 'javascript:alert(1)' } },
      ],
    });

    expect(document).toEqual({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          attrs: { textAlign: 'center' },
          content: [
            {
              type: 'text',
              text: 'Safe',
              marks: [
                { type: 'bold' },
                { type: 'textStyle', attrs: { color: '#ff0000', fontSize: '32px' } },
              ],
            },
          ],
        },
      ],
    });
  });

  it('enforces the editor node hierarchy and produces a schema-valid fallback', () => {
    expect(
      sanitizeRichTextDocument({
        type: 'doc',
        content: [
          { type: 'text', text: 'Invalid root text' },
          {
            type: 'paragraph',
            content: [
              { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Nested' }] },
              { type: 'text', text: '' },
              { type: 'hardBreak', attrs: { onclick: 'alert(1)' } },
              { type: 'text', text: 'Safe' },
            ],
          },
          { type: 'heading', attrs: { level: 1.5 }, content: [{ type: 'text', text: 'Heading' }] },
        ],
      })
    ).toEqual({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          attrs: { textAlign: 'left' },
          content: [{ type: 'hardBreak' }, { type: 'text', text: 'Safe' }],
        },
        {
          type: 'heading',
          attrs: { level: 2, textAlign: 'left' },
          content: [{ type: 'text', text: 'Heading' }],
        },
      ],
    });

    expect(sanitizeRichTextDocument({ type: 'paragraph' })).toEqual({
      type: 'doc',
      content: [{ type: 'paragraph' }],
    });
  });

  it('returns safe content when persisted array fields are malformed', () => {
    expect(sanitizeRichTextDocument({ type: 'doc', content: {} })).toEqual({
      type: 'doc',
      content: [{ type: 'paragraph' }],
    });

    expect(
      sanitizeRichTextDocument({
        type: 'doc',
        content: [
          null,
          'invalid',
          { type: 'paragraph', content: {} },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Safe', marks: { type: 'bold' } }],
          },
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Also safe',
                marks: [null, 'invalid', { type: 'bold' }],
              },
            ],
          },
        ],
      })
    ).toEqual({
      type: 'doc',
      content: [
        { type: 'paragraph', attrs: { textAlign: 'left' } },
        {
          type: 'paragraph',
          attrs: { textAlign: 'left' },
          content: [{ type: 'text', text: 'Safe' }],
        },
        {
          type: 'paragraph',
          attrs: { textAlign: 'left' },
          content: [{ type: 'text', text: 'Also safe', marks: [{ type: 'bold' }] }],
        },
      ],
    });
  });

  it('compares equivalent documents structurally instead of by object key order', () => {
    expect(
      richTextDocumentsEqual(
        { type: 'doc', content: [{ type: 'paragraph', attrs: { textAlign: 'left' } }] },
        { content: [{ attrs: { textAlign: 'left' }, type: 'paragraph' }], type: 'doc' }
      )
    ).toBe(true);
  });

  it('normalizes browser-style pasted colors without accepting transparency', () => {
    const document = sanitizeRichTextDocument({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Colors',
              marks: [
                { type: 'textStyle', attrs: { color: 'rgb(255, 0, 128)' } },
                { type: 'textStyle', attrs: { color: '#0f8' } },
                { type: 'textStyle', attrs: { color: 'rgba(0, 0, 0, 0.5)' } },
              ],
            },
          ],
        },
      ],
    });

    expect(document.content?.[0].content?.[0].marks).toEqual([
      { type: 'textStyle', attrs: { color: '#00ff88' } },
    ]);
  });
});
