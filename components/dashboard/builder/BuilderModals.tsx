'use client';

import { ChartSelectorModal } from '@/components/dashboard/chart-selector-modal';
import { KPISelectorModal } from '@/components/dashboard/kpi-selector-modal';
import { FilterConfigModal } from '@/components/dashboard/filter-config-modal';
import type {
  CreateFilterPayload,
  DashboardFilterType,
  UpdateFilterPayload,
} from '@/types/dashboard-filters';
import type { DashboardFilter } from '@/hooks/api/useDashboards';

interface BuilderModalsProps {
  showChartSelector: boolean;
  onCloseChartSelector: () => void;
  onChartSelected: (chartId: number) => void;
  excludedChartIds: number[];
  showKPISelector: boolean;
  onCloseKPISelector: () => void;
  onKPISelected: (kpiId: number, kpiName: string) => void;
  excludedKPIIds: number[];
  showFilterModal: boolean;
  onCloseFilterModal: () => void;
  onFilterSave: (filter: CreateFilterPayload | UpdateFilterPayload, filterId?: number) => void;
  selectedFilterForEdit: DashboardFilter | null;
  dashboardId: number | undefined;
}

/** The builder's modals: chart picker, KPI picker and the filter create/edit modal. */
export function BuilderModals({
  showChartSelector,
  onCloseChartSelector,
  onChartSelected,
  excludedChartIds,
  showKPISelector,
  onCloseKPISelector,
  onKPISelected,
  excludedKPIIds,
  showFilterModal,
  onCloseFilterModal,
  onFilterSave,
  selectedFilterForEdit,
  dashboardId,
}: BuilderModalsProps) {
  return (
    <>
      {/* Chart Selector Modal */}
      <ChartSelectorModal
        open={showChartSelector}
        onClose={onCloseChartSelector}
        onSelect={onChartSelected}
        excludedChartIds={excludedChartIds}
      />
      <KPISelectorModal
        open={showKPISelector}
        onClose={onCloseKPISelector}
        onSelect={onKPISelected}
        excludedKPIIds={excludedKPIIds}
      />
      {/* Filter Config Modal */}
      <FilterConfigModal
        open={showFilterModal}
        onClose={onCloseFilterModal}
        onSave={onFilterSave}
        mode={selectedFilterForEdit ? 'edit' : 'create'}
        filterId={selectedFilterForEdit?.id ? Number(selectedFilterForEdit.id) : undefined}
        dashboardId={dashboardId}
        initialData={
          selectedFilterForEdit
            ? {
                name: selectedFilterForEdit.name,
                schema_name: selectedFilterForEdit.schema_name,
                table_name: selectedFilterForEdit.table_name,
                column_name: selectedFilterForEdit.column_name,
                filter_type: selectedFilterForEdit.filter_type as DashboardFilterType,
                settings: selectedFilterForEdit.settings,
              }
            : undefined
        }
      />
    </>
  );
}
