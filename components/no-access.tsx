'use client';

import { Lock } from 'lucide-react';

export function NoAccess() {
  return (
    <div data-testid="no-access" className="h-full flex items-center justify-center bg-muted/30">
      <div className="text-center max-w-sm">
        <div className="mx-auto w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-6 h-6 text-destructive" aria-hidden="true" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Access Restricted</h2>
        <p className="text-muted-foreground">
          You don&apos;t have permission to view this page. Contact your org Admin to request
          access.
        </p>
      </div>
    </div>
  );
}
