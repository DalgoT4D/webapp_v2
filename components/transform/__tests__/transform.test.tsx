/**
 * Transform Page Tests
 *
 * Tests for the root Transform component: loading, error, and main UI states.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Transform from '../Transform';
import { TestWrapper } from '@/test-utils/render';
import * as useTransformHook from '@/hooks/api/useTransform';
import * as useNotificationsHook from '@/hooks/api/useNotifications';
import { TransformTab } from '@/constants/transform';

// ============ Mocks ============

jest.mock('@/hooks/api/useTransform');
jest.mock('@/hooks/api/useNotifications');

const mockSetActiveTab = jest.fn();

jest.mock('@/stores/transformStore', () => ({
  useTransformStore: () => ({
    activeTab: TransformTab.UI,
    setActiveTab: mockSetActiveTab,
  }),
}));

jest.mock('../ui-transform/UITransformTab', () => ({
  UITransformTab: () => <div data-testid="ui-transform-content" />,
}));

jest.mock('../dbt-transform/DBTTransformTab', () => ({
  DBTTransformTab: () => <div data-testid="dbt-transform-content" />,
}));

jest.mock('@/lib/toast', () => ({
  toastSuccess: { generic: jest.fn() },
  toastError: { api: jest.fn() },
}));

// ============ Transform Tests ============

describe('Transform', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (useNotificationsHook.useUserPreferences as jest.Mock).mockReturnValue({
      preferences: null,
      mutate: jest.fn(),
    });

    jest.spyOn(useTransformHook, 'setupTransformWorkspace').mockResolvedValue(undefined);
    jest.spyOn(useTransformHook, 'createTransformTasks').mockResolvedValue(undefined);
    jest.spyOn(useTransformHook, 'syncSources').mockResolvedValue(undefined);
    jest.spyOn(useNotificationsHook, 'updateUserPreference').mockResolvedValue(undefined);
  });

  it('shows loading spinner while transform type is loading', () => {
    (useTransformHook.useTransformType as jest.Mock).mockReturnValue({
      data: undefined,
      isLoading: true,
    });

    render(<Transform />, { wrapper: TestWrapper });
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders main UI with both tabs when workspace is already set up (transform type is ui)', async () => {
    (useTransformHook.useTransformType as jest.Mock).mockReturnValue({
      data: { transform_type: 'ui' },
      isLoading: false,
    });

    render(<Transform />, { wrapper: TestWrapper });

    await waitFor(() => {
      expect(screen.getByTestId('transform-page')).toBeInTheDocument();
    });

    expect(screen.getByTestId('ui-transform-content')).toBeInTheDocument();
    expect(screen.getByTestId('ui-transform-tab')).toBeInTheDocument();
    expect(screen.getByTestId('github-transform-tab')).toBeInTheDocument();
  });

  it('renders main UI when transform type is github', async () => {
    (useTransformHook.useTransformType as jest.Mock).mockReturnValue({
      data: { transform_type: 'github' },
      isLoading: false,
    });

    render(<Transform />, { wrapper: TestWrapper });

    await waitFor(() => {
      expect(screen.getByTestId('transform-page')).toBeInTheDocument();
    });
  });

  it('shows error state with retry button when workspace setup fails', async () => {
    (useTransformHook.useTransformType as jest.Mock).mockReturnValue({
      data: { transform_type: null },
      isLoading: false,
    });
    jest
      .spyOn(useTransformHook, 'setupTransformWorkspace')
      .mockRejectedValue(new Error('Network error'));
    jest.spyOn(useTransformHook, 'deleteDbtRepo').mockResolvedValue(undefined);

    render(<Transform />, { wrapper: TestWrapper });

    await waitFor(() => {
      expect(screen.getByTestId('transform-setup-retry-btn')).toBeInTheDocument();
    });

    expect(screen.getByText('Setup Failed')).toBeInTheDocument();
    expect(screen.getByText('Network error')).toBeInTheDocument();
  });

  it('calls updateUserPreference when tab is switched', async () => {
    const user = userEvent.setup();
    const mockUpdatePreference = jest
      .spyOn(useNotificationsHook, 'updateUserPreference')
      .mockResolvedValue(undefined);

    (useTransformHook.useTransformType as jest.Mock).mockReturnValue({
      data: { transform_type: 'ui' },
      isLoading: false,
    });

    render(<Transform />, { wrapper: TestWrapper });

    await waitFor(() => expect(screen.getByTestId('transform-page')).toBeInTheDocument());

    await user.click(screen.getByTestId('github-transform-tab'));

    await waitFor(() => {
      expect(mockUpdatePreference).toHaveBeenCalledWith({
        last_visited_transform_tab: TransformTab.GITHUB,
      });
    });
  });

  it('restores saved tab preference from user preferences', async () => {
    (useTransformHook.useTransformType as jest.Mock).mockReturnValue({
      data: { transform_type: 'github' },
      isLoading: false,
    });

    (useNotificationsHook.useUserPreferences as jest.Mock).mockReturnValue({
      preferences: { last_visited_transform_tab: TransformTab.GITHUB },
      mutate: jest.fn(),
    });

    render(<Transform />, { wrapper: TestWrapper });

    await waitFor(() => expect(screen.getByTestId('transform-page')).toBeInTheDocument());

    expect(mockSetActiveTab).toHaveBeenCalledWith(TransformTab.GITHUB);
  });
});
