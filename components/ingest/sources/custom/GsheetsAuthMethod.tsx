'use client';

import { useCallback, type MouseEvent, type ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import { GSHEETS_AUTH_METHOD_OAUTH, GSHEETS_AUTH_METHOD_SERVICE } from './constants';
import type { GsheetsAuthMethodValue } from './constants';

interface GsheetsAuthMethodProps {
  method: GsheetsAuthMethodValue;
  onMethodChange: (next: GsheetsAuthMethodValue) => void;
  disabled?: boolean;
  error?: string;
  /** Google sign-in button, or the connected confirmation once a sheet has been picked. */
  oauthSlot: ReactNode;
  /** Spreadsheet link + service-account key — the fields only this route needs. */
  serviceSlot: ReactNode;
}

/** One selectable card. The whole card is the hit area; a selected card ignores clicks so the
 *  inputs inside it keep working. Keyboard selection stays on the radio. */
function AuthOptionCard({
  value,
  id,
  selected,
  disabled,
  testId,
  title,
  description,
  badge,
  onSelect,
  children,
}: {
  value: string;
  id: string;
  selected: boolean;
  disabled?: boolean;
  testId: string;
  title: string;
  description: string;
  badge?: ReactNode;
  onSelect: () => void;
  children?: ReactNode;
}) {
  // Radix announces a checked change by dispatching a bubbling `click` on its hidden <input>.
  // Reacting to that would flip the selection back, then the other card would do the same —
  // ping-ponging into "Maximum update depth exceeded". RadioGroup already handles those clicks.
  const handleClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      const origin = event.target as HTMLElement | null;
      if (origin?.closest('[role="radio"], input[type="radio"]')) return;
      onSelect();
    },
    [onSelect]
  );

  return (
    <div
      onClick={selected || disabled ? undefined : handleClick}
      className={cn(
        'rounded-md border p-4 transition-colors',
        selected ? 'border-primary/40 bg-primary/5' : 'hover:bg-muted/40',
        !selected && !disabled && 'cursor-pointer'
      )}
      data-testid={testId}
    >
      <div className="flex items-start gap-3">
        <RadioGroupItem
          value={value}
          id={id}
          disabled={disabled}
          data-testid={`${testId}-radio`}
          className="mt-1"
        />
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex items-center gap-2">
            <Label htmlFor={id} className="cursor-pointer font-medium">
              {title}
            </Label>
            {badge}
          </div>
          <p className="text-sm text-muted-foreground">{description}</p>
          {selected && children}
        </div>
      </div>
    </div>
  );
}

/**
 * How a Google Sheets source authenticates: Google sign-in (default) or a service-account key.
 * A choice rather than two always-mounted inputs because the routes need different fields — each
 * card owns its own. GoogleSheetsForm maps the selection onto `credentials.auth_type`.
 */
export function GsheetsAuthMethod({
  method,
  onMethodChange,
  disabled,
  error,
  oauthSlot,
  serviceSlot,
}: GsheetsAuthMethodProps) {
  return (
    <div className="space-y-3" data-testid="gsheets-auth-method">
      <Label>
        Authentication <span className="text-destructive">*</span>
      </Label>

      <RadioGroup
        value={method}
        onValueChange={(next) => onMethodChange(next as GsheetsAuthMethodValue)}
        disabled={disabled}
        className="gap-3"
      >
        <AuthOptionCard
          value={GSHEETS_AUTH_METHOD_OAUTH}
          id="gsheets-auth-oauth"
          selected={method === GSHEETS_AUTH_METHOD_OAUTH}
          disabled={disabled}
          testId="gsheets-oauth-option"
          title="Sign in with Google"
          description="Choose your sheet in Google's own window. Dalgo gets access to just that one file — nothing else in your Drive."
          onSelect={() => onMethodChange(GSHEETS_AUTH_METHOD_OAUTH)}
          badge={
            <Badge variant="secondary" className="bg-primary/10 text-primary">
              Recommended
            </Badge>
          }
        >
          {oauthSlot}
        </AuthOptionCard>

        <AuthOptionCard
          value={GSHEETS_AUTH_METHOD_SERVICE}
          id="gsheets-auth-service"
          selected={method === GSHEETS_AUTH_METHOD_SERVICE}
          disabled={disabled}
          testId="gsheets-service-option"
          title="Use a service-account key"
          description="Paste your own Google service-account key, and share the spreadsheet with that key's client_email address."
          onSelect={() => onMethodChange(GSHEETS_AUTH_METHOD_SERVICE)}
        >
          {serviceSlot}
        </AuthOptionCard>
      </RadioGroup>

      {error && (
        <p className="text-xs text-destructive" data-testid="gsheets-auth-error">
          {error}
        </p>
      )}
    </div>
  );
}
