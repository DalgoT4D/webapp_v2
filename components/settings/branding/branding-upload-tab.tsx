'use client';

import { ImageIcon } from 'lucide-react';

interface UploadTabContentProps {
  currentLogoUrl: string | null;
  selectedFile: File | null;
  uploadPreviewUrl: string | null;
  logoFilename: string | null | undefined;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onFileInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
}

export function UploadTabContent({
  currentLogoUrl,
  selectedFile,
  uploadPreviewUrl,
  logoFilename,
  fileInputRef,
  onFileInputChange,
  onDrop,
  onDragOver,
}: UploadTabContentProps) {
  return (
    <>
      {currentLogoUrl && !selectedFile ? (
        <>
          <div
            className="border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center"
            style={{ minHeight: '200px' }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={currentLogoUrl} alt="Current logo" className="object-contain max-h-40 p-4" />
          </div>
          {logoFilename && (
            <p className="text-xs text-gray-500 truncate px-1 mt-2">{logoFilename}</p>
          )}
        </>
      ) : (
        <div
          data-testid="branding-dropzone"
          onClick={() => fileInputRef.current?.click()}
          onDrop={onDrop}
          onDragOver={onDragOver}
          className="border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-gray-50 transition-colors"
          style={{ minHeight: '200px' }}
        >
          {selectedFile && uploadPreviewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={uploadPreviewUrl}
              alt="Logo preview"
              className="object-contain max-h-40 p-4"
            />
          ) : (
            <div className="flex flex-col items-center gap-2 text-muted-foreground p-8">
              <ImageIcon className="h-10 w-10 opacity-40" />
              <p className="text-sm text-center">
                Drag and drop your logo here, or click to browse
              </p>
              <p className="text-xs">PNG, JPG, WEBP up to 5MB</p>
            </div>
          )}
        </div>
      )}
      <input
        ref={fileInputRef}
        id="branding-file-input"
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={onFileInputChange}
        data-testid="branding-file-input"
      />
    </>
  );
}
