'use client';

import { useDashboardBranding } from '@/hooks/api/useDashboardBranding';

interface DashboardLogoProps {
  /** When in public mode, pass branding data directly instead of fetching */
  logoUrl?: string | null;
  logoWidth?: number;
}

/**
 * Renders the org-level dashboard logo in the top-left corner.
 * Collapses cleanly when no logo URL is set.
 */
export function DashboardLogo({
  logoUrl: propLogoUrl,
  logoWidth: propLogoWidth,
}: DashboardLogoProps) {
  const { branding } = useDashboardBranding();

  const logoUrl = propLogoUrl ?? branding?.dashboard_logo_url;
  const logoWidth = propLogoWidth ?? branding?.dashboard_logo_width ?? 80;

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
