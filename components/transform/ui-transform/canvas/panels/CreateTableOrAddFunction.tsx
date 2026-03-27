// components/transform/canvas/panels/CreateTableOrAddFunction.tsx
'use client';

import { Button } from '@/components/ui/button';
import { Table, Plus } from 'lucide-react';

interface CreateTableOrAddFunctionProps {
  /** Callback when "Create a table" is clicked */
  onCreateTable: () => void;
  /** Callback when "Add function" is clicked */
  onAddFunction: () => void;
  /** Whether to show the "Add function" button (default: true) */
  showAddFunction?: boolean;
}

/**
 * Choice panel shown after saving an operation.
 * Allows user to either terminate the chain (create table)
 * or continue adding more operations.
 */
export function CreateTableOrAddFunction({
  onCreateTable,
  onAddFunction,
  showAddFunction = true,
}: CreateTableOrAddFunctionProps) {
  return (
    <div className="flex flex-col gap-6 p-8" data-testid="create-table-or-add-function">
      <Button
        variant="outline"
        size="lg"
        onClick={onCreateTable}
        className="w-full justify-start gap-3 h-14 text-base"
        data-testid="create-table-btn"
      >
        <Table className="w-5 h-5 text-teal-600" />
        Create a table
      </Button>

      {showAddFunction && (
        <Button
          variant="outline"
          size="lg"
          onClick={onAddFunction}
          className="w-full justify-start gap-3 h-14 text-base"
          data-testid="add-function-btn"
        >
          <Plus className="w-5 h-5 text-teal-600" />
          Add function
        </Button>
      )}
    </div>
  );
}
