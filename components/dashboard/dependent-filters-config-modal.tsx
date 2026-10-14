'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Table2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { setDependentGroup } from '@/hooks/api/useDashboards';
import { toastError, toastSuccess } from '@/lib/toast';
import { DashboardFilterType } from '@/types/dashboard-filters';
import type { DashboardFilterConfig } from '@/types/dashboard-filters';

interface DependentFiltersConfigModalProps {
  open: boolean;
  onClose: () => void;
  dashboardId: number;
  filters: DashboardFilterConfig[];
  currentGroupIds: number[];
  onSaved: (filterIds: number[]) => void;
}

export function DependentFiltersConfigModal({
  open,
  onClose,
  dashboardId,
  filters,
  currentGroupIds,
  onSaved,
}: DependentFiltersConfigModalProps) {
  const [selectedIds, setSelectedIds] = useState<number[]>(currentGroupIds);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setSelectedIds(currentGroupIds);
    }
  }, [open, currentGroupIds]);

  const normalizeGroupIds = (ids: number[]) =>
    ids.length === 1 ? [] : [...ids].sort((a, b) => a - b);
  const hasChanges =
    JSON.stringify(normalizeGroupIds(selectedIds)) !==
    JSON.stringify(normalizeGroupIds(currentGroupIds));

  // The anchor table is whichever filter is checked first -- every other filter must
  // share its (schema_name, table_name) to be eligible for the group.
  const anchorFilter = filters.find((f) => selectedIds.includes(Number(f.id)));

  const isEligible = (filter: DashboardFilterConfig) => {
    if (filter.filter_type !== DashboardFilterType.VALUE) return false;
    if (!anchorFilter) return true;
    return (
      filter.schema_name === anchorFilter.schema_name &&
      filter.table_name === anchorFilter.table_name
    );
  };

  const handleToggle = (filterId: number, checked: boolean) => {
    setSelectedIds((prev) =>
      checked ? [...prev, filterId] : prev.filter((id) => id !== filterId)
    );
  };

  // Group filters by table, preserving each table's first-appearance order.
  const filtersByTable = new Map<string, DashboardFilterConfig[]>();
  for (const filter of filters) {
    const tableKey = `${filter.schema_name}.${filter.table_name}`;
    const group = filtersByTable.get(tableKey);
    if (group) {
      group.push(filter);
    } else {
      filtersByTable.set(tableKey, [filter]);
    }
  }

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const result = await setDependentGroup(dashboardId, selectedIds);
      onSaved(result.dependent_group_filter_ids);
      toastSuccess.generic('Dependent filters saved successfully');
      onClose();
      // Refresh dashboard data to keep the cache in sync
      const { mutate } = await import('swr');
      mutate(`/api/dashboards/${dashboardId}/`);
    } catch (error) {
      toastError.update(error, 'dependent filters');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Linked filters</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Select the filters that should work together. When you pick a value in one, the others
          update to show only the options that still apply.
        </p>
        <ScrollArea className="max-h-80">
          <div className="space-y-4 py-2">
            {Array.from(filtersByTable.entries()).map(([tableKey, tableFilters]) => (
              <div key={tableKey} className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground">
                  <Table2 className="w-3.5 h-3.5" />
                  {tableFilters[0].table_name.replace(/_/g, ' ')}
                </div>
                {tableFilters.map((filter) => {
                  const filterId = Number(filter.id);
                  const eligible = isEligible(filter);
                  return (
                    <div key={filter.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`dependent-filter-${filter.id}`}
                        checked={selectedIds.includes(filterId)}
                        disabled={!eligible}
                        onCheckedChange={(checked) => handleToggle(filterId, checked === true)}
                        data-testid={`dependent-filter-checkbox-${filter.id}`}
                      />
                      <Label
                        htmlFor={`dependent-filter-${filter.id}`}
                        className={cn(!eligible && 'text-muted-foreground')}
                      >
                        {filter.name || filter.column_name}
                      </Label>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </ScrollArea>
        <Alert variant="warning">
          <AlertDescription>
            You can only link dropdown filters, and they must all come from the same table. Date and
            number filters can&apos;t be linked
          </AlertDescription>
        </Alert>
        <div className="flex justify-end gap-2 pt-2">
          <Button
            variant="cancel"
            onClick={onClose}
            disabled={isSaving}
            data-testid="dependent-filters-cancel"
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
            data-testid="dependent-filters-save"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
