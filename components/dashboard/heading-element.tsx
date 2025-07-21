'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Settings, Trash2, GripVertical, Heading } from 'lucide-react';
import { DashboardElementData, HeadingConfig } from './dashboard-builder';

interface HeadingElementProps {
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

const headingLevels = [
  { label: 'H1', value: '1' },
  { label: 'H2', value: '2' },
  { label: 'H3', value: '3' },
];

export function HeadingElement({
  element,
  isSelected,
  onSelect,
  onUpdate,
  onDelete,
}: HeadingElementProps) {
  const [isEditing, setIsEditing] = useState(false);
  const config = element.config as HeadingConfig;

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
    return sizeOptions.find((option) => option.value === currentSize)?.value || '2x1';
  };

  const handleTextChange = (text: string) => {
    onUpdate({
      config: {
        ...config,
        text,
      },
    });
  };

  const handleLevelChange = (level: string) => {
    onUpdate({
      config: {
        ...config,
        level: parseInt(level) as 1 | 2 | 3,
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

  const getHeadingSize = (level: 1 | 2 | 3) => {
    switch (level) {
      case 1:
        return 'text-3xl';
      case 2:
        return 'text-2xl';
      case 3:
        return 'text-xl';
      default:
        return 'text-2xl';
    }
  };

  const renderHeading = () => {
    const className = `font-semibold ${getHeadingSize(config.level)}`;
    const style = { color: config.color };
    const text = config.text || 'Heading';

    switch (config.level) {
      case 1:
        return (
          <h1 className={className} style={style}>
            {text}
          </h1>
        );
      case 2:
        return (
          <h2 className={className} style={style}>
            {text}
          </h2>
        );
      case 3:
        return (
          <h3 className={className} style={style}>
            {text}
          </h3>
        );
      default:
        return (
          <h2 className={className} style={style}>
            {text}
          </h2>
        );
    }
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
                <Heading className="h-4 w-4" />
                {element.title || 'Heading'}
              </CardTitle>
              <CardDescription className="text-xs">H{config.level} Element</CardDescription>
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
              <label className="text-sm font-medium">Text</label>
              <Input
                value={config.text}
                onChange={(e) => handleTextChange(e.target.value)}
                placeholder="Enter heading text..."
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Heading Level</label>
                <Select value={config.level.toString()} onValueChange={handleLevelChange}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {headingLevels.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
          </div>
        ) : (
          <div
            className="w-full"
            style={{
              minHeight: `${Math.max(60, element.gridSize.rows * 60)}px`,
            }}
          >
            {renderHeading()}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
