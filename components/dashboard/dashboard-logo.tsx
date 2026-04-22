'use client';

import { type OrgBranding, useDashboardBranding } from '@/hooks/api/useDashboardBranding';

interface DashboardLogoProps {
  /** When in public mode, pass branding data directly instead of fetching */
  branding?: OrgBranding | null;
}

/**
 * Renders the org-level dashboard logo in the top-left corner.
 * Collapses cleanly when no logo URL is set.
 */
export function DashboardLogo({ branding: brandingOverride }: DashboardLogoProps) {
  const { branding } = useDashboardBranding({
    enabled: brandingOverride === undefined,
    initialBranding: brandingOverride,
  });

  const logoUrl = branding?.dashboard_logo_url;
  const logoWidth = branding?.dashboard_logo_width ?? 80;

  if (!logoUrl) return null;

  return (
    <div className="flex-shrink-0" data-testid="dashboard-logo">
      <img
        src={logoUrl}
        alt="Organization logo"
        style={{ width: `${logoWidth}px`, height: 'auto' }}
        onError={(e) => {
          // Hide broken image
          (e.target as HTMLImageElement).style.display = 'none';
        }}
      />
    </div>
  );
}
