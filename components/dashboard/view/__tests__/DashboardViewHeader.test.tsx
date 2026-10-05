import { fireEvent, render, screen } from '@testing-library/react';
import {
  DashboardViewHeader,
  type ViewHeaderProps,
} from '@/components/dashboard/view/DashboardViewHeader';

jest.mock('@/hooks/useResponsiveLayout', () => ({
  useResponsiveLayout: () => ({ isDesktop: true }),
}));
jest.mock('@/components/access/request-edit-pill', () => ({ RequestEditPill: (): null => null }));
jest.mock('@/components/dashboard/embed-code-dropdown', () => ({
  EmbedCodeDropdown: () => <div data-testid="embed-stub" />,
}));

function setup(over: Partial<ViewHeaderProps> = {}) {
  const props: ViewHeaderProps = {
    dashboard: {
      id: 3,
      title: 'Impact',
      description: 'About',
      is_published: true,
      updated_at: new Date().toISOString(),
      last_modified_by: 'ana@ngo.org',
    },
    isFullscreen: false,
    isPublicMode: false,
    isReportMode: false,
    isLocked: true,
    isLockedByOther: true,
    lockedBy: 'bo@ngo.org',
    landing: {
      isPersonalLanding: false,
      isOrgDefault: false,
      canManageOrgDefault: false,
      isLoading: false,
      onSetPersonal: jest.fn(),
      onRemovePersonal: jest.fn(),
      onSetOrgDefault: jest.fn(),
    },
    canEdit: true,
    isDeleting: false,
    isRefreshing: false,
    onBack: jest.fn(),
    onToggleFullscreen: jest.fn(),
    onShare: jest.fn(),
    onEdit: jest.fn(),
    onDelete: jest.fn(),
    onRefresh: jest.fn(),
    ...over,
  };
  render(<DashboardViewHeader {...props} />);
  return props;
}

describe('DashboardViewHeader', () => {
  it('compact and full variants with their testids and lock text', () => {
    const props = setup();
    expect(screen.getByText('Locked')).toBeInTheDocument();
    expect(screen.getByText('Locked by bo@ngo.org')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-description')).toHaveTextContent('About');
    expect(screen.getByTestId('dashboard-view-landing-trigger-mobile')).toHaveTextContent(
      'Set Landing'
    );
    expect(screen.getByTestId('dashboard-view-landing-trigger')).toHaveClass('text-xs');
    expect(screen.getByTestId('dashboard-view-landing-trigger-mobile')).toHaveClass('px-3', 'py-1');
    fireEvent.click(screen.getByTestId('dashboard-view-back-btn-mobile'));
    fireEvent.click(screen.getByTestId('dashboard-view-back-btn'));
    expect(props.onBack).toHaveBeenCalledTimes(2);
  });

  it('locked by another user: no Edit button; share stays (unique testid)', () => {
    setup();
    expect(screen.queryByTestId('dashboard-edit-btn')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('dashboard-share-btn')).toHaveLength(1);
  });

  it('fullscreen hides both Back buttons', () => {
    setup({ isFullscreen: true });
    expect(screen.queryByTestId('dashboard-view-back-btn')).not.toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-view-back-btn-mobile')).not.toBeInTheDocument();
  });

  it('embed dropdown only with a public share token (pinned: the API never sends one)', () => {
    setup();
    expect(screen.queryByTestId('embed-stub')).not.toBeInTheDocument();
  });

  it('landing trigger reads "My Landing" with the blue style for a personal landing', () => {
    setup({
      landing: {
        isPersonalLanding: true,
        isOrgDefault: false,
        canManageOrgDefault: true,
        isLoading: false,
        onSetPersonal: jest.fn(),
        onRemovePersonal: jest.fn(),
        onSetOrgDefault: jest.fn(),
      },
    });
    expect(screen.getByTestId('dashboard-view-landing-trigger')).toHaveTextContent('My Landing');
    expect(screen.getByTestId('dashboard-view-landing-trigger')).toHaveClass('bg-blue-50');
  });
});
