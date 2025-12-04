/**
 * Reusable page header component for list pages
 */

import { ReactNode } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export interface PageHeaderAction {
  /** Button label */
  label: string;
  /** Link destination (use href OR onClick, not both) */
  href?: string;
  /** Click handler (use href OR onClick, not both) */
  onClick?: () => void;
  /** Icon to display before label */
  icon?: ReactNode;
  /** Whether to show this action */
  visible?: boolean;
  /** Custom button variant */
  variant?: 'default' | 'ghost' | 'outline' | 'secondary' | 'destructive' | 'link';
  /** Whether button is disabled */
  disabled?: boolean;
}

export interface PageHeaderProps {
  /** Main title */
  title: string;
  /** Description text below title */
  description?: string;
  /** Primary action button configuration */
  action?: PageHeaderAction;
  /** Additional content to render (e.g., tooltips, secondary actions) */
  children?: ReactNode;
  /** ID prefix for elements */
  idPrefix?: string;
  /** Additional CSS classes for the container */
  className?: string;
}

/** Primary button color used across the app */
const PRIMARY_BUTTON_COLOR = '#06887b';

/**
 * Standardized page header component for list pages
 *
 * @example
 * ```tsx
 * <PageHeader
 *   title="Charts"
 *   description="Create And Manage Your Visualizations"
 *   action={{
 *     label: 'CREATE CHART',
 *     href: '/charts/new',
 *     icon: <Plus className="w-4 h-4" />,
 *     visible: hasPermission('can_create_charts'),
 *   }}
 * />
 *
 * // With children for custom elements
 * <PageHeader title="User Management" description="Manage users and invitations">
 *   <Tooltip>...</Tooltip>
 * </PageHeader>
 * ```
 */
export function PageHeader({
  title,
  description,
  action,
  children,
  idPrefix = 'page',
  className = '',
}: PageHeaderProps) {
  const showAction = action && action.visible !== false;

  const renderActionButton = () => {
    if (!action) return null;

    const buttonContent = (
      <>
        {action.icon && <span className="mr-2">{action.icon}</span>}
        {action.label}
      </>
    );

    const buttonProps = {
      id: `${idPrefix}-action-button`,
      variant: action.variant || ('ghost' as const),
      className: 'text-white hover:opacity-90 shadow-xs',
      style: { backgroundColor: PRIMARY_BUTTON_COLOR },
      disabled: action.disabled,
    };

    if (action.href) {
      return (
        <Link id={`${idPrefix}-action-link`} href={action.href}>
          <Button {...buttonProps}>{buttonContent}</Button>
        </Link>
      );
    }

    return (
      <Button {...buttonProps} onClick={action.onClick}>
        {buttonContent}
      </Button>
    );
  };

  return (
    <div id={`${idPrefix}-header`} className={`flex-shrink-0 border-b bg-background ${className}`}>
      <div
        id={`${idPrefix}-title-section`}
        className="flex items-center justify-between mb-6 p-6 pb-0"
      >
        <div id={`${idPrefix}-title-wrapper`}>
          <div className="flex items-center gap-2">
            <h1 id={`${idPrefix}-page-title`} className="text-3xl font-bold">
              {title}
            </h1>
            {children}
          </div>
          {description && (
            <p id={`${idPrefix}-page-description`} className="text-muted-foreground mt-1">
              {description}
            </p>
          )}
        </div>

        {showAction && renderActionButton()}
      </div>
    </div>
  );
}

export default PageHeader;
