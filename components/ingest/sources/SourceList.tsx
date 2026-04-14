'use client';

import { useState, useMemo, useCallback } from 'react';
import { Plus, Search, MoreHorizontal, Pencil, Trash2, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { useSources, useSourceDefinitions, deleteSource } from '@/hooks/api/useSources';
import { useUserPermissions } from '@/hooks/api/usePermissions';
import { SOURCE_PERMISSIONS } from '@/constants/source';
import { toastSuccess, toastError } from '@/lib/toast';
import { SourceForm } from './SourceForm';

export function SourceList() {
  const { data: sources, isLoading, mutate } = useSources();
  const { data: definitions } = useSourceDefinitions();
  const { hasPermission } = useUserPermissions();
  const { confirm, DialogComponent } = useConfirmationDialog();

  // Build lookup: sourceDefinitionId -> docker tag info + source type label
  const defMap = useMemo(() => {
    const map = new Map<
      string,
      { dockerRepository?: string; dockerImageTag?: string; name?: string }
    >();
    for (const def of definitions) {
      map.set(def.sourceDefinitionId, {
        dockerRepository: def.dockerRepository,
        dockerImageTag: def.dockerImageTag,
        name: def.name,
      });
    }
    return map;
  }, [definitions]);

  const [searchQuery, setSearchQuery] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editSourceId, setEditSourceId] = useState<string | undefined>(undefined);

  const canCreate = hasPermission(SOURCE_PERMISSIONS.CREATE);
  const canEdit = hasPermission(SOURCE_PERMISSIONS.EDIT);
  const canDelete = hasPermission(SOURCE_PERMISSIONS.DELETE);

  const filteredSources = useMemo(() => {
    const sorted = [...sources].sort((a, b) => a.name.localeCompare(b.name));
    if (!searchQuery.trim()) return sorted;
    const query = searchQuery.toLowerCase();
    return sorted.filter(
      (s) => s.name.toLowerCase().includes(query) || s.sourceName.toLowerCase().includes(query)
    );
  }, [sources, searchQuery]);

  const handleAddSource = useCallback(() => {
    setEditSourceId(undefined);
    setFormOpen(true);
  }, []);

  const handleEditSource = useCallback((sourceId: string) => {
    setEditSourceId(sourceId);
    setFormOpen(true);
  }, []);

  const handleDeleteSource = useCallback(
    async (sourceId: string, sourceName: string) => {
      const confirmed = await confirm({
        title: 'Delete Source',
        description: `Are you sure you want to delete "${sourceName}"? This will also delete all connections using this source. This action cannot be undone.`,
        confirmText: 'Delete',
        cancelText: 'Cancel',
      });

      if (confirmed) {
        try {
          await deleteSource(sourceId);
          toastSuccess.deleted(sourceName);
          mutate();
        } catch (error) {
          toastError.delete(error, sourceName);
        }
      }
    },
    [confirm, mutate]
  );

  const handleFormClose = useCallback(() => {
    setFormOpen(false);
    setEditSourceId(undefined);
  }, []);

  const handleFormSuccess = useCallback(() => {
    mutate();
    handleFormClose();
  }, [mutate, handleFormClose]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header: Search + New Source */}
      <div className="flex-shrink-0 px-6 pt-6">
        <div className="flex items-center justify-between mb-6">
          {sources.length > 0 ? (
            <div className="relative w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search Sources"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="source-search-input"
              />
            </div>
          ) : (
            <div />
          )}
          {canCreate && (
            <Button
              variant="ghost"
              className="text-white hover:opacity-90 shadow-xs uppercase"
              style={{ backgroundColor: 'var(--primary)' }}
              onClick={handleAddSource}
              data-testid="add-source-btn"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Source
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
        {/* Empty state */}
        {sources.length === 0 && (
          <div
            className="flex flex-col items-center justify-center py-12 text-center"
            data-testid="source-empty-state"
          >
            <p className="text-muted-foreground mb-4">No sources configured yet.</p>
            {canCreate && (
              <Button
                variant="ghost"
                className="text-white hover:opacity-90 shadow-xs uppercase"
                style={{ backgroundColor: 'var(--primary)' }}
                onClick={handleAddSource}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Source
              </Button>
            )}
          </div>
        )}

        {/* No search results */}
        {sources.length > 0 && filteredSources.length === 0 && (
          <p className="text-base text-gray-400 py-8 text-center">
            No sources matching &quot;{searchQuery}&quot;
          </p>
        )}

        {/* Source table */}
        {filteredSources.length > 0 && (
          <div className="bg-white rounded-lg border shadow-sm">
            <Table data-testid="source-table">
              <TableHeader>
                <TableRow className="bg-gray-50 hover:bg-gray-50">
                  <TableHead className="text-base font-medium">Source details</TableHead>
                  <TableHead className="text-base font-medium">Type</TableHead>
                  <TableHead className="text-base font-medium text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSources.map((source) => {
                  const def = defMap.get(source.sourceDefinitionId);
                  const typeLabel = def?.name ?? source.sourceName;
                  const dockerImage =
                    def?.dockerRepository && def?.dockerImageTag
                      ? `${def.dockerRepository}:${def.dockerImageTag}`
                      : null;

                  return (
                    <TableRow
                      key={source.sourceId}
                      className="hover:bg-gray-50/50"
                      data-testid={`source-row-${source.sourceId}`}
                    >
                      {/* Source details */}
                      <TableCell className="py-4">
                        <div className="flex items-center gap-3">
                          <Image
                            src="/icons/connection.svg"
                            alt=""
                            width={40}
                            height={40}
                            className="flex-shrink-0 rounded-lg"
                          />
                          <span className="font-medium text-lg text-gray-900">{source.name}</span>
                        </div>
                      </TableCell>

                      {/* Type */}
                      <TableCell className="py-4">
                        <div>
                          <p className="text-base font-medium text-gray-900">{typeLabel}</p>
                          {dockerImage && <p className="text-sm text-gray-500">{dockerImage}</p>}
                        </div>
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="py-4 text-right">
                        {(canEdit || canDelete) && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 p-0 hover:bg-gray-100"
                                data-testid={`source-actions-${source.sourceId}`}
                              >
                                <MoreHorizontal className="w-4 h-4 text-gray-600" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                              {canEdit && (
                                <DropdownMenuItem
                                  onClick={() => handleEditSource(source.sourceId)}
                                  className="text-[14px]"
                                  data-testid={`edit-source-${source.sourceId}`}
                                >
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                              )}
                              {canDelete && (
                                <DropdownMenuItem
                                  onClick={() => handleDeleteSource(source.sourceId, source.name)}
                                  className="text-[14px] text-red-600 focus:text-red-600 focus:bg-red-50"
                                  data-testid={`delete-source-${source.sourceId}`}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      <DialogComponent />

      {/* Source Form Dialog */}
      {formOpen && (
        <SourceForm
          open={formOpen}
          onClose={handleFormClose}
          onSuccess={handleFormSuccess}
          sourceId={editSourceId}
        />
      )}
    </div>
  );
}
