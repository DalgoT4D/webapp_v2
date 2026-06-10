import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Branding from '../branding';
import { TestWrapper } from '@/test-utils/render';

// ============ Mocks ============

global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = jest.fn();

jest.mock('swr', () => ({
  ...jest.requireActual('swr'),
  useSWRConfig: () => ({ mutate: jest.fn() }),
}));

jest.mock('@/lib/api', () => ({
  apiGet: jest.fn(),
  apiPost: jest.fn(),
  apiPut: jest.fn(),
  apiDelete: jest.fn(),
  apiPostFormData: jest.fn(),
}));

jest.mock('@/lib/toast', () => ({
  toastSuccess: { saved: jest.fn() },
  toastError: { save: jest.fn() },
}));

jest.mock('@/stores/authStore', () => ({ useAuthStore: jest.fn() }));
import { useAuthStore } from '@/stores/authStore';

// ============ Helpers ============

function setupAuthStore(logoUrl: string | null, logoFilename: string | null) {
  (useAuthStore as jest.Mock).mockReturnValue({
    orgUsers: [],
    setOrgUsers: jest.fn(),
    currentOrg: {
      slug: 'test-org',
      name: 'Test Org',
      viz_url: '',
      logo_url: logoUrl,
      logo_filename: logoFilename,
    },
  });
}

const renderBranding = () =>
  render(
    <TestWrapper>
      <Branding />
    </TestWrapper>
  );

// ============ Tests ============

describe('Branding', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupAuthStore(null, null);
  });

  describe('Tab locking', () => {
    it('both tabs enabled when no logo saved', () => {
      renderBranding();
      expect(screen.getByTestId('branding-tab-upload')).not.toBeDisabled();
      expect(screen.getByTestId('branding-tab-link')).not.toBeDisabled();
    });

    it('Link tab disabled when logo saved via Upload (logo_filename set)', () => {
      setupAuthStore('https://s3.example.com/logo.png', 'logo.png');
      renderBranding();
      expect(screen.getByTestId('branding-tab-link')).toBeDisabled();
      expect(screen.getByTestId('branding-tab-upload')).not.toBeDisabled();
    });

    it('Upload tab disabled when logo saved via Link (logo_filename null)', () => {
      setupAuthStore('https://external.com/logo.png', null);
      renderBranding();
      expect(screen.getByTestId('branding-tab-upload')).toBeDisabled();
      expect(screen.getByTestId('branding-tab-link')).not.toBeDisabled();
    });
  });

  describe('Active tab on render', () => {
    it('Upload tab active by default when no logo', () => {
      renderBranding();
      expect(screen.getByTestId('branding-tab-upload')).toHaveAttribute('data-state', 'active');
    });

    it('Upload tab active when logo_filename is set', () => {
      setupAuthStore('https://s3.example.com/logo.png', 'logo.png');
      renderBranding();
      expect(screen.getByTestId('branding-tab-upload')).toHaveAttribute('data-state', 'active');
    });

    it('Link tab active when logo_filename is null but logo_url exists', () => {
      setupAuthStore('https://external.com/logo.png', null);
      renderBranding();
      expect(screen.getByTestId('branding-tab-link')).toHaveAttribute('data-state', 'active');
    });
  });

  describe('Unsaved changes dialog', () => {
    it('shows dialog when Cancel clicked with unsaved link URL', async () => {
      const user = userEvent.setup();
      renderBranding();
      await user.click(screen.getByTestId('branding-tab-link'));
      await user.type(
        screen.getByTestId('branding-logo-url-input'),
        'https://example.com/logo.png'
      );
      await user.click(screen.getByTestId('branding-cancel-btn'));
      expect(screen.getByTestId('branding-unsaved-dialog')).toBeInTheDocument();
    });

    it('resets changes when Leave Without Saving clicked', async () => {
      const user = userEvent.setup();
      renderBranding();
      await user.click(screen.getByTestId('branding-tab-link'));
      await user.type(
        screen.getByTestId('branding-logo-url-input'),
        'https://example.com/logo.png'
      );
      await user.click(screen.getByTestId('branding-cancel-btn'));
      await user.click(screen.getByTestId('branding-unsaved-dialog-confirm'));
      expect(screen.queryByTestId('branding-unsaved-dialog')).not.toBeInTheDocument();
      expect(screen.getByTestId('branding-logo-url-input')).toHaveValue('');
    });

    it('keeps changes when Cancel clicked in dialog', async () => {
      const user = userEvent.setup();
      renderBranding();
      await user.click(screen.getByTestId('branding-tab-link'));
      await user.type(
        screen.getByTestId('branding-logo-url-input'),
        'https://example.com/logo.png'
      );
      await user.click(screen.getByTestId('branding-cancel-btn'));
      await user.click(screen.getByTestId('branding-unsaved-dialog-cancel'));
      expect(screen.getByTestId('branding-logo-url-input')).toHaveValue(
        'https://example.com/logo.png'
      );
    });
  });
});
