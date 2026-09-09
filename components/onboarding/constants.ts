// Content for the one-time resource-sharing introduction carousel.
// Copy mirrors the "We've changed how sharing works" Figma frames.

export const RESOURCE_SHARING_NOTICE_HEADING = "We've changed how sharing works";

export const RESOURCE_SHARING_NOTICE_SUBTITLE =
  'The granular controls are here. Share specific dashboards, charts and reports with the right people.';

export interface ResourceSharingRoleSummary {
  name: string;
  summary: string;
}

// Static role list shown on the left of every step.
export const RESOURCE_SHARING_ROLE_SUMMARIES: ResourceSharingRoleSummary[] = [
  { name: 'Admin', summary: 'Runs the organisation, managing people and settings.' },
  { name: 'Analyst', summary: 'Builds dashboards, charts and reports.' },
  { name: 'Member', summary: 'Works with the dashboards and reports shared with them' },
];

export interface ResourceSharingNoticeStep {
  role: string;
  /** Illustration shown on the right; lives in public/images/resource-sharing-notice/. */
  image: string;
  detail: string;
  /** Optional docs link shown below the detail text. Path is relative to NEXT_PUBLIC_DOCS_BASE_URL. */
  docLink?: { label: string; path: string };
}

// Per-step "what this means for you" detail + illustration. Order = carousel order.
export const RESOURCE_SHARING_NOTICE_STEPS: ResourceSharingNoticeStep[] = [
  {
    role: 'Admin',
    image: '/images/resource-sharing-notice/rs-admin.jpg',
    detail:
      'You now define the baseline access for every role in your organisation. As an Admin, you retain ultimate oversight allowing you to view, transfer or restrict any resource whenever governance is required.',
    docLink: {
      label: 'Read the full guide on Access',
      path: '/settings/access/',
    },
  },
  {
    role: 'Analyst',
    image: '/images/resource-sharing-notice/rs-analyst.jpg',
    detail:
      'You have complete control over who sees your work. Keep your dashboards private while you build them and only share them when they are ready. You can grant View or Edit access to specific people or groups, just remember that sharing a dashboard automatically shares the charts inside it.',
    docLink: {
      label: 'Read the full guide on Access',
      path: '/settings/access/',
    },
  },
  {
    role: 'Member',
    image: '/images/resource-sharing-notice/rs-member.jpg',
    detail:
      'You now have a focused view of the data that matters to you. Browse what has been shared with you, build your own charts, or easily request access to locked resources as needed.',
    docLink: {
      label: 'Read the full guide on Access',
      path: '/settings/access/',
    },
  },
];
