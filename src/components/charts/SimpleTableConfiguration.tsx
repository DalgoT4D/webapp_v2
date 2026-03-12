'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface SimpleTableConfigurationProps {
  availableColumns: string[];
  selectedColumns: string[];
  onColumnsChange: (columns: string[]) => void;
}

export function SimpleTableConfiguration({
  availableColumns,
  selectedColumns,
  onColumnsChange,
}: SimpleTableConfigurationProps) {
  const handleColumnToggle = (column: string, checked: boolean) => {
    if (checked) {
      onColumnsChange([...selectedColumns, column]);
    } else {
      onColumnsChange(selectedColumns.filter((col) => col !== column));
    }
  };

  const handleSelectAllColumns = () => {
    onColumnsChange(availableColumns);
  };

  const handleClearAllColumns = () => {
    onColumnsChange([]);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Table Columns</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2 mb-4">
          <Button variant="outline" size="sm" onClick={handleSelectAllColumns}>
            Select All
          </Button>
          <Button variant="outline" size="sm" onClick={handleClearAllColumns}>
            Clear All
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
          {availableColumns.map((column) => (
            <div key={column} className="flex items-center space-x-2">
              <Checkbox
                id={column}
                checked={selectedColumns.includes(column)}
                onCheckedChange={(checked) => handleColumnToggle(column, checked as boolean)}
              />
              <Label
                htmlFor={column}
                className="text-sm font-normal cursor-pointer truncate"
                title={column}
              >
                {column}
              </Label>
            </div>
          ))}
        </div>

        <div className="text-sm text-muted-foreground">
          Selected {selectedColumns.length} of {availableColumns.length} columns
        </div>
      </CardContent>
    </Card>
  );
}
