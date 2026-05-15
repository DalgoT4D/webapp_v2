/**
 * Ingest Sources Tests
 *
 * Tests for SourceList component
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SourceList } from '../SourceList';
import * as useSourcesHook from '@/hooks/api/useSources';
import * as usePermissionsHook from '@/hooks/api/usePermissions';
import type { Source, SourceDefinition } from '@/types/source';
import { createMockSource, createMockDefinition } from './sources-mock-data';

// ============ Mocks ============

jest.mock('@/hooks/api/useSources');
jest.mock('@/hooks/api/usePermissions');

// SourceForm is tested separately — mock it out so SourceList tests are isolated
jest.mock('../SourceForm', () => ({
  SourceForm: ({ sourceId }: { sourceId?: string }) => (
    <div data-testid="source-form">{sourceId ? 'Edit Source' : 'Add Source'}</div>
  ),
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

jest.mock('@/lib/toast', () => ({
  toastSuccess: {
    deleted: jest.fn(),
    created: jest.fn(),
    updated: jest.fn(),
    generic: jest.fn(),
  },
  toastError: {
    delete: jest.fn(),
    save: jest.fn(),
    api: jest.fn(),
  },
}));

jest.mock('@/components/ui/confirmation-dialog', () => ({
  useConfirmationDialog: () => ({
    confirm: jest.fn().mockResolvedValue(true),
    DialogComponent: (): null => null,
  }),
}));

// ============ SourceList Tests ============

describe('SourceList', () => {
  const mockMutate = jest.fn();

  const mockSources = (data: Source[]) =>
    (useSourcesHook.useSources as jest.Mock).mockReturnValue({
      data,
      isLoading: false,
      isError: null,
      mutate: mockMutate,
    });

  const mockDefinitions = (data: SourceDefinition[]) =>
    (useSourcesHook.useSourceDefinitions as jest.Mock).mockReturnValue({
      data,
      isLoading: false,
      isError: null,
    });

  beforeEach(() => {
    jest.clearAllMocks();
    mockSources([]);
    mockDefinitions([]);
    (usePermissionsHook.useUserPermissions as jest.Mock).mockReturnValue({
      hasPermission: () => true,
    });
  });

  it('shows loading spinner while fetching sources', () => {
    (useSourcesHook.useSources as jest.Mock).mockReturnValue({
      data: [],
      isLoading: true,
      isError: null,
      mutate: mockMutate,
    });

    render(<SourceList />);

    expect(screen.queryByTestId('source-table')).not.toBeInTheDocument();
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('shows empty state and hides add button without create permission', () => {
    // With create permission — both empty state and add button visible
    const { unmount } = render(<SourceList />);
    expect(screen.getByTestId('source-empty-state')).toBeInTheDocument();
    expect(screen.getByText('No sources configured yet.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add your first source/i })).toBeInTheDocument();
    unmount();

    // Without create permission — add button hidden
    (usePermissionsHook.useUserPermissions as jest.Mock).mockReturnValue({
      hasPermission: (p: string) => p !== 'can_create_source',
    });
    render(<SourceList />);
    expect(screen.getByTestId('source-empty-state')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /add your first source/i })
    ).not.toBeInTheDocument();
  });

  it('renders source table with name, type label, and docker image tag', () => {
    const sources = [
      createMockSource(),
      createMockSource({
        sourceId: 'src-2',
        name: 'BigQuery Source',
        sourceDefinitionId: 'def-2',
        sourceName: 'BigQuery',
      }),
    ];
    const definitions = [
      createMockDefinition(),
      createMockDefinition({
        sourceDefinitionId: 'def-2',
        name: 'BigQuery',
        dockerRepository: 'airbyte/source-bigquery',
        dockerImageTag: '1.2.3',
      }),
    ];

    (useSourcesHook.useSources as jest.Mock).mockReturnValue({
      data: sources,
      isLoading: false,
      isError: null,
      mutate: mockMutate,
    });
    (useSourcesHook.useSourceDefinitions as jest.Mock).mockReturnValue({
      data: definitions,
      isLoading: false,
      isError: null,
    });

    render(<SourceList />);

    expect(screen.getByTestId('source-table')).toBeInTheDocument();
    expect(screen.getByText('My Postgres Source')).toBeInTheDocument();
    expect(screen.getByText('BigQuery Source')).toBeInTheDocument();
    expect(screen.getByText('Postgres')).toBeInTheDocument();
    expect(screen.getByText('BigQuery')).toBeInTheDocument();
    expect(screen.getByText('airbyte/source-postgres:0.4.28')).toBeInTheDocument();
    expect(screen.getByText('airbyte/source-bigquery:1.2.3')).toBeInTheDocument();
  });

  it('sorts sources alphabetically regardless of API order', () => {
    const sources = [
      createMockSource({ sourceId: 'src-z', name: 'Zebra Source' }),
      createMockSource({ sourceId: 'src-a', name: 'Alpha Source' }),
      createMockSource({ sourceId: 'src-m', name: 'Middle Source' }),
    ];

    (useSourcesHook.useSources as jest.Mock).mockReturnValue({
      data: sources,
      isLoading: false,
      isError: null,
      mutate: mockMutate,
    });

    render(<SourceList />);

    const rows = screen.getAllByTestId(/^source-row-/);
    expect(rows[0]).toHaveTextContent('Alpha Source');
    expect(rows[1]).toHaveTextContent('Middle Source');
    expect(rows[2]).toHaveTextContent('Zebra Source');
  });

  it('filters sources by name and sourceName via search input', async () => {
    const user = userEvent.setup();
    const sources = [
      createMockSource({ sourceId: 'src-1', name: 'Production DB', sourceName: 'Postgres' }),
      createMockSource({ sourceId: 'src-2', name: 'Analytics', sourceName: 'BigQuery' }),
    ];

    (useSourcesHook.useSources as jest.Mock).mockReturnValue({
      data: sources,
      isLoading: false,
      isError: null,
      mutate: mockMutate,
    });

    render(<SourceList />);

    await user.type(screen.getByTestId('source-search-input'), 'Production');
    expect(screen.getByText('Production DB')).toBeInTheDocument();
    expect(screen.queryByText('Analytics')).not.toBeInTheDocument();

    await user.clear(screen.getByTestId('source-search-input'));
    await user.type(screen.getByTestId('source-search-input'), 'BigQuery');
    expect(screen.queryByText('Production DB')).not.toBeInTheDocument();
    expect(screen.getByText('Analytics')).toBeInTheDocument();
  });

  it('shows "no sources matching" message when search has no results', async () => {
    const user = userEvent.setup();

    (useSourcesHook.useSources as jest.Mock).mockReturnValue({
      data: [createMockSource()],
      isLoading: false,
      isError: null,
      mutate: mockMutate,
    });

    render(<SourceList />);
    await user.type(screen.getByTestId('source-search-input'), 'xyz-nothing-matches');
    expect(screen.getByText(/No sources matching/)).toBeInTheDocument();
  });

  it('opens source form in create mode when new source button is clicked', async () => {
    const user = userEvent.setup();
    render(<SourceList />);

    await user.click(screen.getByTestId('add-source-btn'));
    expect(screen.getByTestId('source-form')).toBeInTheDocument();
    expect(screen.getByText('Add Source')).toBeInTheDocument();
  });

  it('opens source form in edit mode when edit menu item is clicked', async () => {
    const user = userEvent.setup();

    (useSourcesHook.useSources as jest.Mock).mockReturnValue({
      data: [createMockSource()],
      isLoading: false,
      isError: null,
      mutate: mockMutate,
    });

    render(<SourceList />);

    await user.click(screen.getByTestId('source-actions-src-1'));
    await waitFor(() => {
      expect(screen.getByTestId('edit-source-src-1')).toBeInTheDocument();
    });
    await user.click(screen.getByTestId('edit-source-src-1'));

    await waitFor(() => {
      expect(screen.getByTestId('source-form')).toBeInTheDocument();
      expect(screen.getByText('Edit Source')).toBeInTheDocument();
    });
  });

  it('deletes source after confirmation and shows success toast', async () => {
    const user = userEvent.setup();
    const mockDeleteSource = jest
      .spyOn(useSourcesHook, 'deleteSource')
      .mockResolvedValue(undefined);
    const { toastSuccess } = jest.requireMock('@/lib/toast');

    (useSourcesHook.useSources as jest.Mock).mockReturnValue({
      data: [createMockSource()],
      isLoading: false,
      isError: null,
      mutate: mockMutate,
    });

    render(<SourceList />);

    await user.click(screen.getByTestId('source-actions-src-1'));
    await waitFor(() => expect(screen.getByTestId('delete-source-src-1')).toBeInTheDocument());
    await user.click(screen.getByTestId('delete-source-src-1'));

    await waitFor(() => {
      expect(mockDeleteSource).toHaveBeenCalledWith('src-1');
      expect(toastSuccess.deleted).toHaveBeenCalledWith('My Postgres Source');
      expect(mockMutate).toHaveBeenCalled();
    });
  });

  it('shows error toast and does not mutate when delete API fails', async () => {
    const user = userEvent.setup();
    jest.spyOn(useSourcesHook, 'deleteSource').mockRejectedValue(new Error('Network error'));
    const { toastError } = jest.requireMock('@/lib/toast');

    (useSourcesHook.useSources as jest.Mock).mockReturnValue({
      data: [createMockSource()],
      isLoading: false,
      isError: null,
      mutate: mockMutate,
    });

    render(<SourceList />);

    await user.click(screen.getByTestId('source-actions-src-1'));
    await waitFor(() => expect(screen.getByTestId('delete-source-src-1')).toBeInTheDocument());
    await user.click(screen.getByTestId('delete-source-src-1'));

    await waitFor(() => {
      expect(toastError.delete).toHaveBeenCalled();
    });
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('hides actions dropdown when user lacks both edit and delete permissions', () => {
    (useSourcesHook.useSources as jest.Mock).mockReturnValue({
      data: [createMockSource()],
      isLoading: false,
      isError: null,
      mutate: mockMutate,
    });
    (usePermissionsHook.useUserPermissions as jest.Mock).mockReturnValue({
      hasPermission: (p: string) => p !== 'can_edit_source' && p !== 'can_delete_source',
    });

    render(<SourceList />);

    expect(screen.queryByTestId('source-actions-src-1')).not.toBeInTheDocument();
  });
});
