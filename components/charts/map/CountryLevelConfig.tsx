'use client';

import React, { useEffect } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Globe, MapPin } from 'lucide-react';
import {
  useColumns,
  useAvailableLayers,
  useRegions,
  useRegionGeoJSONs,
} from '@/hooks/api/useChart';
import type { ChartBuilderFormData } from '@/types/charts';

interface Region {
  id: number;
  name: string;
  display_name?: string;
  type?: string;
  parent_id?: number;
  code?: string;
}

interface TableColumn {
  name: string;
  data_type: string;
  column_name?: string;
}

interface CountryLevelConfigProps {
  formData: ChartBuilderFormData;
  onFormDataChange: (updates: Partial<ChartBuilderFormData>) => void;
  disabled?: boolean;
}

export function CountryLevelConfig({
  formData,
  onFormDataChange,
  disabled = false,
}: CountryLevelConfigProps) {
  const { data: countries } = useAvailableLayers('country');
  const { data: columns } = useColumns(formData.schema_name || null, formData.table_name || null);

  const normalizedColumns: TableColumn[] =
    columns?.map((col) => ({
      name: col.column_name || col.name,
      data_type: col.data_type,
      column_name: col.column_name || col.name,
    })) || [];

  const allColumns = normalizedColumns;
  const countryCode = formData.country_code || 'IND';

  // Get regions and GeoJSONs for automatic preview
  const { data: regions } = useRegions(countryCode, undefined);
  const countryRegionId = regions?.find((r: Region) => r.type === 'country')?.id || 1;
  const { data: geojsons } = useRegionGeoJSONs(countryRegionId);

  const handleCountryChange = (countryCode: string) => {
    // Reset geographic column and related fields when country changes
    onFormDataChange({
      country_code: countryCode,
      geographic_column: undefined,
      selected_geojson_id: undefined,
      district_column: undefined,
      ward_column: undefined,
      subward_column: undefined,
    });
  };

  const handleGeographicColumnChange = (column: string) => {
    // Reset state and district selections when geographic column changes
    onFormDataChange({
      geographic_column: column,
      selected_geojson_id: undefined,
      district_column: undefined,
      ward_column: undefined,
      subward_column: undefined,
    });
  };

  // Auto-select default GeoJSON when geographic column is selected
  useEffect(() => {
    if (formData.geographic_column && geojsons && !formData.selected_geojson_id) {
      const defaultGeojson = geojsons.find((g: any) => g.is_default);
      if (defaultGeojson) {
        onFormDataChange({
          selected_geojson_id: defaultGeojson.id,
        });
      }
    }
  }, [formData.geographic_column, geojsons, formData.selected_geojson_id, onFormDataChange]);

  // Auto-generate preview when all required fields are configured
  useEffect(() => {
    console.log('🔍 [COUNTRY-LEVEL-CONFIG] Checking auto-generate conditions:', {
      geographic_column: formData.geographic_column,
      selected_geojson_id: formData.selected_geojson_id,
      aggregate_column: formData.aggregate_column,
      aggregate_function: formData.aggregate_function,
      schema_name: formData.schema_name,
      table_name: formData.table_name,
      filters: formData.filters,
      current_payloads: {
        geojsonPreviewPayload: formData.geojsonPreviewPayload,
        dataOverlayPayload: formData.dataOverlayPayload,
      },
    });

    if (
      formData.geographic_column &&
      formData.selected_geojson_id &&
      formData.aggregate_column &&
      formData.aggregate_function &&
      formData.schema_name &&
      formData.table_name
    ) {
      // Check if we need to update preview payloads
      const currentFiltersHash = JSON.stringify(formData.filters || []);
      const payloadFiltersHash = JSON.stringify(formData.dataOverlayPayload?.chart_filters || []);

      const hasValidPayloads =
        formData.geojsonPreviewPayload?.geojsonId === formData.selected_geojson_id &&
        formData.dataOverlayPayload?.geographic_column === formData.geographic_column &&
        currentFiltersHash === payloadFiltersHash;

      console.log('🔄 [COUNTRY-LEVEL-CONFIG] Payload validation check:', {
        hasValidPayloads,
        reasons: {
          geojson_id_match:
            formData.geojsonPreviewPayload?.geojsonId === formData.selected_geojson_id,
          geographic_column_match:
            formData.dataOverlayPayload?.geographic_column === formData.geographic_column,
          filters_match: currentFiltersHash === payloadFiltersHash,
        },
        current_geojson_id: formData.geojsonPreviewPayload?.geojsonId,
        expected_geojson_id: formData.selected_geojson_id,
        current_geographic_column: formData.dataOverlayPayload?.geographic_column,
        expected_geographic_column: formData.geographic_column,
      });

      if (!hasValidPayloads) {
        const geojsonPayload = {
          geojsonId: formData.selected_geojson_id,
        };

        const dataOverlayPayload = {
          schema_name: formData.schema_name,
          table_name: formData.table_name,
          geographic_column: formData.geographic_column,
          value_column: formData.aggregate_column || formData.value_column,
          aggregate_function: formData.aggregate_function,
          selected_geojson_id: formData.selected_geojson_id,
          filters: {},
          chart_filters: formData.filters || [],
        };

        console.log('🚀 [COUNTRY-LEVEL-CONFIG] Auto-generating payloads:', {
          geojsonPayload,
          dataOverlayPayload,
        });

        onFormDataChange({
          geojsonPreviewPayload: geojsonPayload,
          dataOverlayPayload: dataOverlayPayload,
        });

        console.log('✅ [COUNTRY-LEVEL-CONFIG] Payloads generated and sent to parent');
      } else {
        console.log('⏭️ [COUNTRY-LEVEL-CONFIG] Payloads are valid, skipping generation');
      }
    } else {
      console.log('❌ [COUNTRY-LEVEL-CONFIG] Required conditions not met for payload generation');
    }
  }, [
    formData.geographic_column,
    formData.selected_geojson_id,
    formData.aggregate_column,
    formData.aggregate_function,
    formData.schema_name,
    formData.table_name,
    JSON.stringify(formData.filters || []), // FIX #4: Stable dependency for filters
    JSON.stringify(formData.geojsonPreviewPayload || {}), // Add current payloads as dependencies
    JSON.stringify(formData.dataOverlayPayload || {}),
    // FIX #4: Remove onFormDataChange from dependencies - it changes on every render
  ]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Globe className="h-4 w-4 text-blue-600" />
        <Label className="text-sm font-medium text-gray-900">1. Country & State Column</Label>
      </div>

      {/* Country Selection */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Select Country</Label>
        <p className="text-xs text-muted-foreground mb-2">
          Choose the country for your map visualization
        </p>
        <Select
          value={formData.country_code || 'IND'}
          onValueChange={handleCountryChange}
          disabled={disabled}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select country" />
          </SelectTrigger>
          <SelectContent>
            {(countries || []).map((country: Region) => (
              <SelectItem key={country.code} value={country.code || country.name}>
                {country.display_name || country.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Geographic Column Selection */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Geographic Column (States)</Label>
        <p className="text-xs text-muted-foreground mb-2">
          Select the column that contains state/province names from your data
        </p>
        <Select
          value={formData.geographic_column || ''}
          onValueChange={handleGeographicColumnChange}
          disabled={disabled}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select state column" />
          </SelectTrigger>
          <SelectContent>
            {allColumns.map((column) => (
              <SelectItem key={column.column_name} value={column.column_name!}>
                <span className="truncate" title={`${column.column_name} (${column.data_type})`}>
                  {column.column_name} ({column.data_type})
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Status Display */}
      <div className="flex flex-wrap gap-2">
        {formData.country_code && (
          <Badge variant="outline" className="bg-blue-50 text-blue-700">
            <Globe className="h-3 w-3 mr-1" />
            Country: {formData.country_code}
          </Badge>
        )}
        {formData.geographic_column && (
          <Badge variant="outline" className="bg-green-50 text-green-700">
            <MapPin className="h-3 w-3 mr-1" />
            Column: {formData.geographic_column}
          </Badge>
        )}
      </div>
    </div>
  );
}
