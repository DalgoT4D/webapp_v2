'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Settings, Trash2, GripVertical, Type } from 'lucide-react';
import { DashboardElementData, TextConfig } from './dashboard-builder';

interface TextElementProps {
  element: DashboardElementData;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (updates: Partial<DashboardElementData>) => void;
  onDelete: () => void;
}

const sizeOptions = [
  { label: 'Small (1x1)', value: '1x1', cols: 1, rows: 1 },
  { label: 'Medium (2x1)', value: '2x1', cols: 2, rows: 1 },
  { label: 'Large (2x2)', value: '2x2', cols: 2, rows: 2 },
  { label: 'Wide (3x1)', value: '3x1', cols: 3, rows: 1 },
  { label: 'Extra Large (3x2)', value: '3x2', cols: 3, rows: 2 },
];

const fontSizeOptions = [
  { label: 'Small', value: '12' },
  { label: 'Medium', value: '14' },
  { label: 'Large', value: '16' },
  { label: 'Extra Large', value: '18' },
];

const fontWeightOptions = [
  { label: 'Normal', value: 'normal' },
  { label: 'Bold', value: 'bold' },
];

export function TextElement({
  element,
  isSelected,
  onSelect,
  onUpdate,
  onDelete,
}: TextElementProps) {
  const [isEditing, setIsEditing] = useState(false);
  const config = element.config as TextConfig;

  const handleSizeChange = (sizeValue: string) => {
    const sizeOption = sizeOptions.find((option) => option.value === sizeValue);
    if (sizeOption) {
      onUpdate({
        gridSize: {
          cols: sizeOption.cols,
          rows: sizeOption.rows,
        },
      });
    }
  };

  const getCurrentSizeValue = () => {
    const currentSize = `${element.gridSize.cols}x${element.gridSize.rows}`;
    return sizeOptions.find((option) => option.value === currentSize)?.value || '1x1';
  };

  const handleContentChange = (content: string) => {
    onUpdate({
      config: {
        ...config,
        content,
      },
    });
  };

  const handleFontSizeChange = (fontSize: string) => {
    onUpdate({
      config: {
        ...config,
        fontSize: parseInt(fontSize),
      },
    });
  };

  const handleFontWeightChange = (fontWeight: string) => {
    onUpdate({
      config: {
        ...config,
        fontWeight: fontWeight as 'normal' | 'bold',
      },
    });
  };

  const handleColorChange = (color: string) => {
    onUpdate({
      config: {
        ...config,
        color,
      },
    });
  };

  return (
    <Card
      className={`cursor-pointer transition-all duration-200 ${
        isSelected ? 'ring-2 ring-blue-500 shadow-lg' : 'hover:shadow-md'
      }`}
      onClick={onSelect}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="cursor-grab active:cursor-grabbing p-1 hover:bg-gray-100 rounded">
              <GripVertical className="h-4 w-4 text-gray-400" />
            </div>
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Type className="h-4 w-4" />
                {element.title || 'Text Block'}
              </CardTitle>
              <CardDescription className="text-xs">Text Element</CardDescription>
            </div>
          </div>

          {isSelected && (
            <div className="flex items-center gap-1">
              <Select value={getCurrentSizeValue()} onValueChange={handleSizeChange}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sizeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditing(!isEditing);
                }}
              >
                <Settings className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {isEditing ? (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Content</label>
              <Textarea
                value={config.content}
                onChange={(e) => handleContentChange(e.target.value)}
                placeholder="Enter your text content..."
                className="mt-1"
                rows={4}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Font Size</label>
                <Select value={config.fontSize.toString()} onValueChange={handleFontSizeChange}>
                  <SelectTrigger className="mt-1">
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
                <label className="text-sm font-medium">Font Weight</label>
                <Select value={config.fontWeight} onValueChange={handleFontWeightChange}>
                  <SelectTrigger className="mt-1">
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
              <label className="text-sm font-medium">Color</label>
              <Input
                type="color"
                value={config.color}
                onChange={(e) => handleColorChange(e.target.value)}
                className="mt-1 w-20 h-10"
              />
            </div>
          </div>
        ) : (
          <div
            className="w-full"
            style={{
              minHeight: `${Math.max(100, element.gridSize.rows * 100)}px`,
            }}
          >
            <div
              className="whitespace-pre-wrap"
              style={{
                fontSize: `${config.fontSize}px`,
                fontWeight: config.fontWeight,
                color: config.color,
                lineHeight: 1.5,
              }}
            >
              {config.content || 'Enter your text here...'}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
