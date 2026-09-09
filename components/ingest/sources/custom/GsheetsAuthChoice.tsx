'use client';

import { useCallback, useState, type MouseEvent, type ReactNode } from 'react';
import { Check, Copy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';

// How long the copy button shows its "copied" tick before reverting.
const COPIED_RESET_MS = 2000;

// Radio values for the two auth routes. Both end up on the connector's Service branch; they differ
// only in whose key fills it — see GoogleSheetsForm.
const AUTH_MANAGED = 'managed';
const AUTH_OWN = 'own';

interface GsheetsAuthChoiceProps {
  /** `client_email` of the Dalgo-managed service account. */
  email: string;
  useManagedKey: boolean;
  onUseManagedKeyChange: (next: boolean) => void;
  /** Whether the form currently holds a service-account key. */
  hasKey: boolean;
  /** Whether the user has touched the key field since it was loaded (edit only). */
  keyEdited: boolean;
  mode: 'create' | 'edit';
  disabled?: boolean;
  error?: string;
  /** The spec-driven service-account JSON field. */
  keyField: ReactNode;
}

/** The address to share the spreadsheet with, as a click-to-copy chip. */
function EmailChip({ email }: { email: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(email);
    setCopied(true);
    setTimeout(() => setCopied(false), COPIED_RESET_MS);
  }, [email]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      data-testid="gsheets-managed-email"
      title="Click to copy"
      className="inline-flex max-w-full items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm font-mono transition-colors hover:bg-muted cursor-pointer"
    >
      <span className="truncate">{email}</span>
      {copied ? (
        <Check className="h-3.5 w-3.5 flex-shrink-0 text-primary" />
      ) : (
        <Copy className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
      )}
    </button>
  );
}

/** The four steps that grant the service account access, plus the address they apply to. */
function ShareSteps({ email, testId }: { email: string; testId: string }) {
  return (
    <div className="space-y-3" data-testid={testId}>
      <EmailChip email={email} />
      <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
        <li>Open your spreadsheet in Google Sheets</li>
        <li>
          Click <span className="font-medium text-foreground">Share</span> (top right)
        </li>
        <li>Paste the address above and set the role to Viewer</li>
        <li>Untick &ldquo;Notify people&rdquo;, then click Share</li>
      </ol>
    </div>
  );
}

/**
 * One selectable card. The whole card is the hit area, not just the label — clicking anywhere in an
 * unselected card picks it. Selected cards ignore clicks so the detail inside them (the copy chip,
 * the key field) keeps working normally. Keyboard selection stays on the radio itself.
 */
function AuthOptionCard({
  value,
  id,
  selected,
  disabled,
  testId,
  title,
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
  badge?: ReactNode;
  onSelect: () => void;
  children?: ReactNode;
}) {
  // Radix mirrors each radio's checked state onto a hidden <input> and announces the change by
  // dispatching a bubbling `click` on it. That synthetic click reaches this card too, so reacting to
  // it would flip the selection right back — and then the other card's input would fire its own,
  // ping-ponging until React bails with "Maximum update depth exceeded". Clicks that come from the
  // radio control itself are already handled by RadioGroup, so ignore them here.
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
          {/* Only the selected card carries detail — the other stays a one-line choice. */}
          {selected && children}
        </div>
      </div>
    </div>
  );
}

/**
 * MANAGED-SA bridge — Google Sheets auth while OAuth verification is pending. Two radio options:
 * Dalgo's key (default, with the sharing steps inline) or your own (the spec-driven key field
 * renders inside that card).
 *
 * Which key a saved source uses is NOT recorded anywhere: both options store a
 * `service_account_info` that Airbyte returns masked, so on edit this cannot tell them apart. It
 * therefore drops the choice while a saved key is present and states the sharing requirement
 * conditionally instead of guessing. Clearing the field brings the choice back.
 *
 * Delete with the bridge.
 */
export function GsheetsAuthChoice({
  email,
  useManagedKey,
  onUseManagedKeyChange,
  hasKey,
  keyEdited,
  mode,
  disabled,
  error,
  keyField,
}: GsheetsAuthChoiceProps) {
  // Edit keeps the choice out of sight while the source's *saved* key sits untouched — offering it
  // there would imply we know whose key it is. Once the user edits the field (clears it, pastes
  // their own), whose key it is stops being a guess, so the choice comes back. Create always
  // shows it.
  const showChoice = mode === 'create' || !hasKey || keyEdited;
  // The untouched saved key on an edit: say what sharing it needs without claiming which key.
  const showSavedKeyNote = mode === 'edit' && hasKey && !keyEdited && !useManagedKey;

  return (
    <div className="space-y-3" data-testid="gsheets-auth-choice">
      <Label>
        Authentication <span className="text-destructive">*</span>
      </Label>

      {showChoice ? (
        <RadioGroup
          value={useManagedKey ? AUTH_MANAGED : AUTH_OWN}
          onValueChange={(next) => onUseManagedKeyChange(next === AUTH_MANAGED)}
          disabled={disabled}
          className="gap-3"
        >
          <AuthOptionCard
            value={AUTH_MANAGED}
            id="gsheets-auth-managed"
            selected={useManagedKey}
            disabled={disabled}
            testId="gsheets-managed-option"
            title="Use Dalgo's service account"
            onSelect={() => onUseManagedKeyChange(true)}
            badge={
              <Badge variant="secondary" className="bg-primary/10 text-primary">
                Recommended
              </Badge>
            }
          >
            <p className="text-sm text-muted-foreground">
              Share your spreadsheet with the address below — Dalgo can then read that sheet, and
              nothing else in your Drive.
            </p>
            <ShareSteps email={email} testId="gsheets-managed-steps" />
          </AuthOptionCard>

          <AuthOptionCard
            value={AUTH_OWN}
            id="gsheets-auth-own"
            selected={!useManagedKey}
            disabled={disabled}
            testId="gsheets-own-option"
            title="Use my own service-account key"
            onSelect={() => onUseManagedKeyChange(false)}
          >
            <div data-testid="gsheets-key-field">{keyField}</div>
          </AuthOptionCard>
        </RadioGroup>
      ) : (
        <div data-testid="gsheets-key-field">{keyField}</div>
      )}

      {showSavedKeyNote && (
        <div
          className="space-y-3 rounded-md border border-primary/40 bg-primary/5 p-4"
          data-testid="gsheets-saved-key-note"
        >
          <div className="space-y-2 text-sm">
            <p className="font-medium text-foreground">
              This source already has a service-account key saved.
            </p>
            <p>
              If you are using Dalgo&apos;s service account rather than your own key, share your
              spreadsheet with this address:
            </p>
          </div>
          <ShareSteps email={email} testId="gsheets-saved-key-steps" />
          {/* After the steps, not before them: it's the alternative to doing them.
              The field is named rather than called "the field above" — on a form this long,
              "above" isn't obvious. */}
          <p className="text-sm">
            To change how this source authenticates, clear the{' '}
            <span className="font-medium text-foreground">Service Account Information</span> field
            above — the &ldquo;Use Dalgo&apos;s service account&rdquo; choice comes back, and you
            can either select it or paste a different key.
          </p>
        </div>
      )}

      {error && (
        <p className="text-xs text-destructive" data-testid="gsheets-auth-error">
          {error}
        </p>
      )}
    </div>
  );
}
