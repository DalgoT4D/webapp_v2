'use client';

import { AlertTriangle, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { GeneralAccessState } from '@/hooks/api/useAccess';

interface PublicLinkSectionProps {
  generalAccess: GeneralAccessState;
  entityLabelLower: string;
  onCopyPublicUrl: () => void;
}

/** Shown while the resource is public: security notice, COPY PUBLIC LINK, public access stats. */
export function PublicLinkSection({
  generalAccess,
  entityLabelLower,
  onCopyPublicUrl,
}: PublicLinkSectionProps) {
  return (
    <>
      {/* PINNED-BUGS: "Public security notice uses lowercased title instead of "report"" — entityLabelLower is the resource title */}
      <div
        className="mt-3 flex items-start gap-2 rounded-md border border-orange-200 bg-orange-50 p-3"
        data-testid="public-security-notice"
      >
        <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
        <div className="text-xs text-orange-800">
          <strong>Security Notice:</strong> Your data is now exposed to the internet. Anyone with
          this link can access your {entityLabelLower} data without authentication.
        </div>
      </div>

      {generalAccess.public_url && (
        <Button
          variant="outline"
          onClick={onCopyPublicUrl}
          className="mt-3 w-full"
          data-testid="copy-link-btn"
        >
          <Copy className="h-4 w-4 mr-2" />
          COPY PUBLIC LINK
        </Button>
      )}

      {generalAccess.public_access_count > 0 && (
        <div className="mt-2 text-xs text-muted-foreground" data-testid="public-access-stats">
          <p data-testid="public-access-count">
            Public access count: {generalAccess.public_access_count}
          </p>
          {generalAccess.last_public_accessed && (
            <p data-testid="public-last-accessed">
              Last accessed: {new Date(generalAccess.last_public_accessed).toLocaleString()}
            </p>
          )}
        </div>
      )}
    </>
  );
}
