export interface EmbedToken {
  id: string;
  token: string;
  dashboard_id: number;
  org_id: number;
  created_by: number;
  expires_at: string; // ISO date string
  revoked_at?: string; // ISO date string
  restrictions?: {
    ip_ranges?: string[];
    domains?: string[];
    max_views?: number;
  };
  created_at: string; // ISO date string
  last_accessed_at?: string; // ISO date string
  view_count: number;
  is_active: boolean; // computed: not expired and not revoked
  time_until_expiry?: string; // human readable like "5 days, 3 hours"
}

export interface CreateEmbedTokenRequest {
  dashboard_id: number;
  expires_in_days?: number; // Default 30 days
  restrictions?: {
    ip_ranges?: string[];
    domains?: string[];
    max_views?: number;
  };
}

export interface ExtendEmbedTokenRequest {
  extend_days: number; // Number of days to extend
}

export interface EmbedTokenUsage {
  token_id: string;
  accessed_at: string;
  ip_address?: string;
  user_agent?: string;
  referrer?: string;
}

export interface EmbedTokenStats {
  total_views: number;
  unique_ips: number;
  last_accessed: string;
  most_active_day: {
    date: string;
    views: number;
  };
}

export interface PrivateEmbedOptions {
  showTitle: boolean;
  showOrganization: boolean;
  theme: 'light' | 'dark';
  showPadding: boolean;
}

export interface ValidateTokenResponse {
  valid: boolean;
  dashboard?: {
    id: number;
    title: string;
    org_name: string;
    data: any;
  };
  error?: string;
  token_info?: {
    expires_at: string;
    view_count: number;
    restrictions?: EmbedToken['restrictions'];
  };
}
