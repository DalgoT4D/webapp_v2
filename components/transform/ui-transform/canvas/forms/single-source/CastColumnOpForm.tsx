// components/transform/canvas/forms/CastColumnOpForm.tsx
'use client';

import { useEffect, useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Search } from 'lucide-react';
import { Combobox, type ComboboxItem } from '@/components/ui/combobox';
import { FormActions } from '../shared/FormActions';
import { useOperationForm } from '../shared/useOperationForm';
import { apiGet } from '@/lib/api';
import { CAST_DATA_TYPES_OP } from '@/constants/transform';
import { getTypedConfig } from '@/types/transform';
import type { OperationFormProps } from '@/types/transform';

interface ColumnConfig {
  name: string;
  data_type: string;
}

/**
 * Form for casting (changing data type of) columns.
 * Allows casting multiple columns to different data types.
 */
export function CastColumnOpForm({
  node,
  operation,
  continueOperationChain,
  clearAndClosePanel,
  action,
  setLoading,
}: OperationFormProps) {
  // Uses hook for mode flags and submit; manages own srcColumns (ColumnConfig[])
  const { isViewMode, isEditMode, isSubmitting, submitOperation } = useOperationForm({
    node,
    action,
    operation,
    opType: CAST_DATA_TYPES_OP,
    continueOperationChain,
    setLoading,
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [srcColumns, setSrcColumns] = useState<ColumnConfig[]>(() => {
    if ((isEditMode || isViewMode) && node?.data?.operation_config?.config) {
      const config = getTypedConfig(CAST_DATA_TYPES_OP, node.data.operation_config);
      if (config?.source_columns) {
        return config.source_columns.map((col: string) => ({ name: col, data_type: '' }));
      }
    }
    if (node?.data?.output_columns) {
      return node.data.output_columns.map((col: string) => ({ name: col, data_type: '' }));
    }
    return [];
  });
  const [dataTypes, setDataTypes] = useState<string[]>([]);
  const [columnTypes, setColumnTypes] = useState<Record<string, string>>(() => {
    if ((isEditMode || isViewMode) && node?.data?.operation_config?.config) {
      const config = getTypedConfig(CAST_DATA_TYPES_OP, node.data.operation_config);
      if (config?.columns) {
        const typeMap: Record<string, string> = {};
        config.columns.forEach((col) => {
          typeMap[col.columnname] = col.columntype;
        });
        return typeMap;
      }
    }
    return {};
  });

  // Fetch data types
  useEffect(() => {
    const fetchDataTypes = async () => {
      try {
        const types = (await apiGet('/api/transform/dbt_project/data_type/')) as string[];
        setDataTypes(types);
      } catch (error) {
        console.error('Failed to fetch data types:', error);
        // Fallback common types
        setDataTypes([
          'VARCHAR',
          'INTEGER',
          'DECIMAL',
          'DATE',
          'TIMESTAMP',
          'BOOLEAN',
          'FLOAT',
          'TEXT',
        ]);
      }
    };
    fetchDataTypes();
  }, []);

  // Fetch source columns from node (create mode only - edit/view initialized from config)
  useEffect(() => {
    if (isEditMode || isViewMode) return;

    const fetchColumns = async () => {
      if (!node) return;

      const nodeType = node.type || node.data?.node_type;

      // For source/model nodes, try fetching column types from warehouse
      if (nodeType === 'source' || nodeType === 'model') {
        const model = node.data?.dbtmodel;
        if (model?.schema && model?.name) {
          try {
            const cols = (await apiGet(
              `/api/warehouse/table_columns/${model.schema}/${model.name}`
            )) as { name: string; data_type: string }[];
            setSrcColumns(cols);
            // Pre-populate existing types
            const typeMap: Record<string, string> = {};
            cols.forEach((col) => {
              if (col.data_type) typeMap[col.name] = col.data_type;
            });
            setColumnTypes((prev) => ({ ...prev, ...typeMap }));
            return;
          } catch {
            // Fall through to output_columns
          }
        }
      }

      // For operation nodes or fallback
      if (node.data?.output_columns) {
        const columns = node.data.output_columns.map((col: string) => ({
          name: col,
          data_type: '',
        }));
        setSrcColumns(columns);
      }
    };

    fetchColumns();
  }, [node, isEditMode, isViewMode]);

  // Filter columns based on search
  const filteredColumns = useMemo(() => {
    if (!searchTerm.trim()) return srcColumns;
    const search = searchTerm.toLowerCase();
    return srcColumns.filter((col) => col.name.toLowerCase().includes(search));
  }, [srcColumns, searchTerm]);

  // Merge warehouse types into the dataTypes list so existing column types always appear as valid options
  const allDataTypeItems: ComboboxItem[] = useMemo(() => {
    const warehouseTypes = Object.values(columnTypes).filter(Boolean);
    const merged = new Set([...dataTypes, ...warehouseTypes]);
    return Array.from(merged)
      .sort((a, b) => a.localeCompare(b))
      .map((type) => ({ value: type, label: type }));
  }, [dataTypes, columnTypes]);

  const handleTypeChange = (columnName: string, dataType: string) => {
    setColumnTypes((prev) => ({
      ...prev,
      [columnName]: dataType,
    }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Filter columns with types set
    const columnsTocast = Object.entries(columnTypes)
      .filter(([, type]) => type)
      .map(([name, type]) => ({
        columnname: name,
        columntype: type,
      }));

    if (columnsTocast.length === 0) {
      setFormError('Select at least one column type to cast');
      return;
    }

    setFormError(null);

    await submitOperation(
      {
        op_type: CAST_DATA_TYPES_OP,
        config: { columns: columnsTocast },
        source_columns: srcColumns.map((c) => c.name),
      },
      'Cast operation saved successfully'
    );
  };

  return (
    <form onSubmit={onSubmit} className="p-6 space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search columns..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
          disabled={isViewMode}
          data-testid="cast-search"
        />
      </div>

      {/* Header */}
      <div className="grid grid-cols-[1fr_1.2fr] gap-3 bg-muted px-4 py-3 rounded-t-md">
        <Label className="text-xs font-medium text-muted-foreground uppercase">Column Name</Label>
        <Label className="text-xs font-medium text-muted-foreground uppercase">Type</Label>
      </div>

      {/* Column List */}
      <div className="border rounded-md max-h-80 overflow-y-auto" data-testid="cast-column-list">
        {filteredColumns.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            {searchTerm ? 'No matching columns' : 'No columns available'}
          </div>
        ) : (
          <div className="divide-y">
            {filteredColumns.map((column) => (
              <div
                key={column.name}
                className="grid grid-cols-[1fr_1.2fr] gap-3 px-4 py-2 items-center"
              >
                <span className="text-sm font-medium truncate" title={column.name}>
                  {column.name}
                </span>
                <Combobox
                  mode="single"
                  items={allDataTypeItems}
                  value={columnTypes[column.name] || ''}
                  onValueChange={(value) => handleTypeChange(column.name, value)}
                  placeholder="Select type"
                  searchPlaceholder="Search types..."
                  emptyMessage="No matching types."
                  noItemsMessage="No types available."
                  disabled={isViewMode}
                  id={`cast-type-${column.name}`}
                  compact
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {formError && <p className="text-sm text-destructive">{formError}</p>}

      {/* Info */}
      <p className="text-xs text-muted-foreground">
        Only columns with selected types will be cast.
      </p>

      {/* Actions */}
      <FormActions
        isViewMode={isViewMode}
        isSubmitting={isSubmitting}
        onCancel={clearAndClosePanel}
      />
    </form>
  );
}
