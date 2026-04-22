'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface ImageComponentConfig {
  imageUrl: string;
  alt?: string;
  objectFit?: ImageFitMode;
}

interface ImageElementProps {
  config: ImageComponentConfig;
  onUpdate: (config: ImageComponentConfig) => void;
  isEditMode?: boolean;
}

export type ImageFitMode = 'contain' | 'cover' | 'fill';

export const DEFAULT_IMAGE_FIT_MODE: ImageFitMode = 'contain';

const ACCEPTED_IMAGE_TYPES = 'image/png,image/jpeg,image/svg+xml,image/webp';

const IMAGE_FIT_OPTIONS: Array<{ value: ImageFitMode; label: string }> = [
  { value: 'contain', label: 'Fit' },
  { value: 'cover', label: 'Crop' },
  { value: 'fill', label: 'Stretch' },
];

function isImageFitMode(value: string): value is ImageFitMode {
  return IMAGE_FIT_OPTIONS.some((option) => option.value === value);
}

function getImageObjectFit(value?: string): ImageFitMode {
  return value && isImageFitMode(value) ? value : DEFAULT_IMAGE_FIT_MODE;
}

export function ImageElement({ config, onUpdate, isEditMode = true }: ImageElementProps) {
  const [imageError, setImageError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const objectFit = getImageObjectFit(config.objectFit);
  const hasImage = Boolean(config.imageUrl);

  // Reset error state when image changes
  useEffect(() => {
    setImageError(false);
  }, [config.imageUrl]);

  const handleImageChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        onUpdate({
          ...config,
          imageUrl: reader.result as string,
          objectFit,
        });
      };
      reader.readAsDataURL(file);
      event.target.value = '';
    },
    [config, objectFit, onUpdate]
  );

  const handleObjectFitChange = useCallback(
    (nextValue: string) => {
      if (!isImageFitMode(nextValue)) return;
      onUpdate({ ...config, objectFit: nextValue });
    },
    [config, onUpdate]
  );

  const imageSurface = (
    <div
      className="relative h-full w-full overflow-hidden rounded-md bg-slate-50"
      data-testid={isEditMode ? 'dashboard-image-edit-surface' : 'dashboard-image-view-surface'}
    >
      {hasImage ? (
        <>
          <img
            src={config.imageUrl}
            alt={config.alt || 'Dashboard image'}
            className="h-full w-full"
            style={{ objectFit }}
            data-testid={
              isEditMode ? 'dashboard-image-edit-preview' : 'dashboard-image-view-preview'
            }
            onError={() => setImageError(true)}
          />
          {imageError && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50 text-sm text-gray-400">
              Image failed to load
            </div>
          )}
        </>
      ) : (
        <div className="flex h-full w-full items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 text-center">
          <div className="drag-cancel flex flex-col items-center gap-3 text-slate-500">
            <ImageIcon className="h-8 w-8" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-slate-700">Add an image</p>
              <p className="text-xs text-slate-500">Upload it here and it will render on-canvas.</p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="drag-cancel"
              onClick={() => fileInputRef.current?.click()}
              data-testid="dashboard-image-upload-btn"
            >
              <Upload className="mr-2 h-4 w-4" />
              Upload Image
            </Button>
          </div>
        </div>
      )}

      {isEditMode && hasImage && (
        <div className="pointer-events-none absolute inset-x-2 bottom-2 flex justify-start">
          <div className="pointer-events-auto drag-cancel flex items-center gap-2 rounded-md border border-slate-200 bg-white/92 p-1 shadow-sm backdrop-blur-sm">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="drag-cancel h-7 px-2 text-xs"
              onClick={() => fileInputRef.current?.click()}
              data-testid="dashboard-image-change-btn"
            >
              Change
            </Button>
            <Select value={objectFit} onValueChange={handleObjectFitChange}>
              <SelectTrigger
                size="sm"
                aria-label="Image fit mode"
                className="drag-cancel h-7 w-[92px] border-0 bg-transparent px-2 shadow-none focus-visible:ring-0"
                data-testid="dashboard-image-fit-select-trigger"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {IMAGE_FIT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  );

  // View mode — just render the image
  if (!isEditMode) {
    if (!config.imageUrl) return null;

    return (
      <div ref={containerRef} className="h-full w-full p-2">
        {imageSurface}
      </div>
    );
  }

  // Edit mode — render the saved image treatment directly on canvas
  return (
    <div ref={containerRef} className="h-full w-full">
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES}
        className="hidden"
        onChange={handleImageChange}
        data-testid="dashboard-image-file-input"
      />
      <div className="h-full w-full p-2">{imageSurface}</div>
    </div>
  );
}
