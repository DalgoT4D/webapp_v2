'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { ImageIcon, Check, X } from 'lucide-react';

export interface ImageComponentConfig {
  imageUrl: string;
  alt?: string;
  objectFit?: 'contain' | 'cover' | 'fill';
}

interface ImageElementProps {
  config: ImageComponentConfig;
  onUpdate: (config: ImageComponentConfig) => void;
  onRemove?: () => void;
  isEditMode?: boolean;
}

export function ImageElement({ config, onUpdate, onRemove, isEditMode = true }: ImageElementProps) {
  const [isEditing, setIsEditing] = useState(!config.imageUrl);
  const [tempUrl, setTempUrl] = useState(config.imageUrl || '');
  const [imageError, setImageError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset error state when URL changes
  useEffect(() => {
    setImageError(false);
  }, [config.imageUrl]);

  const handleSaveUrl = useCallback(() => {
    if (tempUrl.trim()) {
      onUpdate({ ...config, imageUrl: tempUrl.trim() });
      setIsEditing(false);
      setImageError(false);
    }
  }, [tempUrl, config, onUpdate]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSaveUrl();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setTempUrl(config.imageUrl || '');
        setIsEditing(false);
      }
    },
    [handleSaveUrl, config.imageUrl]
  );

  // View mode rendering
  if (!isEditMode) {
    if (!config.imageUrl) return null;

    return (
      <div ref={containerRef} className="h-full w-full flex items-center justify-center p-2">
        <img
          src={config.imageUrl}
          alt={config.alt || 'Dashboard image'}
          className="max-w-full max-h-full"
          style={{ objectFit: config.objectFit || 'contain' }}
          onError={() => setImageError(true)}
        />
        {imageError && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50 text-gray-400 text-sm">
            Image failed to load
          </div>
        )}
      </div>
    );
  }

  // Edit mode - URL input or image display
  return (
    <div ref={containerRef} className="h-full w-full">
      <Card className="h-full w-full flex flex-col">
        <CardContent className="p-4 flex-1 flex flex-col min-h-0">
          {isEditing || !config.imageUrl ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 drag-cancel">
              <ImageIcon className="w-8 h-8 text-gray-400" />
              <p className="text-sm text-gray-500">Enter image URL</p>
              <div className="flex items-center gap-2 w-full max-w-md">
                <Input
                  value={tempUrl}
                  onChange={(e) => setTempUrl(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="https://example.com/image.png"
                  className="flex-1 text-sm drag-cancel"
                  autoFocus
                  data-testid="image-url-input"
                />
                <Button
                  size="sm"
                  onClick={handleSaveUrl}
                  disabled={!tempUrl.trim()}
                  data-testid="image-url-save"
                >
                  <Check className="w-4 h-4" />
                </Button>
                {config.imageUrl && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setTempUrl(config.imageUrl);
                      setIsEditing(false);
                    }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
              {/* Object fit selector */}
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>Fit:</span>
                {(['contain', 'cover', 'fill'] as const).map((fit) => (
                  <button
                    key={fit}
                    className={`px-2 py-0.5 rounded border text-xs ${
                      (config.objectFit || 'contain') === fit
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                    onClick={() => onUpdate({ ...config, objectFit: fit })}
                  >
                    {fit}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div
              className="flex-1 flex items-center justify-center relative cursor-pointer group drag-cancel"
              onClick={() => setIsEditing(true)}
            >
              <img
                src={config.imageUrl}
                alt={config.alt || 'Dashboard image'}
                className="max-w-full max-h-full"
                style={{ objectFit: config.objectFit || 'contain' }}
                onError={() => setImageError(true)}
              />
              {imageError && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-50 text-gray-400 text-sm">
                  Image failed to load. Click to edit URL.
                </div>
              )}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                <span className="text-white opacity-0 group-hover:opacity-100 text-sm bg-black/50 px-2 py-1 rounded">
                  Click to edit
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
