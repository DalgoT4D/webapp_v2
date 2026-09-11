import type { ComponentProps } from 'react';
import { render, screen } from '@testing-library/react';
import { ChartDetailClient } from '../ChartDetailClient';

let mockParams = new URLSearchParams();
const mockRouter = { back: jest.fn(), replace: jest.fn() };
const mockChart = {
  id: 23,
  title: 'Learners',
  chart_type: 'bar',
  access_level: 'edit',
  extra_config: {},
};
const mockEmptyResult: { data: undefined; isLoading: boolean; error: undefined } = {
  data: undefined,
  isLoading: false,
  error: undefined,
};

jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  usePathname: () => '/charts/23',
  useSearchParams: () => mockParams,
}));
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ replace, ...props }: ComponentProps<'a'> & { replace?: boolean }) => (
    <a {...props} data-replace={String(!!replace)} />
  ),
}));
jest.mock('@/lib/rbac', () => ({
  ...jest.requireActual('@/lib/rbac'),
  useRbac: () => ({ hasPermission: () => true }),
}));
jest.mock('@/hooks/api/useChart', () => ({
  useChart: () => ({ data: mockChart, isLoading: false }),
  useChartData: () => mockEmptyResult,
  useChartDataPreview: () => mockEmptyResult,
  useChartDataPreviewTotalRows: () => mockEmptyResult,
  useGeoJSONData: () => mockEmptyResult,
  useMapDataOverlay: () => mockEmptyResult,
  useRegionGeoJSONs: () => mockEmptyResult,
  useRegions: () => mockEmptyResult,
}));
jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn() }));
jest.mock('@/components/charts/ChartPreview', () => ({ ChartPreview: (): null => null }));
jest.mock('@/components/charts/ChartExportDropdown', () => ({
  ChartExportDropdown: (): null => null,
}));
jest.mock('@/components/ui/share-modal', () => ({ ShareModal: (): null => null }));
jest.mock('@/components/access/request-edit-pill', () => ({ RequestEditPill: (): null => null }));
jest.mock('@/components/onboarding/celebration-modal', () => ({
  CelebrationModal: (): null => null,
}));

it.each(['report', 'dashboard'])(
  'replaces chart detail when entering edit from a %s so Back can return to the source',
  (source) => {
    mockParams = new URLSearchParams({ from: source });
    render(<ChartDetailClient chartId={23} />);
    const link = screen.getByTestId('chart-detail-edit-link');
    expect(link).toHaveAttribute('href', `/charts/23/edit?from=${source}`);
    expect(link).toHaveAttribute('data-replace', 'true');
  }
);

it.each(['', 'from=unknown'])(
  'keeps the normal chart detail history when there is no recognized source (%s)',
  (query) => {
    mockParams = new URLSearchParams(query);
    render(<ChartDetailClient chartId={23} />);
    const link = screen.getByTestId('chart-detail-edit-link');
    expect(link).toHaveAttribute('href', '/charts/23/edit');
    expect(link).toHaveAttribute('data-replace', 'false');
  }
);
