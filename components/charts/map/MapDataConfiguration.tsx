'use client';

import { useState, useEffect } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAvailableGeoJSONs, useSchemas, useTables, useColumns } from '@/hooks/api/useChart';

interface MapDataConfigurationProps {
  formData: any;
  onFormDataChange: (data: any) => void;
}

export function MapDataConfiguration({ formData, onFormDataChange }: MapDataConfigurationProps) {
  // Fetch warehouse data
  const { data: schemas } = useSchemas();
  const { data: tables } = useTables(formData.schema_name || null);
  const { data: columns } = useColumns(formData.schema_name || null, formData.table_name || null);

  // Get available GeoJSONs
  const { data: geojsons, isLoading: geojsonsLoading } = useAvailableGeoJSONs(
    formData.country_code || 'IND',
    formData.layer_level || 1
  );

  // Handler functions
  const handleSchemaChange = (schema_name: string) => {
    onFormDataChange({
      ...formData,
      schema_name,
      table_name: undefined,
      geographic_column: undefined,
      value_column: undefined,
    });
  };

  const handleTableChange = (table_name: string) => {
    onFormDataChange({
      ...formData,
      table_name,
      geographic_column: undefined,
      value_column: undefined,
    });
  };

  // Filter numeric columns for value selection (with safety check)
  const numericColumns = (columns || []).filter((col) =>
    ['integer', 'numeric', 'bigint', 'float', 'double', 'decimal'].includes(
      col.data_type?.toLowerCase()
    )
  );

  return (
    <div className="space-y-6">
      {/* Basic Chart Info */}
      <div className="grid grid-cols-1 gap-4">
        <div>
          <Label htmlFor="title">Chart Title</Label>
          <Input
            id="title"
            value={formData.title || ''}
            onChange={(e) => onFormDataChange({ ...formData, title: e.target.value })}
            placeholder="Enter chart title"
          />
        </div>

        <div>
          <Label htmlFor="description">Description (Optional)</Label>
          <Textarea
            id="description"
            value={formData.description || ''}
            onChange={(e) => onFormDataChange({ ...formData, description: e.target.value })}
            placeholder="Enter chart description"
            rows={2}
          />
        </div>
      </div>

      {/* Schema Selection */}
      <div>
        <Label htmlFor="schema">Schema</Label>
        <p className="text-xs text-muted-foreground mb-2">
          Select the database schema containing your data
        </p>
        <Select value={formData.schema_name || ''} onValueChange={handleSchemaChange}>
          <SelectTrigger id="schema">
            <SelectValue placeholder="Select a schema" />
          </SelectTrigger>
          <SelectContent>
            {(schemas || []).map((schema: string) => (
              <SelectItem key={schema} value={schema}>
                {schema}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table Selection */}
      <div>
        <Label htmlFor="table">Table</Label>
        <p className="text-xs text-muted-foreground mb-2">
          Select the table containing your geographic data
        </p>
        <Select
          value={formData.table_name || ''}
          onValueChange={handleTableChange}
          disabled={!formData.schema_name}
        >
          <SelectTrigger id="table">
            <SelectValue
              placeholder={!formData.schema_name ? 'Select a schema first' : 'Select a table'}
            />
          </SelectTrigger>
          <SelectContent>
            {(tables || []).map((table: any) => {
              const tableName = typeof table === 'string' ? table : table.table_name;
              return (
                <SelectItem key={tableName} value={tableName}>
                  {tableName}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {/* Geographic Column */}
      <div>
        <Label className="text-sm font-medium">Geographic Column</Label>
        <p className="text-xs text-muted-foreground mb-2">
          Select the column containing region names (e.g., state names, district names)
        </p>
        <Select
          value={formData.geographic_column || ''}
          onValueChange={(value) =>
            onFormDataChange({
              ...formData,
              geographic_column: value,
            })
          }
          disabled={!formData.schema_name || !formData.table_name}
        >
          <SelectTrigger>
            <SelectValue
              placeholder={
                !formData.table_name ? 'Select a table first' : 'Select column with region names'
              }
            />
          </SelectTrigger>
          <SelectContent>
            {(columns || []).map((col) => (
              <SelectItem key={col.name} value={col.name}>
                {col.name} ({col.data_type})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Value Column */}
      <div>
        <Label className="text-sm font-medium">Value Column</Label>
        <p className="text-xs text-muted-foreground mb-2">
          Select the numeric column with values to visualize on the map
        </p>
        <Select
          value={formData.value_column || ''}
          onValueChange={(value) =>
            onFormDataChange({
              ...formData,
              value_column: value,
            })
          }
          disabled={!formData.schema_name || !formData.table_name}
        >
          <SelectTrigger>
            <SelectValue
              placeholder={
                !formData.table_name ? 'Select a table first' : 'Select column with values'
              }
            />
          </SelectTrigger>
          <SelectContent>
            {numericColumns.map((col) => (
              <SelectItem key={col.name} value={col.name}>
                {col.name} ({col.data_type})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Aggregate Function */}
      <div>
        <Label className="text-sm font-medium">Aggregate Function</Label>
        <p className="text-xs text-muted-foreground mb-2">How to aggregate the values by region</p>
        <Select
          value={formData.aggregate_function || 'sum'}
          onValueChange={(value) =>
            onFormDataChange({
              ...formData,
              aggregate_function: value,
            })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Select aggregate function" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="sum">Sum</SelectItem>
            <SelectItem value="avg">Average</SelectItem>
            <SelectItem value="count">Count</SelectItem>
            <SelectItem value="min">Minimum</SelectItem>
            <SelectItem value="max">Maximum</SelectItem>
            <SelectItem value="count_distinct">Count Distinct</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* GeoJSON Selection */}
      <div>
        <Label className="text-sm font-medium">Map Layer</Label>
        <p className="text-xs text-muted-foreground mb-2">
          Select the geographic map to use for visualization
        </p>
        <Select
          value={formData.selected_geojson_id?.toString() || ''}
          onValueChange={(value) =>
            onFormDataChange({
              ...formData,
              selected_geojson_id: parseInt(value),
            })
          }
          disabled={geojsonsLoading}
        >
          <SelectTrigger>
            <SelectValue placeholder={geojsonsLoading ? 'Loading...' : 'Select map layer'} />
          </SelectTrigger>
          <SelectContent>
            {geojsons?.map((geojson) => (
              <SelectItem key={geojson.id} value={geojson.id.toString()}>
                {geojson.display_name}
                {!geojson.is_default && ' (Custom)'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Country and Layer Level Controls */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-sm font-medium">Country</Label>
          <Select
            value={formData.country_code || 'IND'}
            onValueChange={(value) =>
              onFormDataChange({
                ...formData,
                country_code: value,
                selected_geojson_id: null, // Reset selection when country changes
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="IND">India</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-sm font-medium">Layer Level</Label>
          <Select
            value={formData.layer_level?.toString() || '1'}
            onValueChange={(value) =>
              onFormDataChange({
                ...formData,
                layer_level: parseInt(value),
                selected_geojson_id: null, // Reset selection when layer changes
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Country</SelectItem>
              <SelectItem value="1">States/Provinces</SelectItem>
              <SelectItem value="2">Districts/Counties</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
