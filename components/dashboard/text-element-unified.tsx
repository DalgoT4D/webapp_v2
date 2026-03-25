'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { HexColorPicker } from 'react-colorful';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Type,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Palette,
  PaintBucket,
  Hash,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { calculateTextDimensions } from '@/lib/chart-size-constraints';

// Curated font list: 3 serif, 3 sans-serif (including handwriting style)
// Uses CSS variables set by next/font/google in layout.tsx
export const FONT_OPTIONS = [
  { label: 'System Default', value: '', category: 'default' },
  { label: 'Anek Latin', value: 'var(--font-anek-latin), sans-serif', category: 'sans-serif' },
  { label: 'Inter', value: 'var(--font-inter), sans-serif', category: 'sans-serif' },
  { label: 'Farsan', value: 'var(--font-farsan), cursive', category: 'sans-serif' },
  { label: 'PT Serif', value: 'var(--font-pt-serif), serif', category: 'serif' },
  { label: 'Merriweather', value: 'var(--font-merriweather), serif', category: 'serif' },
  { label: 'Playfair Display', value: 'var(--font-playfair-display), serif', category: 'serif' },
] as const;

export interface UnifiedTextConfig {
  content: string;
  type: 'paragraph' | 'heading';
  headingLevel?: 1 | 2 | 3;
  fontSize: number;
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
  textDecoration: 'none' | 'underline';
  textAlign: 'left' | 'center' | 'right';
  color: string;
  backgroundColor?: string;
  fontFamily?: string;
  contentConstraints?: {
    minWidth: number;
    minHeight: number;
  };
}

interface UnifiedTextElementProps {
  config: UnifiedTextConfig;
  onUpdate: (config: UnifiedTextConfig) => void;
  onRemove?: () => void;
  isEditMode?: boolean;
}

// Font size options from 10px to 32px
const fontSizeOptions = Array.from({ length: 23 }, (_, i) => 10 + i);

const textTypePresets = [
  { label: 'H1', value: 1, type: 'heading' },
  { label: 'H2', value: 2, type: 'heading' },
  { label: 'H3', value: 3, type: 'heading' },
  { label: 'T', value: 'paragraph', type: 'paragraph' },
];

const colorPresets = [
  { color: '#000000', name: 'Black' },
  { color: '#374151', name: 'Dark Gray' },
  { color: '#6B7280', name: 'Gray' },
  { color: '#EF4444', name: 'Red' },
  { color: '#F59E0B', name: 'Orange' },
  { color: '#10B981', name: 'Green' },
  { color: '#3B82F6', name: 'Blue' },
  { color: '#8B5CF6', name: 'Purple' },
];

const bgColorPresets = [
  { color: '', name: 'None' },
  { color: '#FFFFFF', name: 'White' },
  { color: '#F3F4F6', name: 'Light Gray' },
  { color: '#FEF3C7', name: 'Light Yellow' },
  { color: '#DBEAFE', name: 'Light Blue' },
  { color: '#D1FAE5', name: 'Light Green' },
  { color: '#FCE7F3', name: 'Light Pink' },
  { color: '#EDE9FE', name: 'Light Purple' },
];

// Helper to build consistent text styles from config
function buildTextStyles(config: UnifiedTextConfig): React.CSSProperties {
  return {
    fontSize: `${config.fontSize}px`,
    fontWeight: config.fontWeight,
    fontStyle: config.fontStyle,
    textDecoration: config.textDecoration,
    textAlign: config.textAlign as React.CSSProperties['textAlign'],
    color: config.color,
    backgroundColor: config.backgroundColor || 'transparent',
    fontFamily: config.fontFamily || undefined,
    lineHeight: config.type === 'heading' ? '1.2' : '1.5',
    margin: 0,
    padding: config.backgroundColor ? '8px 12px' : 0,
    wordBreak: 'break-word',
    borderRadius: config.backgroundColor ? '4px' : undefined,
  };
}

export function UnifiedTextElement({
  config,
  onUpdate,
  onRemove,
  isEditMode = true,
}: UnifiedTextElementProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempContent, setTempContent] = useState(config.content);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showBgColorPicker, setShowBgColorPicker] = useState(false);

  // Helper function to calculate and update content constraints
  const updateWithContentConstraints = useCallback(
    (updatedConfig: UnifiedTextConfig) => {
      const textDimensions = calculateTextDimensions({
        content: updatedConfig.content,
        fontSize: updatedConfig.fontSize,
        fontWeight: updatedConfig.fontWeight,
        type: updatedConfig.type,
        textAlign: updatedConfig.textAlign,
      });

      const configWithConstraints = {
        ...updatedConfig,
        contentConstraints: {
          minWidth: textDimensions.width,
          minHeight: textDimensions.height,
        },
      };

      onUpdate(configWithConstraints);
    },
    [onUpdate]
  );

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [toolbarPosition, setToolbarPosition] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  // Sync tempContent when config.content changes from outside (like formatting)
  useEffect(() => {
    if (!isEditing) {
      setTempContent(config.content || '');
    }
  }, [config.content, isEditing]);

  // Prevent content clearing when entering edit mode
  useEffect(() => {
    if (isEditing && !tempContent && config.content) {
      setTempContent(config.content);
    }
  }, [isEditing, tempContent, config.content]);

  // Calculate toolbar position when editing starts
  const calculateToolbarPosition = useCallback(() => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const toolbarHeight = 50; // Approximate toolbar height

    // Check if there's space above the component
    const spaceAbove = rect.top;
    const spaceBelow = viewportHeight - rect.bottom;

    let top: number;
    let left = rect.left;
    let width = rect.width;

    // Position above if there's enough space, otherwise below
    if (spaceAbove >= toolbarHeight + 10) {
      top = rect.top - toolbarHeight - 10;
    } else if (spaceBelow >= toolbarHeight + 10) {
      top = rect.bottom + 10;
    } else {
      // If no space above or below, position at top of viewport
      top = 10;
    }

    // Ensure toolbar doesn't go off-screen horizontally
    if (left + width > window.innerWidth) {
      left = window.innerWidth - width - 10;
    }
    if (left < 10) {
      left = 10;
      width = Math.min(width, window.innerWidth - 20);
    }

    setToolbarPosition({ top, left, width });
  }, []);

  // Auto-hide toolbar when clicking outside
  useEffect(() => {
    if (!isEditing) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      // Don't hide if clicking on the text component or toolbar
      if (
        containerRef.current?.contains(target) ||
        target.closest('[data-toolbar]') ||
        target.closest('.drag-cancel')
      ) {
        return;
      }

      // Auto-save and hide toolbar
      updateWithContentConstraints({ ...config, content: tempContent });
      setIsEditing(false);
      setShowColorPicker(false);
      setShowBgColorPicker(false);
      setToolbarPosition(null);
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isEditing, config, tempContent, onUpdate]);

  // Auto-resize textarea and focus when editing
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      const textarea = textareaRef.current;

      // Focus and select text consistently
      setTimeout(() => {
        if (textarea) {
          textarea.focus();
          // Always select all text when entering edit mode
          textarea.setSelectionRange(0, textarea.value.length);
        }
      }, 50);

      // Stable resize function - prevent jumping by maintaining scroll position
      const autoResize = () => {
        const scrollTop = textarea.scrollTop;
        const selectionStart = textarea.selectionStart;
        const selectionEnd = textarea.selectionEnd;

        // Store the current scroll position of the parent container
        const parentScroll = containerRef.current?.scrollTop || 0;

        textarea.style.height = 'auto';
        const newHeight = Math.max(32, textarea.scrollHeight);
        textarea.style.height = newHeight + 'px';

        // Restore all positions to prevent jumping
        textarea.scrollTop = scrollTop;
        textarea.setSelectionRange(selectionStart, selectionEnd);

        // Restore parent scroll if it exists
        if (containerRef.current) {
          containerRef.current.scrollTop = parentScroll;
        }
      };

      autoResize();
      textarea.addEventListener('input', autoResize);

      return () => {
        textarea.removeEventListener('input', autoResize);
      };
    }
  }, [isEditing, config.fontSize]);

  // Start editing mode
  const startEditing = useCallback(() => {
    if (!isEditMode) return;
    // Preserve current content to prevent disappearing
    const currentContent = config.content || '';
    if (!isEditing) {
      setTempContent(currentContent);
      setIsEditing(true);
      // Calculate toolbar position after a brief delay to ensure DOM is updated
      setTimeout(calculateToolbarPosition, 10);
    }
  }, [config.content, isEditMode, isEditing, calculateToolbarPosition]);

  // Quick formatting function - auto-save and continue editing
  const handleQuickFormat = useCallback(
    (property: keyof UnifiedTextConfig, value: string | number | boolean | undefined) => {
      // Store current state to prevent jumping
      const textarea = textareaRef.current;
      const selectionStart = textarea?.selectionStart || 0;
      const selectionEnd = textarea?.selectionEnd || 0;
      const scrollTop = textarea?.scrollTop || 0;
      const parentScroll = containerRef.current?.scrollTop || 0;

      // Auto-save content and formatting immediately
      const updatedConfig = { ...config, content: tempContent, [property]: value };
      updateWithContentConstraints(updatedConfig);

      // Use requestAnimationFrame for smoother restoration
      requestAnimationFrame(() => {
        if (textarea) {
          textarea.focus();
          textarea.setSelectionRange(selectionStart, selectionEnd);
          textarea.scrollTop = scrollTop;

          // Restore parent container scroll
          if (containerRef.current) {
            containerRef.current.scrollTop = parentScroll;
          }
        }
      });

      // Keep editing state active for continued editing
      setIsEditing(true);
    },
    [config, tempContent, onUpdate]
  );

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && e.ctrlKey) {
        e.preventDefault();
        // Auto-save and exit on Ctrl+Enter
        updateWithContentConstraints({ ...config, content: tempContent });
        setIsEditing(false);
        setShowColorPicker(false);
        setShowBgColorPicker(false);
        setToolbarPosition(null);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        // Cancel and exit on Escape (revert to original content)
        setTempContent(config.content);
        setIsEditing(false);
        setShowColorPicker(false);
        setShowBgColorPicker(false);
        setToolbarPosition(null);
      } else if (e.ctrlKey) {
        // Format shortcuts with auto-save
        if (e.key === 'b') {
          e.preventDefault();
          handleQuickFormat('fontWeight', config.fontWeight === 'bold' ? 'normal' : 'bold');
        } else if (e.key === 'i') {
          e.preventDefault();
          handleQuickFormat('fontStyle', config.fontStyle === 'italic' ? 'normal' : 'italic');
        } else if (e.key === 'u') {
          e.preventDefault();
          handleQuickFormat(
            'textDecoration',
            config.textDecoration === 'underline' ? 'none' : 'underline'
          );
        }
      }
    },
    [config, tempContent, onUpdate, handleQuickFormat]
  );

  // Handle text type change - auto-save and continue editing
  const handleTypeChange = useCallback(
    (newType: string | number) => {
      // Store current state to prevent jumping
      const textarea = textareaRef.current;
      const selectionStart = textarea?.selectionStart || 0;
      const selectionEnd = textarea?.selectionEnd || 0;
      const scrollTop = textarea?.scrollTop || 0;
      const parentScroll = containerRef.current?.scrollTop || 0;

      if (newType === 'paragraph') {
        updateWithContentConstraints({
          ...config,
          content: tempContent, // Auto-save current content
          type: 'paragraph',
        });
      } else {
        const headingLevel = newType as 1 | 2 | 3;
        updateWithContentConstraints({
          ...config,
          content: tempContent, // Auto-save current content
          type: 'heading',
          headingLevel,
        });
      }

      // Use requestAnimationFrame for smoother restoration
      requestAnimationFrame(() => {
        if (textarea) {
          textarea.focus();
          textarea.setSelectionRange(selectionStart, selectionEnd);
          textarea.scrollTop = scrollTop;

          // Restore parent container scroll
          if (containerRef.current) {
            containerRef.current.scrollTop = parentScroll;
          }
        }
      });

      // Keep editing state active for continued editing
      setIsEditing(true);
    },
    [config, tempContent, onUpdate]
  );

  // Floating toolbar component that renders via portal
  const FloatingToolbar = () => {
    if (!toolbarPosition || !isEditing) return null;

    return createPortal(
      <div
        className="fixed z-[9999] pointer-events-auto drag-cancel"
        style={{
          top: toolbarPosition.top,
          left: toolbarPosition.left,
          width: Math.min(toolbarPosition.width, 700),
          minWidth: 580,
        }}
        data-toolbar="true"
      >
        <div
          className="bg-white shadow-2xl rounded-lg border border-gray-200 px-3 py-2 flex items-center backdrop-blur-sm w-full"
          data-toolbar="true"
        >
          {/* Left: Quick format buttons */}
          <div className="flex items-center gap-1 flex-1">
            {/* Text Type */}
            <div className="flex">
              {textTypePresets.map((preset) => (
                <Button
                  key={preset.label}
                  size="sm"
                  variant={
                    (config.type === 'paragraph' && preset.value === 'paragraph') ||
                    (config.type === 'heading' && config.headingLevel === preset.value)
                      ? 'default'
                      : 'ghost'
                  }
                  onClick={() => handleTypeChange(preset.value)}
                  className="h-6 px-1.5 text-xs"
                  title={preset.label === 'T' ? 'Normal Text' : preset.label}
                >
                  {preset.label}
                </Button>
              ))}
            </div>

            <div className="w-px h-4 bg-gray-300 mx-1" />

            {/* Font Family Dropdown */}
            <div className="flex items-center">
              <select
                value={config.fontFamily || ''}
                onChange={(e) => handleQuickFormat('fontFamily', e.target.value)}
                className="h-6 px-1 text-xs border rounded bg-white hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-500 drag-cancel max-w-[100px]"
                title="Font Family"
                style={{ fontFamily: config.fontFamily || undefined }}
              >
                {FONT_OPTIONS.map((font) => (
                  <option
                    key={font.label}
                    value={font.value}
                    style={{ fontFamily: font.value || undefined }}
                  >
                    {font.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Font Size Dropdown */}
            <div className="flex items-center">
              <select
                value={config.fontSize}
                onChange={(e) => handleQuickFormat('fontSize', parseInt(e.target.value))}
                className="h-6 px-1 text-xs border rounded bg-white hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-500 drag-cancel"
                title="Font Size"
              >
                {fontSizeOptions.map((size) => (
                  <option key={size} value={size}>
                    {size}px
                  </option>
                ))}
              </select>
            </div>

            <div className="w-px h-4 bg-gray-300 mx-1" />

            {/* Formatting */}
            <Button
              size="sm"
              variant={config.fontWeight === 'bold' ? 'default' : 'ghost'}
              onClick={() =>
                handleQuickFormat('fontWeight', config.fontWeight === 'bold' ? 'normal' : 'bold')
              }
              className="h-6 px-1.5"
              title="Bold"
            >
              <Bold className="w-3 h-3" />
            </Button>
            <Button
              size="sm"
              variant={config.fontStyle === 'italic' ? 'default' : 'ghost'}
              onClick={() =>
                handleQuickFormat('fontStyle', config.fontStyle === 'italic' ? 'normal' : 'italic')
              }
              className="h-6 px-1.5"
              title="Italic"
            >
              <Italic className="w-3 h-3" />
            </Button>

            <div className="w-px h-4 bg-gray-300 mx-1" />

            {/* Alignment */}
            <Button
              size="sm"
              variant={config.textAlign === 'left' ? 'default' : 'ghost'}
              onClick={() => handleQuickFormat('textAlign', 'left')}
              className="h-6 px-1.5"
              title="Align Left"
            >
              <AlignLeft className="w-3 h-3" />
            </Button>
            <Button
              size="sm"
              variant={config.textAlign === 'center' ? 'default' : 'ghost'}
              onClick={() => handleQuickFormat('textAlign', 'center')}
              className="h-6 px-1.5"
              title="Align Center"
            >
              <AlignCenter className="w-3 h-3" />
            </Button>
            <Button
              size="sm"
              variant={config.textAlign === 'right' ? 'default' : 'ghost'}
              onClick={() => handleQuickFormat('textAlign', 'right')}
              className="h-6 px-1.5"
              title="Align Right"
            >
              <AlignRight className="w-3 h-3" />
            </Button>
          </div>

          {/* Right: Color pickers */}
          <div className="flex items-center gap-1 flex-shrink-0 relative">
            <div className="w-px h-4 bg-gray-300 mx-1" />

            {/* Text Color */}
            <Button
              size="sm"
              variant={showColorPicker ? 'default' : 'ghost'}
              onClick={() => {
                setShowColorPicker(!showColorPicker);
                setShowBgColorPicker(false);
              }}
              className="h-6 px-1.5 relative"
              title="Text Color"
            >
              <Palette className="w-3 h-3" />
              <div
                className="absolute bottom-0 right-0 w-2 h-2 rounded-full border border-white"
                style={{ backgroundColor: config.color }}
              />
            </Button>

            {/* Background Color */}
            <Button
              size="sm"
              variant={showBgColorPicker ? 'default' : 'ghost'}
              onClick={() => {
                setShowBgColorPicker(!showBgColorPicker);
                setShowColorPicker(false);
              }}
              className="h-6 px-1.5 relative"
              title="Background Color"
            >
              <PaintBucket className="w-3 h-3" />
              {config.backgroundColor && (
                <div
                  className="absolute bottom-0 right-0 w-2 h-2 rounded-full border border-gray-400"
                  style={{ backgroundColor: config.backgroundColor }}
                />
              )}
            </Button>

            {/* Text Color picker dropdown */}
            {showColorPicker && (
              <div
                className="absolute bg-white shadow-lg border rounded p-2 z-[10000] min-w-[120px]"
                data-toolbar="true"
                style={{
                  top: toolbarPosition && toolbarPosition.top > 200 ? 'auto' : '100%',
                  bottom: toolbarPosition && toolbarPosition.top > 200 ? '100%' : 'auto',
                  right: 0,
                  marginTop: toolbarPosition && toolbarPosition.top <= 200 ? '8px' : '0',
                  marginBottom: toolbarPosition && toolbarPosition.top > 200 ? '8px' : '0',
                }}
              >
                <div className="grid grid-cols-4 gap-1">
                  {colorPresets.map((preset) => (
                    <button
                      key={preset.color}
                      className={cn(
                        'w-6 h-6 rounded border transition-all hover:scale-110',
                        config.color === preset.color
                          ? 'border-blue-500 scale-110'
                          : 'border-gray-200'
                      )}
                      style={{ backgroundColor: preset.color }}
                      onClick={() => {
                        handleQuickFormat('color', preset.color);
                        setShowColorPicker(false);
                      }}
                      title={preset.name}
                    />
                  ))}
                </div>
                {/* Custom color input */}
                <div className="mt-2 pt-2 border-t border-gray-200">
                  <input
                    type="color"
                    value={config.color}
                    onChange={(e) => {
                      handleQuickFormat('color', e.target.value);
                      setShowColorPicker(false);
                    }}
                    className="w-full h-6 rounded border cursor-pointer"
                    title="Custom color"
                  />
                </div>
              </div>
            )}

            {/* Background Color picker dropdown */}
            {showBgColorPicker && (
              <div
                className="absolute bg-white shadow-lg border rounded p-3 z-[10000] min-w-[200px]"
                data-toolbar="true"
                style={{
                  top: toolbarPosition && toolbarPosition.top > 200 ? 'auto' : '100%',
                  bottom: toolbarPosition && toolbarPosition.top > 200 ? '100%' : 'auto',
                  right: 0,
                  marginTop: toolbarPosition && toolbarPosition.top <= 200 ? '8px' : '0',
                  marginBottom: toolbarPosition && toolbarPosition.top > 200 ? '8px' : '0',
                }}
              >
                <p className="text-xs text-gray-500 mb-2">Fill Color</p>
                <div className="grid grid-cols-4 gap-1 mb-2">
                  {bgColorPresets.map((preset) => (
                    <button
                      key={preset.color || 'none'}
                      className={cn(
                        'w-6 h-6 rounded border transition-all hover:scale-110',
                        (config.backgroundColor || '') === preset.color
                          ? 'border-blue-500 scale-110'
                          : 'border-gray-200'
                      )}
                      style={{
                        backgroundColor: preset.color || '#FFFFFF',
                        backgroundImage: !preset.color
                          ? 'linear-gradient(135deg, #FFFFFF 45%, #EF4444 45%, #EF4444 55%, #FFFFFF 55%)'
                          : undefined,
                      }}
                      onClick={() => {
                        handleQuickFormat('backgroundColor', preset.color);
                        setShowBgColorPicker(false);
                      }}
                      title={preset.name}
                    />
                  ))}
                </div>
                <div className="pt-2 border-t border-gray-200">
                  <HexColorPicker
                    color={config.backgroundColor || '#FFFFFF'}
                    onChange={(color) => {
                      handleQuickFormat('backgroundColor', color);
                    }}
                    style={{ width: '100%', height: '120px' }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>,
      document.body
    );
  };

  // Preview mode - simplified structure to match container height
  if (!isEditMode) {
    const content = config.content || '';

    if (!content) return null; // Don't render empty text in preview

    const textStyles = buildTextStyles(config);

    return (
      <div
        ref={containerRef}
        className="h-full w-full flex items-center justify-center p-4"
        onClick={startEditing}
        style={
          config.backgroundColor
            ? { backgroundColor: config.backgroundColor, borderRadius: '4px' }
            : undefined
        }
      >
        {config.content ? (
          config.type === 'heading' ? (
            (() => {
              const Tag = `h${config.headingLevel || 2}` as keyof React.JSX.IntrinsicElements;
              return (
                <Tag className="whitespace-pre-wrap break-words w-full" style={textStyles}>
                  {config.content}
                </Tag>
              );
            })()
          ) : (
            <div className="whitespace-pre-wrap break-words w-full" style={textStyles}>
              {config.content}
            </div>
          )
        ) : (
          <div className="text-gray-400 italic text-sm">Click to add text...</div>
        )}
      </div>
    );
  }

  // Edit mode - use same Card structure as charts
  return (
    <>
      {/* Floating toolbar rendered via portal */}
      <FloatingToolbar />

      <div ref={containerRef} className="h-full w-full">
        <Card
          className="h-full w-full flex flex-col"
          style={config.backgroundColor ? { backgroundColor: config.backgroundColor } : undefined}
        >
          <CardContent className="p-4 flex-1 flex flex-col min-h-0">
            <div
              className={cn(
                'flex-1 w-full h-full cursor-text transition-all duration-200 drag-cancel flex items-center justify-center',
                isEditing ? 'rounded' : 'bg-transparent',
                !config.content && 'justify-center'
              )}
              onClick={startEditing}
            >
              {isEditing ? (
                <textarea
                  ref={textareaRef}
                  value={tempContent}
                  onChange={(e) => setTempContent(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={(e) => {
                    // Don't exit if clicking on toolbar elements
                    const relatedTarget = e.relatedTarget as HTMLElement;
                    if (
                      relatedTarget &&
                      (relatedTarget.closest('.drag-cancel') ||
                        relatedTarget.closest('[data-toolbar]'))
                    ) {
                      return;
                    }

                    // Auto-save content and exit editing after a delay
                    setTimeout(() => {
                      // Only exit if focus has truly moved away from the component and we're not clicking on the textarea itself
                      const activeElement = document.activeElement;
                      const isStillFocusedOnComponent =
                        containerRef.current?.contains(activeElement);
                      const isStillFocusedOnTextarea = activeElement === textareaRef.current;

                      if (!isStillFocusedOnComponent && !isStillFocusedOnTextarea) {
                        // Always save the current content, even if empty
                        updateWithContentConstraints({ ...config, content: tempContent });
                        setIsEditing(false);
                        setShowColorPicker(false);
                        setShowBgColorPicker(false);
                        setToolbarPosition(null);
                      }
                    }, 200);
                  }}
                  className="resize-none border-none outline-none bg-transparent drag-cancel w-full text-center"
                  style={{
                    fontSize: `${config.fontSize}px`,
                    fontWeight: config.fontWeight,
                    fontStyle: config.fontStyle,
                    textDecoration: config.textDecoration,
                    textAlign: config.textAlign as React.CSSProperties['textAlign'],
                    color: config.color,
                    fontFamily: config.fontFamily || undefined,
                    lineHeight: config.type === 'heading' ? '1.2' : '1.5',
                    margin: 0,
                    outline: 'none',
                    wordBreak: 'break-word',
                    resize: 'none',
                    border: 'none',
                    padding: 0,
                    height: 'auto',
                    minHeight: 'auto',
                    overflow: 'visible',
                  }}
                  placeholder="Start typing..."
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  {config.content ? (
                    config.type === 'heading' ? (
                      (() => {
                        const Tag =
                          `h${config.headingLevel || 2}` as keyof React.JSX.IntrinsicElements;
                        return (
                          <Tag
                            className="whitespace-pre-wrap break-words w-full text-center"
                            style={buildTextStyles(config)}
                          >
                            {config.content}
                          </Tag>
                        );
                      })()
                    ) : (
                      <div
                        className="whitespace-pre-wrap break-words w-full text-center"
                        style={buildTextStyles(config)}
                      >
                        {config.content}
                      </div>
                    )
                  ) : (
                    <div className="text-gray-400 italic text-sm">Click to add text...</div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
