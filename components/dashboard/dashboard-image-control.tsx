'use client';

import type { RefObject } from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowLeft,
  ChevronDown,
  Image as ImageIcon,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { UnifiedTextConfig } from './rich-text-config';

const IMAGE_SIZE_OPTIONS = [
  { value: 'fill', label: 'Fill' },
  { value: 'fit', label: 'Fit' },
  { value: 'stretch', label: 'Stretch' },
] as const;

const CAPTION_ALIGN_OPTIONS = [
  { value: 'left', icon: AlignLeft },
  { value: 'center', icon: AlignCenter },
  { value: 'right', icon: AlignRight },
] as const;

export interface ImageControlsProps {
  config: UnifiedTextConfig;
  dropUp: boolean;
  showImageDropdown: boolean;
  onToggleImageDropdown: () => void;
  isReplacingImage: boolean;
  onCancelReplaceImage: () => void;
  imageTab: 'upload' | 'link';
  setImageTab: (tab: 'upload' | 'link') => void;
  imageLinkInput: string;
  setImageLinkInput: (value: string) => void;
  imageInputRef: RefObject<HTMLInputElement>;
  isUploadingImage: boolean;
  onImageLinkConfirm: () => void;
  onImageReload: () => void;
  onImageRemove: () => void;
  onImageSizeChange: (size: 'fill' | 'fit' | 'stretch') => void;
  onCaptionAlignChange: (align: 'left' | 'center' | 'right') => void;
}

// Image upload/link, size, and caption-alignment controls for the rich-text
// toolbar. Text formatting (bold, color, alignment, …) lives in the TipTap
// toolbar in text-element-unified.tsx.
export function ImageControls({
  config,
  dropUp,
  showImageDropdown,
  onToggleImageDropdown,
  isReplacingImage,
  onCancelReplaceImage,
  imageTab,
  setImageTab,
  imageLinkInput,
  setImageLinkInput,
  imageInputRef,
  isUploadingImage,
  onImageLinkConfirm,
  onImageReload,
  onImageRemove,
  onImageSizeChange,
  onCaptionAlignChange,
}: ImageControlsProps) {
  const dropdownStyle = dropUp
    ? { bottom: '100%', marginBottom: '6px' }
    : { top: '100%', marginTop: '6px' };
  const imageSize = config.imageSize || 'fill';
  const captionAlign = config.captionAlign || 'left';

  return (
    <>
      <span className="mx-1 h-5 w-px bg-gray-200" />
      <div className="relative">
        <Button
          type="button"
          size="sm"
          variant={showImageDropdown || config.imageUrl ? 'default' : 'ghost'}
          className="h-7 gap-0.5 px-1.5"
          onMouseDown={(event) => event.preventDefault()}
          onClick={onToggleImageDropdown}
          aria-label="Image"
          data-testid="rich-text-image"
        >
          <ImageIcon className="h-3.5 w-3.5" />
          <ChevronDown className="h-2.5 w-2.5" />
        </Button>

        {showImageDropdown && (
          <div
            className="absolute right-0 z-[10000] w-72 rounded-lg border bg-white shadow-xl"
            style={dropdownStyle}
          >
            {config.imageUrl && !isReplacingImage ? (
              <div className="flex flex-col gap-3 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex-1 truncate text-sm text-gray-500">
                    {config.imageName || 'image'}
                  </span>
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={onImageReload}
                    className="flex-shrink-0 rounded-lg border border-primary/30 bg-primary/5 p-2 text-primary transition-colors hover:bg-primary/10"
                    aria-label="Change image"
                    data-testid="rich-text-image-reload"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={onImageRemove}
                    className="flex-shrink-0 rounded-lg border border-gray-200 p-2 text-gray-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-500"
                    aria-label="Remove image"
                    data-testid="rich-text-image-remove"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="border-t border-gray-100" />

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Size</span>
                  <div className="inline-flex items-center rounded-full bg-gray-100 p-0.5">
                    {IMAGE_SIZE_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => onImageSizeChange(option.value)}
                        className={cn(
                          'rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors',
                          imageSize === option.value
                            ? 'bg-primary text-white'
                            : 'text-gray-500 hover:text-gray-700'
                        )}
                        data-testid={`rich-text-image-size-${option.value}`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Caption position</span>
                  <div className="inline-flex items-center rounded-lg bg-gray-100 p-0.5">
                    {CAPTION_ALIGN_OPTIONS.map(({ value, icon: Icon }) => (
                      <button
                        key={value}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => onCaptionAlignChange(value)}
                        className={cn(
                          'flex h-7 w-7 items-center justify-center rounded-lg transition-colors',
                          captionAlign === value
                            ? 'bg-primary text-white'
                            : 'text-gray-500 hover:text-gray-700'
                        )}
                        aria-label={`Align caption ${value}`}
                        data-testid={`rich-text-caption-align-${value}`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div>
                {config.imageUrl && isReplacingImage && (
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={onCancelReplaceImage}
                    className="flex w-full items-center gap-1.5 border-b border-gray-100 px-3 py-2 text-xs text-gray-500 transition-colors hover:text-gray-700"
                    data-testid="rich-text-image-cancel-replace"
                  >
                    <ArrowLeft className="h-3 w-3" />
                    Back
                  </button>
                )}
                <div className="flex border-b border-gray-100">
                  {(['upload', 'link'] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => setImageTab(tab)}
                      className={cn(
                        'flex-1 py-2 text-sm font-medium capitalize transition-colors',
                        imageTab === tab
                          ? 'border-b-2 border-primary text-primary'
                          : 'text-gray-500 hover:text-gray-700'
                      )}
                      data-testid={`rich-text-image-tab-${tab}`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
                <div className="p-3">
                  {imageTab === 'upload' ? (
                    <button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => imageInputRef.current?.click()}
                      disabled={isUploadingImage}
                      className="w-full rounded bg-primary px-4 py-2 text-sm font-semibold uppercase tracking-wide text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                      data-testid="rich-text-image-upload-btn"
                    >
                      {isUploadingImage ? 'Uploading…' : 'Upload image'}
                    </button>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <input
                        type="url"
                        value={imageLinkInput}
                        onChange={(event) => setImageLinkInput(event.target.value)}
                        onKeyDown={(event) => event.key === 'Enter' && onImageLinkConfirm()}
                        className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
                        placeholder="https://example.com/image.png"
                        data-testid="rich-text-image-link-input"
                      />
                      <button
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={onImageLinkConfirm}
                        disabled={!imageLinkInput.trim()}
                        className="w-full rounded bg-primary py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                        data-testid="rich-text-image-link-confirm"
                      >
                        Apply
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
