'use client';

import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Card } from '@/components/ui/card';
import {
  Settings,
  Type,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Palette,
  Heading1,
  Heading2,
  Heading3,
} from 'lucide-react';
import { cn } from '@/lib/utils';

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
}

interface UnifiedTextElementProps {
  config: UnifiedTextConfig;
  onUpdate: (config: UnifiedTextConfig) => void;
  onRemove?: () => void;
}

const fontSizePresets = [
  { label: 'Small', value: 12 },
  { label: 'Medium', value: 14 },
  { label: 'Large', value: 16 },
  { label: 'Extra Large', value: 18 },
  { label: 'Huge', value: 24 },
  { label: 'Title', value: 32 },
];

const colorPresets = [
  '#000000',
  '#374151',
  '#6B7280',
  '#9CA3AF',
  '#EF4444',
  '#F59E0B',
  '#10B981',
  '#3B82F6',
  '#8B5CF6',
  '#EC4899',
  '#14B8A6',
  '#F97316',
];

export function UnifiedTextElement({ config, onUpdate, onRemove }: UnifiedTextElementProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isInlineEditing, setIsInlineEditing] = useState(false);
  const [tempContent, setTempContent] = useState(config.content);
  const textRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus when entering inline edit mode
  useEffect(() => {
    if (isInlineEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isInlineEditing]);

  const handleInlineEdit = () => {
    setTempContent(config.content);
    setIsInlineEditing(true);
  };

  const handleInlineEditSave = () => {
    onUpdate({ ...config, content: tempContent });
    setIsInlineEditing(false);
  };

  const handleInlineEditCancel = () => {
    setTempContent(config.content);
    setIsInlineEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleInlineEditSave();
    } else if (e.key === 'Escape') {
      handleInlineEditCancel();
    }
  };

  const toggleTextType = () => {
    const newType = config.type === 'paragraph' ? 'heading' : 'paragraph';
    const updates: Partial<UnifiedTextConfig> = { type: newType };

    if (newType === 'heading' && !config.headingLevel) {
      updates.headingLevel = 2;
      updates.fontSize = 24;
      updates.fontWeight = 'bold';
    } else if (newType === 'paragraph') {
      updates.fontSize = 14;
      updates.fontWeight = 'normal';
    }

    onUpdate({ ...config, ...updates });
  };

  const handleQuickFormat = (property: keyof UnifiedTextConfig, value: any) => {
    onUpdate({ ...config, [property]: value });
  };

  const getDisplayStyle = () => {
    let baseStyle = {
      fontSize: `${config.fontSize}px`,
      fontWeight: config.fontWeight,
      fontStyle: config.fontStyle,
      textDecoration: config.textDecoration,
      textAlign: config.textAlign as any,
      color: config.color,
      backgroundColor: config.backgroundColor || 'transparent',
      lineHeight: config.type === 'heading' ? '1.2' : '1.6',
      margin: 0,
      padding: '8px',
      minHeight: '40px',
      width: '100%',
      border: isInlineEditing ? '2px solid #3B82F6' : '2px solid transparent',
      borderRadius: '4px',
      cursor: isInlineEditing ? 'text' : 'pointer',
      transition: 'all 0.2s ease',
    };

    return baseStyle;
  };

  const renderContent = () => {
    if (isInlineEditing) {
      return (
        <Textarea
          ref={inputRef}
          value={tempContent}
          onChange={(e) => setTempContent(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleInlineEditSave}
          className="resize-none border-0 p-2 focus:ring-0 focus:border-0 bg-transparent"
          style={{
            fontSize: `${config.fontSize}px`,
            fontWeight: config.fontWeight,
            fontStyle: config.fontStyle,
            textAlign: config.textAlign as any,
            color: config.color,
            lineHeight: config.type === 'heading' ? '1.2' : '1.6',
            minHeight: '40px',
          }}
          rows={Math.min(Math.max(tempContent.split('\n').length, 2), 6)}
        />
      );
    }

    const content = config.content || 'Click to add text...';
    const className = cn(
      'whitespace-pre-wrap break-words outline-none',
      config.type === 'heading' && config.headingLevel === 1 && 'text-3xl font-bold',
      config.type === 'heading' && config.headingLevel === 2 && 'text-2xl font-semibold',
      config.type === 'heading' && config.headingLevel === 3 && 'text-xl font-medium',
      !config.content && 'text-gray-400 italic'
    );

    if (config.type === 'heading') {
      const HeadingTag = `h${config.headingLevel || 2}` as keyof JSX.IntrinsicElements;
      return (
        <HeadingTag
          ref={textRef}
          className={className}
          style={getDisplayStyle()}
          onClick={handleInlineEdit}
        >
          {content}
        </HeadingTag>
      );
    }

    return (
      <div ref={textRef} className={className} style={getDisplayStyle()} onClick={handleInlineEdit}>
        {content}
      </div>
    );
  };

  return (
    <Card className="h-full flex flex-col bg-white/50 hover:bg-white/80 transition-colors">
      {/* Quick toolbar */}
      <div className="flex items-center justify-between p-2 border-b bg-gray-50/50">
        <div className="flex items-center gap-1">
          {/* Text Type Toggle */}
          <Button
            size="sm"
            variant={config.type === 'heading' ? 'default' : 'ghost'}
            onClick={toggleTextType}
            className="h-7 px-2"
            title={config.type === 'heading' ? 'Switch to Paragraph' : 'Switch to Heading'}
          >
            {config.type === 'heading' ? (
              config.headingLevel === 1 ? (
                <Heading1 className="w-3 h-3" />
              ) : config.headingLevel === 3 ? (
                <Heading3 className="w-3 h-3" />
              ) : (
                <Heading2 className="w-3 h-3" />
              )
            ) : (
              <Type className="w-3 h-3" />
            )}
          </Button>

          {/* Quick format buttons */}
          <Button
            size="sm"
            variant={config.fontWeight === 'bold' ? 'default' : 'ghost'}
            onClick={() =>
              handleQuickFormat('fontWeight', config.fontWeight === 'bold' ? 'normal' : 'bold')
            }
            className="h-7 px-2"
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
            className="h-7 px-2"
            title="Italic"
          >
            <Italic className="w-3 h-3" />
          </Button>

          {/* Text align */}
          <Button
            size="sm"
            variant={config.textAlign === 'left' ? 'default' : 'ghost'}
            onClick={() => handleQuickFormat('textAlign', 'left')}
            className="h-7 px-2"
            title="Align Left"
          >
            <AlignLeft className="w-3 h-3" />
          </Button>

          <Button
            size="sm"
            variant={config.textAlign === 'center' ? 'default' : 'ghost'}
            onClick={() => handleQuickFormat('textAlign', 'center')}
            className="h-7 px-2"
            title="Align Center"
          >
            <AlignCenter className="w-3 h-3" />
          </Button>

          <Button
            size="sm"
            variant={config.textAlign === 'right' ? 'default' : 'ghost'}
            onClick={() => handleQuickFormat('textAlign', 'right')}
            className="h-7 px-2"
            title="Align Right"
          >
            <AlignRight className="w-3 h-3" />
          </Button>
        </div>

        {/* Advanced settings */}
        <Popover open={isEditing} onOpenChange={setIsEditing}>
          <PopoverTrigger asChild>
            <Button size="sm" variant="ghost" className="h-7 px-2" title="More Settings">
              <Settings className="w-3 h-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" side="right">
            <div className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-medium">Text Settings</h4>

                {config.type === 'heading' && (
                  <div>
                    <label className="text-xs font-medium">Heading Level</label>
                    <Select
                      value={config.headingLevel?.toString() || '2'}
                      onValueChange={(value) => handleQuickFormat('headingLevel', parseInt(value))}
                    >
                      <SelectTrigger className="mt-1 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">H1 - Main Title</SelectItem>
                        <SelectItem value="2">H2 - Section</SelectItem>
                        <SelectItem value="3">H3 - Subsection</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div>
                  <label className="text-xs font-medium">Font Size</label>
                  <Select
                    value={config.fontSize.toString()}
                    onValueChange={(value) => handleQuickFormat('fontSize', parseInt(value))}
                  >
                    <SelectTrigger className="mt-1 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {fontSizePresets.map((preset) => (
                        <SelectItem key={preset.value} value={preset.value.toString()}>
                          {preset.label} ({preset.value}px)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-xs font-medium">Text Color</label>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {colorPresets.map((color) => (
                      <button
                        key={color}
                        className={cn(
                          'w-6 h-6 rounded border-2 transition-all',
                          config.color === color ? 'border-blue-500 scale-110' : 'border-gray-200'
                        )}
                        style={{ backgroundColor: color }}
                        onClick={() => handleQuickFormat('color', color)}
                        title={color}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Input
                      type="color"
                      value={config.color}
                      onChange={(e) => handleQuickFormat('color', e.target.value)}
                      className="w-12 h-8 p-1"
                    />
                    <Input
                      type="text"
                      value={config.color}
                      onChange={(e) => handleQuickFormat('color', e.target.value)}
                      placeholder="#000000"
                      className="flex-1 h-8 text-sm font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Text content */}
      <div className="flex-1 p-0">{renderContent()}</div>

      {isInlineEditing && (
        <div className="p-2 bg-blue-50 border-t text-xs text-blue-600">
          <strong>Tip:</strong> Press Enter to save, Esc to cancel, Shift+Enter for new line
        </div>
      )}
    </Card>
  );
}
