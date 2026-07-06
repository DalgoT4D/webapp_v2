// Content for the one-time RBAC v2 migration carousel.
// Copy mirrors the "Rbac spec A - migration notes" Figma frames.

export const RBAC_NOTICE_HEADING = "We've simplified how access works";

export const RBAC_NOTICE_SUBTITLE =
  'See what has changed for your role today, as we lay the foundation for more granular controls.';

export interface RbacRoleSummary {
  name: string;
  summary: string;
}

// Static role list shown on the left of every step.
export const RBAC_ROLE_SUMMARIES: RbacRoleSummary[] = [
  { name: 'Admin', summary: 'Runs the organisation, managing people and settings.' },
  { name: 'Analyst', summary: 'Builds dashboards, charts and reports.' },
  {
    name: 'Member',
    summary: 'Views the dashboards and reports shared with the organisation.',
  },
];

export interface RbacNoticeStep {
  role: string;
  /** Illustration shown on the right; lives in public/images/rbac-notice/. */
  image: string;
  detail: string;
}

// Per-step "what this means for you" detail + illustration. Order = carousel order.
export const RBAC_NOTICE_STEPS: RbacNoticeStep[] = [
  {
    role: 'Admin',
    image: '/images/rbac-notice/rbac-admin.jpg',
    detail:
      'Along with formally owning the dashboards, charts and reports you create. You also keep all your pipeline, transform and warehouse work, meaning only you or another admin can create, edit or delete them.',
  },
  {
    role: 'Analyst',
    image: '/images/rbac-notice/rbac-analyst.jpg',
    detail:
      'You keep building dashboards, charts and reports as before. Editing pipelines, transforms and the warehouse is now view-only — ask an admin if you need that access back.',
  },
  {
    role: 'Member',
    image: '/images/rbac-notice/rbac-member.jpg',
    detail:
      'Renamed from Guest, you now have a streamlined, view-only experience for the dashboards and reports shared with your organisation.',
  },
];
