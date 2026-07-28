'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { getAvatarColor, getInitials } from '@/lib/avatar';
import { cn } from '@/lib/utils';

interface UserAvatarProps {
  /** Email used to derive initials, color and the tooltip label. */
  email: string;
  /** Optional display name shown above the email in the tooltip. */
  name?: string;
  /** Show the email on hover. Defaults to true (off where email is already visible, e.g. comments). */
  showTooltip?: boolean;
  /** Applied to the Avatar root — controls size (default h-6 w-6 text-xs). */
  className?: string;
  /** Extra testid suffix, e.g. `user-avatar-${id}`. */
  'data-testid'?: string;
}

/**
 * Round initials avatar with email-on-hover. Replaces the gray User-icon
 * placeholder used in list "Created by" columns, and the inline avatar in
 * comment threads. One source of truth for color + initials.
 */
export function UserAvatar({
  email,
  name,
  showTooltip = true,
  className,
  'data-testid': dataTestId,
}: UserAvatarProps) {
  const safeEmail = email || '';

  const avatar = (
    <Avatar
      className={cn('h-6 w-6 text-xs flex-shrink-0', className)}
      data-testid={dataTestId}
      aria-label={safeEmail || 'Unknown user'}
    >
      <AvatarFallback
        style={{ backgroundColor: getAvatarColor(safeEmail) }}
        className="text-white font-medium"
      >
        {getInitials(safeEmail)}
      </AvatarFallback>
    </Avatar>
  );

  if (!showTooltip || !safeEmail) return avatar;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="inline-flex items-center align-middle outline-none">
          {avatar}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">
        {name && <p className="text-sm font-medium">{name}</p>}
        <p className="text-xs">{safeEmail}</p>
      </TooltipContent>
    </Tooltip>
  );
}
