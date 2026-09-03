'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TextStyleKit } from '@tiptap/extension-text-style';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { calculateTextDimensions } from '@/lib/chart-size-constraints';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';
import { apiPut, apiDelete } from '@/lib/api';
import { toastError } from '@/lib/toast';
import {
  DEFAULT_RICH_TEXT_FONT_SIZE,
  legacyConfigToRichText,
  richTextDocumentsEqual,
  sanitizeRichTextDocument,
  type UnifiedTextConfig,
  type WidgetImageUploadResponse,
} from './rich-text-config';
import { RichTextToolbar } from './rich-text-toolbar';
export type { UnifiedTextConfig } from './rich-text-config';

interface UnifiedTextElementProps {
  config: UnifiedTextConfig;
  onUpdate: (config: UnifiedTextConfig) => void;
  componentId?: string;
  isEditMode?: boolean;
  /** Analytics only, so the rich-text events can be joined to their dashboard. Absent in
   *  report/print contexts, where isEditMode is false and those events never fire. */
  dashboardId?: number;
}

export const DASHBOARD_WIDGET_DRAG_START_EVENT = 'dashboard:widget-drag-start';
export const DASHBOARD_RICH_TEXT_FLUSH_EVENT = 'dashboard:rich-text-flush';

export interface RichTextFlushEventDetail {
  updates: Array<{ componentId: string; config: UnifiedTextConfig }>;
}

// Keep the floating toolbar usable on narrow screens and clear of viewport edges.
const TOOLBAR_MAX_WIDTH_PX = 620;
const TOOLBAR_HEIGHT_PX = 56;
const TOOLBAR_VIEWPORT_GUTTER_PX = 8;
// Mirrors the backend's PUT /api/dashboards/images/ validation
// (ddpui/services/dashboard_service.py) so bad files fail fast client-side.
const ALLOWED_WIDGET_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const MAX_WIDGET_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

const IMAGE_OVERLAY_PLACEHOLDER = 'Type on image (optional)…';
const TEXT_PLACEHOLDER = 'Start typing…';

export function UnifiedTextElement({
  config,
  onUpdate,
  componentId,
  isEditMode = true,
  dashboardId,
}: UnifiedTextElementProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showHeadingDropdown, setShowHeadingDropdown] = useState(false);
  const [showAlignDropdown, setShowAlignDropdown] = useState(false);
  const [toolbarPosition, setToolbarPosition] = useState({
    top: TOOLBAR_VIEWPORT_GUTTER_PX,
    left: TOOLBAR_VIEWPORT_GUTTER_PX,
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const configRef = useRef(config);
  const editingSessionRef = useRef(false);

  // Image controls — metadata alongside the rich-text document, edited
  // independently of the TipTap editor.
  const [showImageDropdown, setShowImageDropdown] = useState(false);
  const [isReplacingImage, setIsReplacingImage] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageTab, setImageTab] = useState<'upload' | 'link'>('upload');
  const [imageLinkInput, setImageLinkInput] = useState('');
  const [isEditingCaption, setIsEditingCaption] = useState(false);
  const [tempCaption, setTempCaption] = useState(config.caption || '');
  const imageInputRef = useRef<HTMLInputElement>(null);
  const hasImageRef = useRef(Boolean(config.imageUrl));

  const closeAllDropdowns = useCallback(() => {
    setShowColorPicker(false);
    setShowImageDropdown(false);
    setShowHeadingDropdown(false);
    setShowAlignDropdown(false);
  }, []);

  useEffect(() => {
    configRef.current = config;
    hasImageRef.current = Boolean(config.imageUrl);
  }, [config]);

  const initialDocument = useMemo(
    () => sanitizeRichTextDocument(config.richText || legacyConfigToRichText(config)),
    // The component key is stable; external updates are synchronized by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const editorExtensions = useMemo(
    () => [
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
      Placeholder.configure({
        placeholder: () => (hasImageRef.current ? IMAGE_OVERLAY_PLACEHOLDER : TEXT_PLACEHOLDER),
      }),
    ],
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

  const calculateToolbarPosition = useCallback(() => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    // The toolbar sizes itself to its own content (no explicit width is set
    // in its style below) — TOOLBAR_MAX_WIDTH_PX here is only a conservative
    // estimate so it doesn't get clamped past the right viewport edge.
    const left = Math.max(
      TOOLBAR_VIEWPORT_GUTTER_PX,
      Math.min(rect.left, window.innerWidth - TOOLBAR_MAX_WIDTH_PX - TOOLBAR_VIEWPORT_GUTTER_PX)
    );
    const toolbarClearance = TOOLBAR_HEIGHT_PX + TOOLBAR_VIEWPORT_GUTTER_PX;
    const top =
      rect.top > toolbarClearance
        ? rect.top - TOOLBAR_HEIGHT_PX
        : Math.min(
            window.innerHeight - TOOLBAR_HEIGHT_PX,
            rect.bottom + TOOLBAR_VIEWPORT_GUTTER_PX
          );
    setToolbarPosition({ top, left });
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
        fontSize: current.fontSize || DEFAULT_RICH_TEXT_FONT_SIZE,
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
      closeAllDropdowns();
      setIsReplacingImage(false);
    },
    [closeAllDropdowns, commit, editor]
  );

  const startEditing = useCallback(() => {
    if (!isEditMode || !editor || editingSessionRef.current) return;
    editingSessionRef.current = true;
    editor.setEditable(true);
    setIsEditing(true);
    editor.commands.focus('end');
    trackEvent(ANALYTICS_EVENTS.DASHBOARD_RICH_TEXT_EDIT_STARTED, {
      dashboard_id: dashboardId,
    });
    requestAnimationFrame(calculateToolbarPosition);
  }, [calculateToolbarPosition, editor, isEditMode, dashboardId]);

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
      const detail = (event as CustomEvent<Partial<RichTextFlushEventDetail>>).detail;
      if (!Array.isArray(detail?.updates)) return;
      const nextConfig = commit(false);
      if (nextConfig) {
        detail.updates.push({
          componentId,
          config: nextConfig,
        });
      }
      editingSessionRef.current = false;
      editor?.setEditable(false);
      setIsEditing(false);
      closeAllDropdowns();
      setIsReplacingImage(false);
    };
    document.addEventListener(DASHBOARD_RICH_TEXT_FLUSH_EVENT, handleFlush);
    return () => document.removeEventListener(DASHBOARD_RICH_TEXT_FLUSH_EVENT, handleFlush);
  }, [closeAllDropdowns, commit, componentId, editor, isEditing]);

  // Best-effort: an old S3-uploaded image being replaced/removed is deleted
  // in the background. Failures are logged, not surfaced — the user's edit
  // (new image applied / old one removed from the widget) already succeeded,
  // and blocking on S3 cleanup would hold up an unrelated action.
  const deleteS3ImageIfNeeded = useCallback((imageKey: string | undefined) => {
    if (!imageKey) return;
    apiDelete('/api/dashboards/images/', { body: JSON.stringify({ image_key: imageKey }) }).catch(
      (err) => {
        console.error('Failed to delete old dashboard widget image from S3:', err);
      }
    );
  }, []);

  const handleImageUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;

      if (!ALLOWED_WIDGET_IMAGE_TYPES.has(file.type)) {
        toastError.api(new Error('Please upload a JPEG, PNG, GIF, or WEBP image.'));
        return;
      }
      if (file.size > MAX_WIDGET_IMAGE_SIZE_BYTES) {
        toastError.api(new Error('Image must be smaller than 5MB.'));
        return;
      }

      const previousImageKey = configRef.current.imageKey;
      setIsUploadingImage(true);
      try {
        const formData = new FormData();
        formData.append('file', file);
        const res: WidgetImageUploadResponse = await apiPut('/api/dashboards/images/', formData);
        onUpdate({
          ...configRef.current,
          imageUrl: res.image_url,
          imageKey: res.image_key,
          imageName: file.name,
        });
        deleteS3ImageIfNeeded(previousImageKey);
        trackEvent(ANALYTICS_EVENTS.DASHBOARD_TEXT_IMAGE_ADDED, { source: 'upload' });
        setShowImageDropdown(false);
        setIsReplacingImage(false);
      } catch (err) {
        toastError.api(err, 'Failed to upload image. Please try again.');
      } finally {
        setIsUploadingImage(false);
      }
    },
    [deleteS3ImageIfNeeded, onUpdate]
  );

  const handleImageLinkConfirm = useCallback(() => {
    if (!imageLinkInput.trim()) return;
    const trimmed = imageLinkInput.trim();
    const name = trimmed.split('/').pop() || 'image';
    const previousImageKey = configRef.current.imageKey;
    onUpdate({
      ...configRef.current,
      imageUrl: trimmed,
      imageKey: undefined,
      imageName: name,
    });
    deleteS3ImageIfNeeded(previousImageKey);
    trackEvent(ANALYTICS_EVENTS.DASHBOARD_TEXT_IMAGE_ADDED, { source: 'link' });
    setImageLinkInput('');
    setShowImageDropdown(false);
    setIsReplacingImage(false);
  }, [deleteS3ImageIfNeeded, imageLinkInput, onUpdate]);

  const handleImageRemove = useCallback(() => {
    deleteS3ImageIfNeeded(configRef.current.imageKey);
    onUpdate({
      ...configRef.current,
      imageUrl: undefined,
      imageKey: undefined,
      imageName: undefined,
      imageSize: undefined,
      caption: undefined,
      captionAlign: undefined,
    });
    trackEvent(ANALYTICS_EVENTS.DASHBOARD_TEXT_IMAGE_REMOVED);
    setShowImageDropdown(false);
    setIsReplacingImage(false);
  }, [deleteS3ImageIfNeeded, onUpdate]);

  // Opens the upload/link picker without touching the current image — the
  // image is only replaced once a new upload/link is confirmed. Cancelling
  // (handleCancelReplaceImage) leaves the existing image untouched.
  const handleImageReload = useCallback(() => {
    setIsReplacingImage(true);
    setImageTab('upload');
    setImageLinkInput('');
  }, []);

  const handleCancelReplaceImage = useCallback(() => {
    setIsReplacingImage(false);
  }, []);

  const handleImageSizeChange = useCallback(
    (size: 'fill' | 'fit' | 'stretch') => {
      onUpdate({ ...configRef.current, imageSize: size });
      trackEvent(ANALYTICS_EVENTS.DASHBOARD_TEXT_IMAGE_UPDATED, { field: 'image_size' });
    },
    [onUpdate]
  );

  const handleCaptionAlignChange = useCallback(
    (align: 'left' | 'center' | 'right') => {
      onUpdate({ ...configRef.current, captionAlign: align });
      trackEvent(ANALYTICS_EVENTS.DASHBOARD_TEXT_IMAGE_UPDATED, { field: 'caption_align' });
    },
    [onUpdate]
  );

  const commitCaption = useCallback(() => {
    onUpdate({ ...configRef.current, caption: tempCaption });
    setIsEditingCaption(false);
  }, [onUpdate, tempCaption]);

  if (!editor) return null;
  if (!isEditMode && !config.content && !config.richText && !config.imageUrl) return null;

  const toolbar = isEditing ? (
    <RichTextToolbar
      editor={editor}
      dashboardId={dashboardId}
      toolbarPosition={toolbarPosition}
      showColorPicker={showColorPicker}
      setShowColorPicker={setShowColorPicker}
      showHeadingDropdown={showHeadingDropdown}
      setShowHeadingDropdown={setShowHeadingDropdown}
      showAlignDropdown={showAlignDropdown}
      setShowAlignDropdown={setShowAlignDropdown}
      showImageDropdown={showImageDropdown}
      setShowImageDropdown={setShowImageDropdown}
      isReplacingImage={isReplacingImage}
      setIsReplacingImage={setIsReplacingImage}
      config={config}
      imageTab={imageTab}
      setImageTab={setImageTab}
      imageLinkInput={imageLinkInput}
      setImageLinkInput={setImageLinkInput}
      imageInputRef={imageInputRef}
      isUploadingImage={isUploadingImage}
      onImageLinkConfirm={handleImageLinkConfirm}
      onImageReload={handleImageReload}
      onImageRemove={handleImageRemove}
      onImageSizeChange={handleImageSizeChange}
      onCaptionAlignChange={handleCaptionAlignChange}
      onCancelReplaceImage={handleCancelReplaceImage}
    />
  ) : null;

  const editorContent = (
    <EditorContent
      editor={editor}
      className={cn(
        'w-full',
        // @tiptap/extension-placeholder only marks the empty node — it ships
        // no default CSS, so the placeholder needs these utilities to render.
        '[&_p.is-editor-empty:first-child]:before:pointer-events-none [&_p.is-editor-empty:first-child]:before:float-left [&_p.is-editor-empty:first-child]:before:h-0 [&_p.is-editor-empty:first-child]:before:content-[attr(data-placeholder)]',
        config.imageUrl
          ? '[&_p.is-editor-empty:first-child]:before:text-black'
          : '[&_p.is-editor-empty:first-child]:before:text-gray-400'
      )}
    />
  );

  const captionAlign = config.captionAlign || 'left';
  const captionRow = (
    <div
      className="drag-cancel flex min-h-[12px] cursor-text items-center bg-white px-3 py-1"
      style={{ textAlign: captionAlign }}
      onClick={() => {
        if (!isEditMode) return;
        setIsEditingCaption(true);
        setTempCaption(config.caption || '');
      }}
    >
      {isEditingCaption ? (
        <input
          autoFocus
          value={tempCaption}
          onChange={(event) => setTempCaption(event.target.value)}
          onBlur={commitCaption}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === 'Escape') commitCaption();
          }}
          style={{ textAlign: captionAlign }}
          className="w-full border-none bg-transparent text-sm text-gray-600 outline-none"
          placeholder="Add caption…"
          data-testid="rich-text-caption-input"
        />
      ) : (
        <span
          className={cn(
            'w-full text-sm',
            config.caption ? 'text-gray-600' : 'italic text-gray-500'
          )}
          data-testid="rich-text-caption-display"
        >
          {config.caption || 'Add caption…'}
        </span>
      )}
    </div>
  );

  const imageObjectFitClass =
    config.imageSize === 'fit'
      ? 'object-contain'
      : config.imageSize === 'stretch'
        ? 'object-fill'
        : 'object-cover';

  const content = config.imageUrl ? (
    <div ref={containerRef} className="flex h-full w-full flex-col overflow-hidden">
      <div
        className="drag-cancel group relative min-h-0 flex-1 cursor-text"
        onClick={startEditing}
        data-testid="dashboard-text-image"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={config.imageUrl}
          alt={config.imageName || 'Widget image'}
          className={cn('h-full w-full', imageObjectFitClass)}
        />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-3">
          <div className="pointer-events-auto w-full">{editorContent}</div>
        </div>
      </div>
      {(isEditMode || config.caption) && <div className="border-t">{captionRow}</div>}
    </div>
  ) : (
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
      {editorContent}
    </div>
  );

  if (!isEditMode) return content;
  return (
    <>
      {toolbar}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={handleImageUpload}
        data-testid="rich-text-image-file-input"
        // Lives outside the toolbar's own DOM subtree, but the browser
        // refocuses this exact element when the native file picker closes —
        // without this marker, the outside-click/focus listeners below treat
        // that as "focus left the toolbar" and prematurely exit edit mode,
        // interrupting the upload before handleImageUpload can even run.
        data-rich-text-toolbar
      />
      <Card className="h-full w-full">
        <CardContent className="h-full p-0">{content}</CardContent>
      </Card>
    </>
  );
}
