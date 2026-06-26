'use client';

import { Link2 } from 'lucide-react';
import { DebouncedInput } from '@/components/charts/debounced-input';
import { isValidHttpUrl } from '@/lib/utils';

interface LinkTabContentProps {
  currentLogoUrl: string | null;
  linkInput: string;
  isEditingLink: boolean;
  onLinkChange: (value: string) => void;
}

export function LinkTabContent({
  currentLogoUrl,
  linkInput,
  isEditingLink,
  onLinkChange,
}: LinkTabContentProps) {
  return (
    <div className="flex flex-col gap-3">
      <div
        className="border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center"
        style={{ minHeight: '200px' }}
      >
        {isValidHttpUrl(linkInput.trim()) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={linkInput.trim()} alt="Logo preview" className="object-contain max-h-40 p-4" />
        ) : currentLogoUrl && !isEditingLink ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={currentLogoUrl} alt="Logo" className="object-contain max-h-40 p-4" />
        ) : (
          <div className="flex flex-col items-center gap-3 text-muted-foreground p-8">
            <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center">
              <Link2 className="h-6 w-6 opacity-50" />
            </div>
            <p className="text-sm text-center">Enter an image URL below</p>
          </div>
        )}
      </div>

      {currentLogoUrl && !linkInput.trim() && !isEditingLink ? (
        <p className="text-xs text-gray-500 truncate px-1">{currentLogoUrl}</p>
      ) : (
        <DebouncedInput
          id="branding-logo-url"
          data-testid="branding-logo-url-input"
          type="url"
          placeholder="https://example.com/logo.png"
          value={linkInput}
          onChange={onLinkChange}
          debounceMs={400}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md outline-none focus:border-primary transition-colors disabled:cursor-not-allowed disabled:opacity-60"
        />
      )}
    </div>
  );
}
