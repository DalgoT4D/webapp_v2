import { cn } from '@/lib/utils';

// Deterministic avatar backgrounds — hashing the seed keeps a given email's
// color stable.
const AVATAR_BG_CLASSES = [
  'bg-teal-600',
  'bg-blue-600',
  'bg-amber-500',
  'bg-violet-600',
  'bg-rose-500',
];

function avatarBgClass(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) % AVATAR_BG_CLASSES.length;
  }
  return AVATAR_BG_CLASSES[hash];
}

interface AvatarInitialProps {
  /** Text (usually an email) whose first character becomes the initial */
  seed: string;
  className?: string;
}

/** A small circle showing the uppercased first letter of `seed`. Decorative —
 * always pair it with visible text or an aria-label on the parent. */
export function AvatarInitial({ seed, className }: AvatarInitialProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium text-white',
        avatarBgClass(seed),
        className
      )}
    >
      {seed.charAt(0).toUpperCase()}
    </span>
  );
}

interface CreatedByCellProps {
  /** The creator/inviter email; null or undefined renders a dash */
  email: string | null | undefined;
}

/** "Created By" table-cell content: avatar initial + muted email, or a dash. */
export function CreatedByCell({ email }: CreatedByCellProps) {
  if (!email) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  return (
    <div className="flex items-center gap-2">
      <AvatarInitial seed={email} />
      <span className="text-sm text-muted-foreground">{email}</span>
    </div>
  );
}
