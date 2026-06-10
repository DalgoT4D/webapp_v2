'use client';

import { useCallback, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PoweredByDalgoImage } from '@/components/ui/powered-by-dalgo-image';

const PREVIEW_SLIDES = 3;

const PREVIEW_TYPES: Array<{ label: string; pageLabel: string }> = [
  { label: 'Dashboard', pageLabel: 'DASHBOARD' },
  { label: 'Reports', pageLabel: 'REPORTS' },
  { label: 'Public Links', pageLabel: 'CHARTS' },
];

function PreviewTopBar({
  logoUrl,
  pageLabel,
  showPoweredBy = false,
}: {
  logoUrl: string | null;
  pageLabel: string;
  showPoweredBy?: boolean;
}) {
  return (
    <div className="bg-white rounded border-b px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt="Org logo"
            className="object-contain max-h-10 w-auto max-w-[120px]"
          />
        ) : (
          <div className="h-7 w-20 border-2 border-dashed border-gray-300 rounded flex items-center justify-center">
            <span className="text-[11px] text-black/70">logo</span>
          </div>
        )}
        <span className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          {pageLabel}
        </span>
      </div>
      {showPoweredBy && <PoweredByDalgoImage />}
    </div>
  );
}

function PreviewSlide({
  logoUrl,
  pageLabel,
  showPoweredBy = false,
}: {
  logoUrl: string | null;
  pageLabel: string;
  showPoweredBy?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 flex-1">
      <PreviewTopBar logoUrl={logoUrl} pageLabel={pageLabel} showPoweredBy={showPoweredBy} />
      <div className="grid grid-cols-2 gap-3 mt-auto">
        <div
          className="rounded overflow-hidden h-[100px] flex items-end justify-center"
          style={{ backgroundColor: '#eaefec' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/branding/bar_chart_preview.png"
            alt="Bar chart preview"
            className="h-[40px] w-auto object-contain"
          />
        </div>
        <div
          className="rounded overflow-hidden h-[100px] flex items-end justify-center"
          style={{ backgroundColor: '#eaefec' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/branding/pie-chart-preview.png"
            alt="Pie chart preview"
            className="h-[40px] w-auto object-contain"
          />
        </div>
      </div>
    </div>
  );
}

export function BrandingPreview({ logoUrl }: { logoUrl: string | null }) {
  const [slide, setSlide] = useState(0);

  const prev = useCallback(() => setSlide((s) => (s - 1 + PREVIEW_SLIDES) % PREVIEW_SLIDES), []);
  const next = useCallback(() => setSlide((s) => (s + 1) % PREVIEW_SLIDES), []);

  return (
    <div className="flex flex-col h-full rounded-lg w-full">
      <div className="flex-1 bg-[#f1f5f9] p-3 pb-0 rounded-md overflow-hidden flex flex-col">
        <div className="py-2 text-xs text-muted-foreground font-medium mb-4">
          Preview: {PREVIEW_TYPES[slide].label} ({slide + 1}/{PREVIEW_SLIDES})
        </div>
        <div className="flex-1 p-4 pb-0 flex flex-col gap-3 bg-white">
          <PreviewSlide
            logoUrl={logoUrl}
            pageLabel={PREVIEW_TYPES[slide].pageLabel}
            showPoweredBy={slide === PREVIEW_SLIDES - 1}
          />
        </div>
      </div>
      <div className="flex items-center justify-center gap-2 px-4 py-2 bg-white">
        <button
          aria-label="Previous preview"
          data-testid="branding-preview-prev"
          onClick={prev}
          className="p-1 rounded hover:bg-gray-100 text-muted-foreground transition-colors"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <button
          aria-label="Next preview"
          data-testid="branding-preview-next"
          onClick={next}
          className="p-1 rounded hover:bg-gray-100 text-muted-foreground transition-colors"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
}
