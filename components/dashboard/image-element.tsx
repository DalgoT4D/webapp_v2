'use client';

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ImageUploader } from '@/components/ui/image-uploader';

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

export function ImageElement({ config, onUpdate, isEditMode = true }: ImageElementProps) {
  const [imageError, setImageError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset error state when image changes
  useEffect(() => {
    setImageError(false);
  }, [config.imageUrl]);

  // View mode — just render the image
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

  // Edit mode — file upload + object fit selector
  return (
    <div ref={containerRef} className="h-full w-full">
      <Card className="h-full w-full flex flex-col">
        <CardContent className="p-4 flex-1 flex flex-col gap-4 min-h-0 drag-cancel">
          <ImageUploader
            value={config.imageUrl}
            onChange={(val) => onUpdate({ ...config, imageUrl: val })}
            onRemove={() => onUpdate({ ...config, imageUrl: '' })}
            uploadLabel="Upload Image"
            changeLabel="Change Image"
            data-testid="dashboard-image-uploader"
          />

          {/* Object fit selector — only shown when image is set */}
          {config.imageUrl && (
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
