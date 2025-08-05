'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Settings, Heading } from 'lucide-react';

export interface HeadingConfig {
  text: string;
  level: 1 | 2 | 3;
  color: string;
}

interface HeadingElementProps {
  config: HeadingConfig;
  onUpdate: (config: HeadingConfig) => void;
  onRemove?: () => void;
}

const headingLevels = [
  { label: 'H1 - Main Title', value: '1' },
  { label: 'H2 - Section', value: '2' },
  { label: 'H3 - Subsection', value: '3' },
];

export function HeadingElement({ config, onUpdate, onRemove }: HeadingElementProps) {
  const [isEditing, setIsEditing] = useState(false);

  const handleTextChange = (text: string) => {
    onUpdate({
      ...config,
      text,
    });
  };

  const handleLevelChange = (level: string) => {
    onUpdate({
      ...config,
      level: parseInt(level) as 1 | 2 | 3,
    });
  };

  const handleColorChange = (color: string) => {
    onUpdate({
      ...config,
      color,
    });
  };

  const getHeadingSize = (level: 1 | 2 | 3) => {
    switch (level) {
      case 1:
        return 'text-3xl font-bold';
      case 2:
        return 'text-2xl font-semibold';
      case 3:
        return 'text-xl font-medium';
      default:
        return 'text-2xl font-semibold';
    }
  };

  const renderHeading = () => {
    const className = getHeadingSize(config.level);
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
    <div className="h-full flex flex-col">
      {/* Mini toolbar */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Heading className="w-4 h-4" />
          <span>H{config.level} Heading</span>
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
              <label className="text-xs font-medium">Heading Text</label>
              <Input
                value={config.text}
                onChange={(e) => handleTextChange(e.target.value)}
                placeholder="Enter heading text..."
                className="mt-1 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium">Heading Level</label>
                <Select value={config.level.toString()} onValueChange={handleLevelChange}>
                  <SelectTrigger className="mt-1 h-8 text-sm">
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
                <label className="text-xs font-medium">Color</label>
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
          </div>
        ) : (
          <div className="flex items-center h-full">{renderHeading()}</div>
        )}
      </div>
    </div>
  );
}
