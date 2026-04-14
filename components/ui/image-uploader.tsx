'use client';

import { useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, X, ImageIcon } from 'lucide-react';

// Accepted image formats
const ACCEPTED_IMAGE_TYPES = 'image/png,image/jpeg,image/svg+xml,image/webp';

interface ImageUploaderProps {
  value: string; // base64 or URL of current image
  onChange: (value: string) => void;
  onRemove: () => void;
  // Optional label override for the upload button
  uploadLabel?: string;
  changeLabel?: string;
  // Optional preview size
  previewClassName?: string;
  // Optional style applied to the preview <img> element (e.g. to control width)
  previewStyle?: React.CSSProperties;
  'data-testid'?: string;
}

/**
 * Reusable image uploader component.
 * Uses FileReader to convert selected file to base64 (prototype — no backend needed).
 * When backend is ready, replace the FileReader logic with an actual file upload API call.
 */
export function ImageUploader({
  value,
  onChange,
  onRemove,
  uploadLabel = 'Upload Image',
  changeLabel = 'Change Image',
  previewClassName,
  previewStyle,
  'data-testid': testId,
}: ImageUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        onChange(reader.result as string);
      };
      reader.readAsDataURL(file);
      // Reset input so the same file can be re-selected if needed
      e.target.value = '';
    },
    [onChange]
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          data-testid={testId ?? 'image-uploader-btn'}
        >
          <Upload className="w-4 h-4 mr-2" />
          {value ? changeLabel : uploadLabel}
        </Button>
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRemove}
            data-testid={testId ? `${testId}-remove` : 'image-uploader-remove-btn'}
          >
            <X className="w-4 h-4 mr-1" />
            Remove
          </Button>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES}
        className="hidden"
        onChange={handleFileSelect}
        data-testid={testId ? `${testId}-file-input` : 'image-uploader-file-input'}
      />

      {/* Preview */}
      {value && (
        <div
          className={
            previewClassName ?? 'border rounded-lg p-4 bg-gray-50 flex items-center justify-center'
          }
        >
          <img
            src={value}
            alt="Preview"
            className="max-w-full max-h-32 object-contain"
            style={previewStyle}
          />
        </div>
      )}

      {/* Empty state */}
      {!value && (
        <div className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center gap-2 text-muted-foreground">
          <ImageIcon className="w-8 h-8" />
          <p className="text-sm">No image selected</p>
        </div>
      )}
    </div>
  );
}
