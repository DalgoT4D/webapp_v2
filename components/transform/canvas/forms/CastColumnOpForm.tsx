// components/transform/canvas/forms/CastColumnOpForm.tsx
'use client';

import { useEffect, useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Search } from 'lucide-react';
import { toastSuccess, toastError } from '@/lib/toast';
import { Combobox, type ComboboxItem } from '@/components/ui/combobox';
import { useCanvasOperations } from '@/hooks/api/useCanvasOperations';
import { FormActions } from './shared/FormActions';
import { apiGet } from '@/lib/api';
import type {
  OperationFormProps,
  CastDataConfig,
  ModelSrcOtherInputPayload,
} from '@/types/transform';

interface ColumnConfig {
  name: string;
  data_type: string;
}

interface FormValues {
  columns: ColumnConfig[];
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
  const isViewMode = action === 'view';
  const isEditMode = action === 'edit';

  const [searchTerm, setSearchTerm] = useState('');
  const [srcColumns, setSrcColumns] = useState<ColumnConfig[]>([]);
  const [dataTypes, setDataTypes] = useState<string[]>([]);
  const [columnTypes, setColumnTypes] = useState<Record<string, string>>({});

  const { createOperation, editOperation, isCreating, isEditing } = useCanvasOperations();

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

  // Fetch source columns from node
  useEffect(() => {
    const fetchColumns = async () => {
      if (!node) return;

      const nodeType = node.type || node.data?.node_type;

      // For source/model nodes, try fetching column types from warehouse
      if (nodeType === 'source' || nodeType === 'model') {
        const model = node.data?.dbtmodel;
        if (model?.schema && model?.name) {
          try {
            const cols = (await apiGet(
              `/api/warehouse/table_columns/${model.schema}/${model.name}/`
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
  }, [node]);

  // Load existing config in edit mode
  useEffect(() => {
    if ((isEditMode || isViewMode) && node?.data?.operation_config) {
      const config = node.data.operation_config.config as unknown as CastDataConfig;
      if (config?.columns) {
        const typeMap: Record<string, string> = {};
        config.columns.forEach((col) => {
          typeMap[col.columnname] = col.columntype;
        });
        setColumnTypes(typeMap);
      }
      if (config?.source_columns) {
        const columns = config.source_columns.map((col: string) => ({
          name: col,
          data_type: '',
        }));
        setSrcColumns(columns);
      }
    }
  }, [isEditMode, isViewMode, node]);

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

    if (!node?.id) {
      toastError.api('No node selected');
      return;
    }

    // Filter columns with types set
    const columnsTocast = Object.entries(columnTypes)
      .filter(([, type]) => type)
      .map(([name, type]) => ({
        columnname: name,
        columntype: type,
      }));

    if (columnsTocast.length === 0) {
      toastError.api('Select at least one column type to cast');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        op_type: operation.slug,
        config: { columns: columnsTocast },
        source_columns: srcColumns.map((c) => c.name),
        other_inputs: [] as ModelSrcOtherInputPayload[],
      };

      const finalAction = node.data?.isDummy ? 'create' : action;
      let createdNodeUuid: string | undefined;
      if (finalAction === 'edit') {
        await editOperation(node.id, payload);
      } else {
        const response = await createOperation(node.id, {
          ...payload,
          input_node_uuid: node.id,
        });
        createdNodeUuid = response?.uuid;
      }

      toastSuccess.generic('Cast operation saved successfully');
      continueOperationChain(createdNodeUuid);
    } catch (error) {
      console.error('Failed to save cast operation:', error);
      toastError.save(error, 'operation');
    } finally {
      setLoading(false);
    }
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

      {/* Info */}
      <p className="text-xs text-muted-foreground">
        Only columns with selected types will be cast.
      </p>

      {/* Actions */}
      <FormActions
        isViewMode={isViewMode}
        isSubmitting={isCreating || isEditing}
        onCancel={clearAndClosePanel}
      />
    </form>
  );
}
