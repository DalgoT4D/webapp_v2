'use client';

import { useCallback, type Dispatch, type RefObject, type SetStateAction } from 'react';
import { createPortal } from 'react-dom';
import { useEditorState, type useEditor } from '@tiptap/react';
import {
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Palette,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';
import {
  MAX_RICH_TEXT_FONT_SIZE,
  MIN_RICH_TEXT_FONT_SIZE,
  type UnifiedTextConfig,
} from './rich-text-config';
import { ImageControls } from './dashboard-image-control';

const FONT_SIZES = Array.from(
  { length: MAX_RICH_TEXT_FONT_SIZE - MIN_RICH_TEXT_FONT_SIZE + 1 },
  (_, index) => MIN_RICH_TEXT_FONT_SIZE + index
);
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
const ALIGNMENT_OPTIONS = [
  { value: 'left', label: 'Align left', icon: AlignLeft },
  { value: 'center', label: 'Align center', icon: AlignCenter },
  { value: 'right', label: 'Align right', icon: AlignRight },
] as const;

type SelectionMarkState = 'active' | 'mixed' | 'inactive';
type RichTextFormatType =
  | 'heading'
  | 'paragraph'
  | 'font_size'
  | 'bold'
  | 'italic'
  | 'underline'
  | 'alignment'
  | 'color';

interface TextStyleAttributes {
  color?: string;
  fontSize?: string;
}

function getFontSizeSelectValue(fontSize?: string): number | '' {
  if (!fontSize?.endsWith('px')) return '';
  const parsed = Number(fontSize.slice(0, -2));
  return FONT_SIZES.includes(parsed) && `${parsed}px` === fontSize ? parsed : '';
}

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
): boolean {
  const { from, to } = editor.state.selection;
  const $from = editor.state.doc.resolve(from);
  const $to = editor.state.doc.resolve(to);

  // Legacy text boxes carry their old whole-box font size as an inline mark.
  // Clear that mark across every selected text block so the heading hierarchy
  // is visible, while preserving marks such as color, bold, and underline.
  const blockFrom = $from.start($from.depth);
  const blockTo = $to.end($to.depth);

  return editor
    .chain()
    .focus()
    .setTextSelection({ from: blockFrom, to: blockTo })
    .unsetFontSize()
    .setHeading({ level })
    .setTextSelection({ from, to })
    .run();
}

export interface RichTextToolbarProps {
  editor: NonNullable<ReturnType<typeof useEditor>>;
  toolbarPosition: { top: number; left: number };
  showColorPicker: boolean;
  setShowColorPicker: Dispatch<SetStateAction<boolean>>;
  showHeadingDropdown: boolean;
  setShowHeadingDropdown: Dispatch<SetStateAction<boolean>>;
  showAlignDropdown: boolean;
  setShowAlignDropdown: Dispatch<SetStateAction<boolean>>;
  showImageDropdown: boolean;
  setShowImageDropdown: Dispatch<SetStateAction<boolean>>;
  isReplacingImage: boolean;
  setIsReplacingImage: Dispatch<SetStateAction<boolean>>;
  config: UnifiedTextConfig;
  imageTab: 'upload' | 'link';
  setImageTab: (tab: 'upload' | 'link') => void;
  imageLinkInput: string;
  setImageLinkInput: (value: string) => void;
  imageInputRef: RefObject<HTMLInputElement>;
  isUploadingImage: boolean;
  onImageLinkConfirm: () => void;
  onImageReload: () => void;
  onImageRemove: () => void;
  onImageSizeChange: (size: 'fill' | 'fit' | 'stretch') => void;
  onCaptionAlignChange: (align: 'left' | 'center' | 'right') => void;
  onCancelReplaceImage: () => void;
}

// The floating rich-text formatting toolbar (heading, font size, bold/italic/
// underline, alignment, color, image controls) shown above/below the widget
// while it's being edited. Portaled to document.body so it isn't clipped by
// the dashboard grid's overflow handling.
export function RichTextToolbar({
  editor,
  toolbarPosition,
  showColorPicker,
  setShowColorPicker,
  showHeadingDropdown,
  setShowHeadingDropdown,
  showAlignDropdown,
  setShowAlignDropdown,
  showImageDropdown,
  setShowImageDropdown,
  isReplacingImage,
  setIsReplacingImage,
  config,
  imageTab,
  setImageTab,
  imageLinkInput,
  setImageLinkInput,
  imageInputRef,
  isUploadingImage,
  onImageLinkConfirm,
  onImageReload,
  onImageRemove,
  onImageSizeChange,
  onCaptionAlignChange,
  onCancelReplaceImage,
}: RichTextToolbarProps) {
  const toolbarState = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => {
      const textStyle = currentEditor?.getAttributes('textStyle') as
        | TextStyleAttributes
        | undefined;
      return {
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
        color: textStyle?.color || '#000000',
        fontSize: textStyle?.fontSize || '',
      };
    },
  });

  const applyFormatting = useCallback((formatType: RichTextFormatType, command: () => boolean) => {
    if (command()) {
      trackEvent(ANALYTICS_EVENTS.DASHBOARD_RICH_TEXT_FORMAT_APPLIED, {
        format_type: formatType,
      });
    }
  }, []);

  return createPortal(
    <div
      className="drag-cancel fixed z-[9999] flex max-w-[calc(100vw-16px)] flex-wrap items-center gap-1 rounded-lg border bg-white p-2 shadow-2xl"
      style={toolbarPosition}
      data-rich-text-toolbar
    >
      <div className="relative">
        <Button
          type="button"
          size="sm"
          variant={showHeadingDropdown || toolbarState?.headingLevel ? 'default' : 'ghost'}
          className="h-7 gap-0.5 px-2 text-xs"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            setShowHeadingDropdown((visible) => !visible);
            setShowColorPicker(false);
            setShowImageDropdown(false);
            setShowAlignDropdown(false);
          }}
          aria-label="Text style"
          data-testid="rich-text-style"
        >
          {toolbarState?.headingLevel ? `H${toolbarState.headingLevel}` : 'T'}
          <ChevronDown className="h-2.5 w-2.5" />
        </Button>
        {showHeadingDropdown && (
          <div className="absolute left-0 top-9 z-[10000] w-32 rounded-lg border bg-white p-1 shadow-xl">
            <button
              type="button"
              onClick={() => {
                applyFormatting('paragraph', () => editor.chain().focus().setParagraph().run());
                setShowHeadingDropdown(false);
              }}
              className={cn(
                'w-full rounded px-2 py-1.5 text-left text-xs',
                toolbarState?.paragraph
                  ? 'bg-primary/10 text-primary'
                  : 'text-gray-700 hover:bg-gray-50'
              )}
              data-testid="rich-text-paragraph"
            >
              Normal text
            </button>
            {([1, 2, 3] as const).map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => {
                  applyFormatting('heading', () => setHeadingLevel(editor, level));
                  setShowHeadingDropdown(false);
                }}
                className={cn(
                  'w-full rounded px-2 py-1.5 text-left text-xs',
                  toolbarState?.headingLevel === level
                    ? 'bg-primary/10 text-primary'
                    : 'text-gray-700 hover:bg-gray-50'
                )}
                data-testid={`rich-text-heading-${level}`}
              >
                Heading {level}
              </button>
            ))}
          </div>
        )}
      </div>
      <span className="mx-1 h-5 w-px bg-gray-200" />
      <select
        value={getFontSizeSelectValue(toolbarState?.fontSize)}
        onMouseDown={(event) => event.stopPropagation()}
        onChange={(event) =>
          applyFormatting('font_size', () =>
            editor.chain().focus().setFontSize(`${event.target.value}px`).run()
          )
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
          command: () => applyFormatting('bold', () => editor.chain().focus().toggleBold().run()),
        },
        {
          label: 'Italic',
          active: toolbarState?.italic,
          icon: Italic,
          command: () =>
            applyFormatting('italic', () => editor.chain().focus().toggleItalic().run()),
        },
        {
          label: 'Underline',
          active: toolbarState?.underline,
          icon: Underline,
          command: () =>
            applyFormatting('underline', () => editor.chain().focus().toggleUnderline().run()),
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
      <div className="relative">
        <Button
          type="button"
          size="sm"
          variant={showAlignDropdown || toolbarState?.alignment !== 'left' ? 'default' : 'ghost'}
          className="h-7 gap-0.5 px-1.5"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            setShowAlignDropdown((visible) => !visible);
            setShowColorPicker(false);
            setShowImageDropdown(false);
            setShowHeadingDropdown(false);
          }}
          aria-label="Text alignment"
          data-testid="rich-text-align"
        >
          {(() => {
            const CurrentAlignIcon =
              ALIGNMENT_OPTIONS.find((option) => option.value === toolbarState?.alignment)?.icon ||
              AlignLeft;
            return <CurrentAlignIcon className="h-3.5 w-3.5" />;
          })()}
          <ChevronDown className="h-2.5 w-2.5" />
        </Button>
        {showAlignDropdown && (
          <div className="absolute left-0 top-9 z-[10000] flex items-center gap-0.5 rounded-lg border bg-white p-1 shadow-xl">
            {ALIGNMENT_OPTIONS.map(({ value, label, icon: Icon }) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={toolbarState?.alignment === value ? 'default' : 'ghost'}
                className="h-7 w-7 p-0"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  applyFormatting('alignment', () =>
                    editor.chain().focus().setTextAlign(value).run()
                  );
                  setShowAlignDropdown(false);
                }}
                aria-label={label}
                data-testid={`rich-text-align-${value}`}
              >
                <Icon className="h-3.5 w-3.5" />
              </Button>
            ))}
          </div>
        )}
      </div>
      <div className="relative">
        <Button
          type="button"
          size="sm"
          variant={showColorPicker ? 'default' : 'ghost'}
          className="h-7 w-7 p-0"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            setShowColorPicker((visible) => !visible);
            setShowImageDropdown(false);
            setShowHeadingDropdown(false);
            setShowAlignDropdown(false);
          }}
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
                    applyFormatting('color', () => editor.chain().focus().setColor(color).run());
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
                  applyFormatting('color', () =>
                    editor.chain().focus().setColor(event.target.value).run()
                  );
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
      <ImageControls
        config={config}
        dropUp={toolbarPosition.top > 200}
        showImageDropdown={showImageDropdown}
        onToggleImageDropdown={() => {
          setShowImageDropdown((visible) => {
            const next = !visible;
            if (!next) setIsReplacingImage(false);
            return next;
          });
          setShowColorPicker(false);
          setShowHeadingDropdown(false);
          setShowAlignDropdown(false);
        }}
        isReplacingImage={isReplacingImage}
        onCancelReplaceImage={onCancelReplaceImage}
        imageTab={imageTab}
        setImageTab={setImageTab}
        imageLinkInput={imageLinkInput}
        setImageLinkInput={setImageLinkInput}
        imageInputRef={imageInputRef}
        isUploadingImage={isUploadingImage}
        onImageLinkConfirm={onImageLinkConfirm}
        onImageReload={onImageReload}
        onImageRemove={onImageRemove}
        onImageSizeChange={onImageSizeChange}
        onCaptionAlignChange={onCaptionAlignChange}
      />
    </div>,
    document.body
  );
}
