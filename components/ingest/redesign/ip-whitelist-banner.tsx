'use client';

import { useState, useCallback } from 'react';
import { Shield, Copy, Check } from 'lucide-react';
import { DALGO_IP_ADDRESSES } from '@/constants/warehouse';

// Copied-reset delay after clicking an IP chip (ms).
const COPIED_RESET_MS = 2000;

/**
 * Shows Dalgo's outbound IP addresses so users can whitelist them on a
 * firewalled warehouse. Used on the redesigned Ingest empty-warehouse screen.
 */
export function IpWhitelistBanner() {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopy = useCallback((ip: string, index: number) => {
    navigator.clipboard.writeText(ip);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), COPIED_RESET_MS);
  }, []);

  return (
    <div
      className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-left"
      data-testid="ip-whitelist-banner"
    >
      <div className="flex items-start gap-3">
        <Shield className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">
            Dalgo runs on the following IP addresses. Please whitelist these if your warehouse is
            behind a firewall:
          </p>
          <div className="flex flex-wrap gap-2">
            {DALGO_IP_ADDRESSES.map((ip, index) => (
              <button
                key={ip}
                onClick={() => handleCopy(ip, index)}
                className="inline-flex items-center gap-1.5 rounded-md bg-background border px-3 py-1.5 text-sm font-mono transition-colors hover:bg-muted cursor-pointer"
                data-testid={`ip-address-${index}`}
                title="Click to copy"
              >
                <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                {ip}
                {copiedIndex === index ? (
                  <Check className="h-3.5 w-3.5 text-primary ml-1" />
                ) : (
                  <Copy className="h-3.5 w-3.5 text-muted-foreground ml-1" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
