/**
 * AlertsPage — the `?alertId=` deep-link (Task 13's notification link,
 * Task 16 carry-over). A 403 on the resource-access check for the deep-link
 * target renders <RequestAccessScreen> in place of the whole page; a
 * successful check passes `highlightAlertId` through to <AlertsTable> so
 * the matching row gets highlighted.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import AlertsPage from '../page';
import { useAlerts } from '@/hooks/api/useAlerts';
import { useResourceAccess } from '@/hooks/api/useResourceAccess';
import { useRbac } from '@/lib/rbac';

let mockSearchParams = new URLSearchParams();
jest.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
}));
jest.mock('@/hooks/api/useAlerts', () => ({
  useAlerts: jest.fn(),
  toggleAlert: jest.fn(),
  deleteAlert: jest.fn(),
}));
jest.mock('@/hooks/api/useResourceAccess');
jest.mock('@/lib/rbac', () => ({ ...jest.requireActual('@/lib/rbac'), useRbac: jest.fn() }));
jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn() }));
jest.mock('@/components/alerts/AlertWizardModal', () => ({
  AlertWizardModal: (): null => null,
}));
jest.mock('@/components/alerts/AlertLogModal', () => ({
  AlertLogModal: (): null => null,
}));
jest.mock('@/components/alerts/AlertsTable', () => ({
  AlertsTable: ({ highlightAlertId }: any) => (
    <div data-testid="stub-alerts-table">highlight:{String(highlightAlertId)}</div>
  ),
  AllAlertsEmptyState: (): null => null,
}));
jest.mock('@/components/sharing/request-access-screen', () => ({
  RequestAccessScreen: ({ rtype, resourceId, resourceLabel }: any) => (
    <div data-testid="stub-request-access-screen">
      {rtype}:{resourceId}:{resourceLabel}
    </div>
  ),
}));

const mockUseAlerts = useAlerts as jest.Mock;
const mockUseResourceAccess = useResourceAccess as jest.Mock;
const mockUseRbac = useRbac as jest.Mock;

function setup({
  searchParams = new URLSearchParams(),
  resourceAccessError,
}: {
  searchParams?: URLSearchParams;
  resourceAccessError?: unknown;
} = {}) {
  mockSearchParams = searchParams;
  mockUseRbac.mockReturnValue({
    hasPermission: () => true,
    role: 'admin',
    isLoaded: true,
    hasRole: () => true,
    hasAnyPermission: () => true,
    hasAllPermissions: () => true,
  });
  mockUseAlerts.mockReturnValue({
    data: [],
    total: 0,
    totalPages: 1,
    isLoading: false,
    isError: undefined,
    mutate: jest.fn(),
  });
  mockUseResourceAccess.mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: resourceAccessError,
    mutate: jest.fn(),
  });
}

describe('AlertsPage — alertId deep-link', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders the normal alerts list when there is no alertId param', () => {
    setup();

    render(<AlertsPage />);

    expect(screen.getByTestId('stub-alerts-table')).toHaveTextContent('highlight:null');
    expect(screen.queryByTestId('stub-request-access-screen')).not.toBeInTheDocument();
    // No alertId means no resource-access lookup at all.
    expect(mockUseResourceAccess).toHaveBeenCalledWith(null, null);
  });

  it('renders RequestAccessScreen when the alertId resource-access check 403s', () => {
    const apiError = Object.assign(new Error('You do not have access to this alert'), {
      status: 403,
    });
    setup({
      searchParams: new URLSearchParams('alertId=9'),
      resourceAccessError: apiError,
    });

    render(<AlertsPage />);

    expect(screen.getByTestId('stub-request-access-screen')).toHaveTextContent('alert:9:alert');
    expect(screen.queryByTestId('stub-alerts-table')).not.toBeInTheDocument();
  });

  it('passes alertId through to AlertsTable as highlightAlertId when access is fine', () => {
    setup({ searchParams: new URLSearchParams('alertId=9') });

    render(<AlertsPage />);

    expect(screen.getByTestId('stub-alerts-table')).toHaveTextContent('highlight:9');
    expect(screen.queryByTestId('stub-request-access-screen')).not.toBeInTheDocument();
  });

  it('does not treat a non-403 error as a request-access case', () => {
    const apiError = Object.assign(new Error('Alert not found'), { status: 404 });
    setup({
      searchParams: new URLSearchParams('alertId=9'),
      resourceAccessError: apiError,
    });

    render(<AlertsPage />);

    expect(screen.queryByTestId('stub-request-access-screen')).not.toBeInTheDocument();
  });
});
