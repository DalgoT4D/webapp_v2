export interface UserLandingPreference {
  user_id: number;
  org_slug: string;
  dashboard_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface OrgLandingSettings {
  default_dashboard_id: number | null;
}

export interface LandingPageState {
  userPreference: UserLandingPreference | null;
  orgDefault: number | null;
  isLoading: boolean;
  error?: string;
}

export interface LandingPageResolution {
  dashboardId: number | null;
  source: 'user' | 'org' | 'none';
  fallbackApplied?: boolean;
}
