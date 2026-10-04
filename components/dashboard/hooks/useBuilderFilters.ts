'use client';

import { useState } from 'react';
import {
  createDashboardFilter,
  updateDashboardFilter,
  type DashboardFilter,
} from '@/hooks/api/useDashboards';
import type {
  CreateFilterPayload,
  DashboardFilterConfig,
  UpdateFilterPayload,
} from '@/types/dashboard-filters';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';

type FilterTypeName = DashboardFilter['filter_type'];

/** Refresh dashboard data to update the filter list. */
async function revalidateDashboard(dashboardId: number) {
  const { mutate } = await import('swr');
  mutate(`/api/dashboards/${dashboardId}/`);
}

/** The builder's filter modal: create, edit, close. Moved from dashboard-builder-v2.tsx. */
export function useBuilderFilters(dashboardId: number | undefined) {
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [selectedFilterForEdit, setSelectedFilterForEdit] = useState<DashboardFilter | null>(null);

  const handleFilterCreate = async (filterPayload: CreateFilterPayload) => {
    if (!dashboardId) return;
    try {
      // Create filter in database first using typed API
      await createDashboardFilter(dashboardId, {
        name: filterPayload.name,
        filter_type: filterPayload.filter_type as FilterTypeName,
        schema_name: filterPayload.schema_name,
        table_name: filterPayload.table_name,
        column_name: filterPayload.column_name,
        settings: filterPayload.settings,
      });
      trackEvent(ANALYTICS_EVENTS.DASHBOARD_FILTER_CREATED, {
        dashboard_id: dashboardId,
        filter_type: filterPayload.filter_type,
      });

      // Note: Filter components will handle their own state updates

      setShowFilterModal(false);

      // Refresh dashboard data to update filter list
      if (dashboardId) {
        await revalidateDashboard(dashboardId);
      }
    } catch (error: unknown) {
      // PINNED-BUGS: "Filter create/update failure is silent — modal closes, typed values lost, no toast"
      console.error('Failed to create filter:', (error as Error).message || 'Please try again');
      // Could add error handling/notification here
    }
  };

  // Add or update a filter (the modal's Save)
  const handleFilterSave = async (
    filterPayload: CreateFilterPayload | UpdateFilterPayload,
    filterId?: number
  ) => {
    if (!dashboardId) return;

    // Check if this is an update or create
    if (filterId && selectedFilterForEdit) {
      // Update existing filter
      try {
        const updateData = {
          name: filterPayload.name,
          schema_name: filterPayload.schema_name,
          table_name: filterPayload.table_name,
          column_name: filterPayload.column_name,
          filter_type: (filterPayload.filter_type ||
            selectedFilterForEdit.filter_type) as FilterTypeName,
          settings: filterPayload.settings,
        };

        // Use the new typed API function that returns complete filter data
        await updateDashboardFilter(dashboardId, filterId, updateData);
        trackEvent(ANALYTICS_EVENTS.DASHBOARD_FILTER_UPDATED, {
          dashboard_id: dashboardId,
          filter_type: updateData.filter_type,
        });

        // Note: Filter components will handle their own state updates

        setSelectedFilterForEdit(null);
        setShowFilterModal(false);

        // Refresh dashboard data to update filter list
        if (dashboardId) {
          await revalidateDashboard(dashboardId);
        }
      } catch (error) {
        // PINNED-BUGS: "Filter create/update failure is silent — modal closes, typed values lost, no toast"
        console.error('Error updating filter:', error);
      }
    } else {
      // Create new filter (existing logic)
      handleFilterCreate(filterPayload as CreateFilterPayload);
    }
  };

  // Edit filter
  const handleEditFilter = (filter: DashboardFilterConfig) => {
    // Convert DashboardFilterConfig back to DashboardFilter format for editing
    const filterForEdit: DashboardFilter = {
      id: parseInt(filter.id),
      dashboard_id: dashboardId!,
      name: filter.name,
      filter_type: filter.filter_type as FilterTypeName,
      schema_name: filter.schema_name,
      table_name: filter.table_name,
      column_name: filter.column_name,
      settings: filter.settings,
      order: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setSelectedFilterForEdit(filterForEdit);
    setShowFilterModal(true);
  };

  const openFilterModal = () => setShowFilterModal(true);

  const closeFilterModal = () => {
    setShowFilterModal(false);
    setSelectedFilterForEdit(null);
  };

  return {
    showFilterModal,
    selectedFilterForEdit,
    openFilterModal,
    closeFilterModal,
    handleFilterSave,
    handleEditFilter,
  };
}
