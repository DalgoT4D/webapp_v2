// Presentation constants for the free-trial screens. The cross-feature contract
// (storage keys, step labels, API paths) lives in constants/trial.ts — this file
// holds only what the trial UI renders, so lucide icons and marketing copy never
// leak into a module the authenticated app header imports.

export interface TrialMarketingPanelConfig {
  imageSrc: string;
  imageAlt: string;
  headline: string;
  subline: string;
  /** 0-based lit dot in the 3-dot carousel indicator; null renders no dots. */
  activeDot: number | null;
  /**
   * `top`: headline+subline sit above the screenshot, left-aligned (Figma 2452:179 signup).
   * `bottom`: screenshot sits above the subline, centered (Figma 2452:416 provisioning).
   */
  textPosition: 'top' | 'bottom';
}

export const TRIAL_PANEL_DOT_COUNT = 3;

// Right-hand marketing panel content, one entry per screen. Looked up at the call
// site rather than drilled through props so TrialSplitCard stays content-agnostic.
export const TRIAL_MARKETING_PANELS = {
  signup: {
    imageSrc: '/branding/trial-signup-preview.png',
    imageAlt: 'A preview of Dalgo charts built from sample programme data',
    headline: 'Turn your programme data into proof of impact.',
    subline:
      'Full access for 14 days. Your workspace lands pre-loaded with sample NGO data so you can build something real in minutes.',
    activeDot: null,
    textPosition: 'top',
  },
  provisioning: {
    // TODO: placeholder. Swap for the Figma export of node 2452:222 (the Dashboards
    // screenshot) once design hands over the asset — ideally WebP alongside the PNG.
    imageSrc: '/branding/bar_chart_preview.png',
    imageAlt: 'A preview of Dalgo charts built from sample programme data',
    headline: '',
    subline:
      "Dalgo brings all your NGO's scattered data into one unified view. You are moments away from leaving manual spreadsheets behind and tracking your true impact.",
    activeDot: null,
    textPosition: 'bottom',
  },
} as const satisfies Record<string, TrialMarketingPanelConfig>;

// Target for the "Contact support" link on the failed-setup screen (Figma 2453:3089).
// Design didn't specify one — a mailto is the safe default until they do.
export const TRIAL_SUPPORT_EMAIL = 'support@dalgo.org';

// Mirrors Django's MinimumLengthValidator, which runs server-side on activate.
export const TRIAL_PASSWORD_MIN_LENGTH = 8;

// A subset of Django's CommonPasswordValidator list, standing in for the ~20k-entry
// file we don't want to ship to the browser. Deliberately filtered to entries that
// would otherwise PASS our other two rules — anything shorter than
// TRIAL_PASSWORD_MIN_LENGTH or entirely numeric is already rejected, so listing it
// here would be dead weight. Entries are lowercase; lookups lowercase the input.
//
// This cannot be exhaustive. A password in Django's full list but absent here still
// returns a 400 the client cannot tell apart from an expired link — which is why the
// activate wizard's 400 handler names BOTH causes and offers both escape routes.
export const TRIAL_COMMON_PASSWORDS: ReadonlySet<string> = new Set([
  'password',
  'password1',
  'password12',
  'password123',
  'passw0rd',
  'p@ssword',
  'p@ssw0rd',
  'iloveyou',
  'princess',
  'rockyou',
  'abc123456',
  'daniel11',
  'babygirl',
  'monkey12',
  'lovely12',
  'jessica1',
  'michael1',
  'sunshine',
  'chocolate',
  'anthony1',
  'friends1',
  'butterfly',
  'purple11',
  'jordan23',
  'liverpool',
  'football',
  'basketball',
  'baseball',
  'superman',
  'batman12',
  'trustno1',
  'thomas11',
  'robert11',
  'jennifer',
  'michelle',
  'charlie1',
  'samantha',
  'whatever',
  'nicole11',
  'hannah11',
  'computer',
  'jonathan',
  'starwars',
  'qwertyui',
  'qwertyuiop',
  'qwerty123',
  'asdfghjkl',
  'zxcvbnm1',
  '1q2w3e4r',
  '1qaz2wsx',
  'qazwsxedc',
  'welcome1',
  'welcome123',
  'letmein1',
  'letmein123',
  'iloveyou1',
  'sunshine1',
  'princess1',
  'football1',
  'baseball1',
  'superman1',
  'shadow11',
  'master12',
  'freedom1',
  'whatever1',
  'internet',
  'security',
  'december',
  'november',
  'september',
  'business',
  'training',
  'engineer',
  'scorpion',
  'midnight',
  'sunflower',
  'strawberry',
  'blessing',
  'precious',
  'darkness',
  'diamond1',
  'cocacola',
  'pokemon1',
  'mercedes',
  'ferrari1',
  'harley12',
  'corvette',
  'cameron1',
  'matthew1',
  'patrick1',
  'brandon1',
  'joshua11',
  'gateway1',
  'marlboro',
  'metallica',
  'nirvana1',
  'slipknot',
  'greenday',
  'eminem12',
  'rangers1',
  'chelsea1',
  'arsenal1',
  'cricket1',
  'dolphins',
  'redskins',
  'steelers',
  'cowboys1',
  'yankees1',
  'lakers12',
  'hello123',
  'admin123',
  'root1234',
  'test1234',
  'guest123',
  'changeme',
  'default1',
  'temppass',
  'newpass1',
  'mypassword',
  'secret12',
  'access14',
  'dragon12',
  'flower12',
  'summer12',
  'winter12',
  'spring12',
  'orange12',
  'purple12',
  'silver12',
  'golden12',
]);
