'use client';

import { useState } from 'react';
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
import { Settings, Type } from 'lucide-react';

export interface TextConfig {
  content: string;
  fontSize: number;
  fontWeight: 'normal' | 'bold';
  color: string;
}

interface TextElementProps {
  config: TextConfig;
  onUpdate: (config: TextConfig) => void;
  onRemove?: () => void;
}

const fontSizeOptions = [
  { label: 'Small (12px)', value: '12' },
  { label: 'Medium (14px)', value: '14' },
  { label: 'Large (16px)', value: '16' },
  { label: 'Extra Large (18px)', value: '18' },
  { label: 'Huge (24px)', value: '24' },
];

const fontWeightOptions = [
  { label: 'Normal', value: 'normal' },
  { label: 'Bold', value: 'bold' },
];

export function TextElement({ config, onUpdate, onRemove }: TextElementProps) {
  const [isEditing, setIsEditing] = useState(false);

  const handleContentChange = (content: string) => {
    onUpdate({
      ...config,
      content,
    });
  };

  const handleFontSizeChange = (fontSize: string) => {
    onUpdate({
      ...config,
      fontSize: parseInt(fontSize),
    });
  };

  const handleFontWeightChange = (fontWeight: string) => {
    onUpdate({
      ...config,
      fontWeight: fontWeight as 'normal' | 'bold',
    });
  };

  const handleColorChange = (color: string) => {
    onUpdate({
      ...config,
      color,
    });
  };

  return (
    <div className="h-full flex flex-col">
      {/* Mini toolbar */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Type className="w-4 h-4" />
          <span>Text Block</span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setIsEditing(!isEditing)}
          className="h-6 px-2"
        >
          <Settings className="w-3 h-3" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1">
        {isEditing ? (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium">Content</label>
              <Textarea
                value={config.content}
                onChange={(e) => handleContentChange(e.target.value)}
                placeholder="Enter your text content..."
                className="mt-1 text-sm"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium">Font Size</label>
                <Select value={config.fontSize.toString()} onValueChange={handleFontSizeChange}>
                  <SelectTrigger className="mt-1 h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {fontSizeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-medium">Font Weight</label>
                <Select value={config.fontWeight} onValueChange={handleFontWeightChange}>
                  <SelectTrigger className="mt-1 h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {fontWeightOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium">Text Color</label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  type="color"
                  value={config.color}
                  onChange={(e) => handleColorChange(e.target.value)}
                  className="w-16 h-8 p-1 cursor-pointer"
                />
                <Input
                  type="text"
                  value={config.color}
                  onChange={(e) => handleColorChange(e.target.value)}
                  placeholder="#000000"
                  className="flex-1 h-8 text-sm"
                />
              </div>
            </div>
          </div>
        ) : (
          <div
            className="whitespace-pre-wrap overflow-auto h-full"
            style={{
              fontSize: `${config.fontSize}px`,
              fontWeight: config.fontWeight,
              color: config.color,
              lineHeight: 1.6,
            }}
          >
            {config.content || 'Click the settings icon to add text...'}
          </div>
        )}
      </div>
    </div>
  );
}
