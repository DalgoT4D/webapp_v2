/**
 * Reusable error state component for data loading failures
 */

import { ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface ErrorStateProps {
  /** Error message to display */
  title?: string;
  /** Detailed description (optional) */
  description?: string;
  /** Callback for retry button */
  onRetry?: () => void;
  /** Custom icon (defaults to AlertCircle) */
  icon?: ReactNode;
  /** Text for retry button */
  retryText?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Standardized error state component for data loading failures
 *
 * @example
 * ```tsx
 * if (isError) {
 *   return <ErrorState title="Failed to load charts" onRetry={mutate} />;
 * }
 *
 * // With custom icon
 * <ErrorState
 *   title="Failed to load dashboards"
 *   icon={<LayoutDashboard className="w-12 h-12 text-destructive" />}
 *   onRetry={() => window.location.reload()}
 * />
 * ```
 */
export function ErrorState({
  title = 'Failed to load data',
  description,
  onRetry,
  icon,
  retryText = 'Retry',
  className = '',
}: ErrorStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center h-64 gap-4 ${className}`}
      role="alert"
      aria-live="polite"
    >
      {icon || <AlertCircle className="w-12 h-12 text-destructive" />}
      <div className="text-center">
        <p className="text-muted-foreground font-medium">{title}</p>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      {onRetry && (
        <Button variant="outline" onClick={onRetry}>
          {retryText}
        </Button>
      )}
    </div>
  );
}

export default ErrorState;
