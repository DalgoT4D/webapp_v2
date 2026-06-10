import { cn } from '@/lib/utils';

interface OrgBrandProps {
  logoUrl?: string | null;
  name?: string | null;
  logoClassName?: string;
  nameClassName?: string;
  className?: string;
}

/**
 * Shows the org logo if available, otherwise falls back to the org name as text.
 * Renders nothing if neither is provided.
 */
export function OrgBrand({
  logoUrl,
  name,
  logoClassName,
  nameClassName,
  className,
}: OrgBrandProps) {
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt={name ?? 'Organization logo'}
        className={cn('w-auto object-contain max-h-12 max-w-[180px] flex-shrink-0', logoClassName)}
      />
    );
  }

  if (name) {
    return <span className={cn('text-xl font-semibold text-gray-800', nameClassName)}>{name}</span>;
  }

  return null;
}
