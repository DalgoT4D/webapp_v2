'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TextStyleKit } from '@tiptap/extension-text-style';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import { Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { calculateTextDimensions } from '@/lib/chart-size-constraints';
import {
  legacyConfigToRichText,
  richTextDocumentsEqual,
  sanitizeRichTextDocument,
  type UnifiedTextConfig,
} from './rich-text-config';
export type { UnifiedTextConfig } from './rich-text-config';

interface UnifiedTextElementProps {
  config: UnifiedTextConfig;
  onUpdate: (config: UnifiedTextConfig) => void;
  componentId?: string;
  onRemove?: () => void;
  isEditMode?: boolean;
}

export const DASHBOARD_WIDGET_DRAG_START_EVENT = 'dashboard:widget-drag-start';
export const DASHBOARD_RICH_TEXT_FLUSH_EVENT = 'dashboard:rich-text-flush';

export interface RichTextFlushEventDetail {
  updates: Array<{ componentId: string; config: UnifiedTextConfig }>;
}

const FONT_SIZES = Array.from({ length: 23 }, (_, index) => 10 + index);
const COLOR_PRESETS = [
  '#000000',
  '#374151',
  '#6B7280',
  '#EF4444',
  '#F59E0B',
  '#10B981',
  '#3B82F6',
  '#8B5CF6',
];

type SelectionMarkState = 'active' | 'mixed' | 'inactive';

function getSelectionMarkState(
  editor: NonNullable<ReturnType<typeof useEditor>>,
  markName: string
): SelectionMarkState {
  const { from, to, empty } = editor.state.selection;
  if (empty) return editor.isActive(markName) ? 'active' : 'inactive';

  let selectedCharacters = 0;
  let markedCharacters = 0;
  editor.state.doc.nodesBetween(from, to, (node, position) => {
    if (!node.isText) return;
    const overlap = Math.max(0, Math.min(to, position + node.nodeSize) - Math.max(from, position));
    selectedCharacters += overlap;
    if (node.marks.some((mark) => mark.type.name === markName)) markedCharacters += overlap;
  });

  if (markedCharacters === 0) return 'inactive';
  if (markedCharacters === selectedCharacters) return 'active';
  return 'mixed';
}

function setHeadingLevel(
  editor: NonNullable<ReturnType<typeof useEditor>>,
  level: 1 | 2 | 3
): void {
  const { from, to } = editor.state.selection;
  const $from = editor.state.doc.resolve(from);
  const $to = editor.state.doc.resolve(to);

  // Legacy text boxes carry their old whole-box font size as an inline mark.
  // Clear that mark across every selected text block so the heading hierarchy
  // is visible, while preserving marks such as color, bold, and underline.
  const blockFrom = $from.start($from.depth);
  const blockTo = $to.end($to.depth);

  editor
    .chain()
    .focus()
    .setTextSelection({ from: blockFrom, to: blockTo })
    .unsetFontSize()
    .setHeading({ level })
    .setTextSelection({ from, to })
    .run();
}

const editorExtensions = [
  StarterKit.configure({
    blockquote: false,
    bulletList: false,
    code: false,
    codeBlock: false,
    horizontalRule: false,
    link: false,
    listItem: false,
    listKeymap: false,
    orderedList: false,
    strike: false,
    trailingNode: false,
    heading: { levels: [1, 2, 3] },
  }),
  TextStyleKit.configure({
    backgroundColor: false,
    fontFamily: false,
    lineHeight: false,
    color: { types: ['textStyle'] },
    fontSize: { types: ['textStyle'] },
  }),
  TextAlign.configure({
    types: ['heading', 'paragraph'],
    alignments: ['left', 'center', 'right'],
    defaultAlignment: 'left',
  }),
  Placeholder.configure({ placeholder: 'Start typing…' }),
];

export function UnifiedTextElement({
  config,
  onUpdate,
  componentId,
  isEditMode = true,
}: UnifiedTextElementProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [toolbarPosition, setToolbarPosition] = useState({ top: 8, left: 8, width: 560 });
  const containerRef = useRef<HTMLDivElement>(null);
  const configRef = useRef(config);
  const editingSessionRef = useRef(false);
  configRef.current = config;

  const initialDocument = useMemo(
    () => sanitizeRichTextDocument(config.richText || legacyConfigToRichText(config)),
    // The component key is stable; external updates are synchronized by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const editor = useEditor({
    extensions: editorExtensions,
    content: initialDocument,
    editable: isEditMode && isEditing,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          'min-h-[2rem] w-full whitespace-pre-wrap break-words outline-none [&_p]:my-0 [&_h1]:my-0 [&_h1]:text-[32px] [&_h1]:font-bold [&_h1]:leading-tight [&_h2]:my-0 [&_h2]:text-[26px] [&_h2]:font-bold [&_h2]:leading-tight [&_h3]:my-0 [&_h3]:text-[22px] [&_h3]:font-semibold [&_h3]:leading-snug',
        'data-testid': 'dashboard-rich-text-editor',
      },
    },
  });

  const toolbarState = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => ({
      bold: currentEditor ? getSelectionMarkState(currentEditor, 'bold') : 'inactive',
      italic: currentEditor ? getSelectionMarkState(currentEditor, 'italic') : 'inactive',
      underline: currentEditor ? getSelectionMarkState(currentEditor, 'underline') : 'inactive',
      headingLevel: ([1, 2, 3] as const).find((level) =>
        currentEditor?.isActive('heading', { level })
      ),
      paragraph: currentEditor?.isActive('paragraph') || false,
      alignment:
        (['left', 'center', 'right'] as const).find((alignment) =>
          currentEditor?.isActive({ textAlign: alignment })
        ) || 'left',
      color: currentEditor?.getAttributes('textStyle').color || '#000000',
      fontSize: currentEditor?.getAttributes('textStyle').fontSize || '',
    }),
  });

  const calculateToolbarPosition = useCallback(() => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(620, Math.max(320, rect.width));
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    const top = rect.top > 64 ? rect.top - 56 : Math.min(window.innerHeight - 56, rect.bottom + 8);
    setToolbarPosition({ top, left, width });
  }, []);

  const commit = useCallback(
    (notify = true): UnifiedTextConfig | null => {
      if (!editor) return null;
      const richText = sanitizeRichTextDocument(editor.getJSON());
      if (!richTextDocumentsEqual(richText, editor.getJSON())) {
        editor.commands.setContent(richText, { emitUpdate: false });
      }
      const content = editor.getText({ blockSeparator: '\n' });
      const current = configRef.current;
      const dimensions = calculateTextDimensions({
        content,
        fontSize: current.fontSize || 16,
        fontWeight: current.fontWeight || 'normal',
        type: current.type || 'paragraph',
        textAlign: current.textAlign || 'left',
      });
      const nextConfig: UnifiedTextConfig = {
        ...current,
        content,
        richText,
        contentConstraints: { minWidth: dimensions.width, minHeight: dimensions.height },
      };
      if (notify) onUpdate(nextConfig);
      return nextConfig;
    },
    [editor, onUpdate]
  );

  const stopEditing = useCallback(
    (shouldCommit: boolean) => {
      if (!editingSessionRef.current) return;
      editingSessionRef.current = false;
      if (shouldCommit) commit();
      else if (editor) {
        editor.commands.setContent(
          sanitizeRichTextDocument(
            configRef.current.richText || legacyConfigToRichText(configRef.current)
          ),
          { emitUpdate: false }
        );
      }
      editor?.setEditable(false);
      setIsEditing(false);
      setShowColorPicker(false);
    },
    [commit, editor]
  );

  const startEditing = useCallback(() => {
    if (!isEditMode || !editor || editingSessionRef.current) return;
    editingSessionRef.current = true;
    editor.setEditable(true);
    setIsEditing(true);
    editor.commands.focus('end');
    requestAnimationFrame(calculateToolbarPosition);
  }, [calculateToolbarPosition, editor, isEditMode, isEditing]);

  useEffect(() => {
    if (!editor || isEditing) return;
    const incoming = sanitizeRichTextDocument(config.richText || legacyConfigToRichText(config));
    if (!richTextDocumentsEqual(editor.getJSON(), incoming)) {
      editor.commands.setContent(incoming, { emitUpdate: false });
    }
  }, [config, editor, isEditing]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(isEditMode && isEditing);
  }, [editor, isEditMode, isEditing]);

  useEffect(() => {
    if (!isEditing) return undefined;
    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        (target && containerRef.current?.contains(target)) ||
        target?.closest('[data-rich-text-toolbar]')
      ) {
        return;
      }
      stopEditing(true);
    };
    document.addEventListener('focusin', handleFocusIn);
    return () => {
      document.removeEventListener('focusin', handleFocusIn);
    };
  }, [isEditing, stopEditing]);

  useEffect(() => {
    if (!isEditing) return undefined;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (containerRef.current?.contains(target) || target.closest('[data-rich-text-toolbar]'))
        return;
      stopEditing(true);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        stopEditing(false);
      } else if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault();
        stopEditing(true);
      }
    };
    const reposition = () => calculateToolbarPosition();
    document.addEventListener('mousedown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [calculateToolbarPosition, isEditing, stopEditing]);

  useEffect(() => {
    if (!componentId || !isEditing) return undefined;
    const handleWidgetDragStart = (event: Event) => {
      const draggedComponentId = (event as CustomEvent<{ componentId?: string }>).detail
        ?.componentId;
      if (draggedComponentId === componentId) stopEditing(true);
    };
    document.addEventListener(DASHBOARD_WIDGET_DRAG_START_EVENT, handleWidgetDragStart);
    return () =>
      document.removeEventListener(DASHBOARD_WIDGET_DRAG_START_EVENT, handleWidgetDragStart);
  }, [componentId, isEditing, stopEditing]);

  useEffect(() => {
    if (!componentId || !isEditing) return undefined;
    const handleFlush = (event: Event) => {
      const nextConfig = commit(false);
      if (nextConfig) {
        (event as CustomEvent<RichTextFlushEventDetail>).detail.updates.push({
          componentId,
          config: nextConfig,
        });
      }
      editingSessionRef.current = false;
      editor?.setEditable(false);
      setIsEditing(false);
      setShowColorPicker(false);
    };
    document.addEventListener(DASHBOARD_RICH_TEXT_FLUSH_EVENT, handleFlush);
    return () => document.removeEventListener(DASHBOARD_RICH_TEXT_FLUSH_EVENT, handleFlush);
  }, [commit, componentId, editor, isEditing]);

  if (!editor) return null;
  if (!isEditMode && !config.content && !config.richText) return null;

  const toolbar = isEditing
    ? createPortal(
        <div
          className="drag-cancel fixed z-[9999] flex max-w-[calc(100vw-16px)] flex-wrap items-center gap-1 rounded-lg border bg-white p-2 shadow-2xl"
          style={toolbarPosition}
          data-rich-text-toolbar
        >
          {([1, 2, 3] as const).map((level) => (
            <Button
              key={level}
              type="button"
              size="sm"
              variant={toolbarState?.headingLevel === level ? 'default' : 'ghost'}
              className="h-7 px-2 text-xs"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setHeadingLevel(editor, level)}
              aria-label={`Heading ${level}`}
              data-testid={`rich-text-heading-${level}`}
            >
              H{level}
            </Button>
          ))}
          <Button
            type="button"
            size="sm"
            variant={toolbarState?.paragraph ? 'default' : 'ghost'}
            className="h-7 px-2 text-xs"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => editor.chain().focus().setParagraph().run()}
            aria-label="Normal text"
            data-testid="rich-text-paragraph"
          >
            T
          </Button>
          <span className="mx-1 h-5 w-px bg-gray-200" />
          <select
            value={toolbarState?.fontSize ? Number.parseInt(toolbarState.fontSize, 10) : ''}
            onMouseDown={(event) => event.stopPropagation()}
            onChange={(event) =>
              editor.chain().focus().setFontSize(`${event.target.value}px`).run()
            }
            className="h-7 rounded border bg-white px-1 text-xs"
            aria-label="Font size"
            data-testid="rich-text-font-size"
          >
            <option value="" disabled>
              Size
            </option>
            {FONT_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}px
              </option>
            ))}
          </select>
          {[
            {
              label: 'Bold',
              active: toolbarState?.bold,
              icon: Bold,
              command: () => editor.chain().focus().toggleBold().run(),
            },
            {
              label: 'Italic',
              active: toolbarState?.italic,
              icon: Italic,
              command: () => editor.chain().focus().toggleItalic().run(),
            },
            {
              label: 'Underline',
              active: toolbarState?.underline,
              icon: Underline,
              command: () => editor.chain().focus().toggleUnderline().run(),
            },
          ].map(({ label, active, icon: Icon, command }) => (
            <Button
              key={label}
              type="button"
              size="sm"
              variant={active === 'active' ? 'default' : active === 'mixed' ? 'outline' : 'ghost'}
              className={cn('h-7 w-7 p-0', active === 'mixed' && 'border-dashed')}
              onMouseDown={(event) => event.preventDefault()}
              onClick={command}
              aria-label={label}
              aria-pressed={active === 'mixed' ? 'mixed' : active === 'active'}
              data-testid={`rich-text-${label.toLowerCase()}`}
            >
              <Icon className="h-3.5 w-3.5" />
            </Button>
          ))}
          <span className="mx-1 h-5 w-px bg-gray-200" />
          {[
            { value: 'left', label: 'Align left', icon: AlignLeft },
            { value: 'center', label: 'Align center', icon: AlignCenter },
            { value: 'right', label: 'Align right', icon: AlignRight },
          ].map(({ value, label, icon: Icon }) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={toolbarState?.alignment === value ? 'default' : 'ghost'}
              className="h-7 w-7 p-0"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => editor.chain().focus().setTextAlign(value).run()}
              aria-label={label}
              data-testid={`rich-text-align-${value}`}
            >
              <Icon className="h-3.5 w-3.5" />
            </Button>
          ))}
          <div className="relative">
            <Button
              type="button"
              size="sm"
              variant={showColorPicker ? 'default' : 'ghost'}
              className="h-7 w-7 p-0"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setShowColorPicker((visible) => !visible)}
              aria-label="Text color"
              data-testid="rich-text-color-picker"
            >
              <Palette className="h-3.5 w-3.5" />
              <span
                className="absolute bottom-0.5 right-0.5 h-2 w-2 rounded-full border border-white"
                style={{ backgroundColor: toolbarState?.color || '#000000' }}
              />
            </Button>
            {showColorPicker && (
              <div className="absolute right-0 top-9 z-[10000] w-40 rounded-lg border bg-white p-3 shadow-xl">
                <p className="mb-2 text-xs font-medium text-gray-700">Text color</p>
                <div className="grid grid-cols-4 gap-2">
                  {COLOR_PRESETS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={cn(
                        'h-7 w-7 rounded-md border border-gray-200 transition-transform hover:scale-110',
                        toolbarState?.color === color && 'ring-2 ring-blue-500 ring-offset-1'
                      )}
                      style={{ backgroundColor: color }}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        editor.chain().focus().setColor(color).run();
                        setShowColorPicker(false);
                      }}
                      aria-label={`Set text color ${color}`}
                      data-testid={`rich-text-color-${color.slice(1).toLowerCase()}`}
                    />
                  ))}
                </div>
                <label className="mt-3 flex cursor-pointer items-center justify-between border-t pt-3 text-xs text-gray-600">
                  Custom color
                  <input
                    type="color"
                    value={toolbarState?.color || '#000000'}
                    onChange={(event) => {
                      editor.chain().focus().setColor(event.target.value).run();
                      setShowColorPicker(false);
                    }}
                    className="h-7 w-10 cursor-pointer overflow-hidden rounded border bg-white p-0"
                    aria-label="Custom text color"
                    data-testid="rich-text-custom-color"
                  />
                </label>
              </div>
            )}
          </div>
        </div>,
        document.body
      )
    : null;

  const content = (
    <div
      ref={containerRef}
      className={cn(
        'drag-cancel flex h-full w-full items-center p-4',
        isEditMode && 'cursor-text',
        isEditing && 'rounded bg-white'
      )}
      style={{ backgroundColor: config.backgroundColor || 'transparent' }}
      onClick={startEditing}
    >
      <EditorContent editor={editor} className="w-full" />
    </div>
  );

  if (!isEditMode) return content;
  return (
    <>
      {toolbar}
      <Card className="h-full w-full">
        <CardContent className="h-full p-0">{content}</CardContent>
      </Card>
    </>
  );
}
