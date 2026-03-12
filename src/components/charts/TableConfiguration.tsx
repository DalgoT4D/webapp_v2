'use client';

import { useState } from 'react';
import { Plus, X, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

interface TableConfigurationProps {
  availableColumns: string[];
  selectedColumns: string[];
  columnFormatting: Record<
    string,
    {
      type?: 'currency' | 'percentage' | 'date' | 'number' | 'text';
      precision?: number;
      prefix?: string;
      suffix?: string;
    }
  >;
  onColumnsChange: (columns: string[]) => void;
  onFormattingChange: (formatting: Record<string, any>) => void;
}

export function TableConfiguration({
  availableColumns,
  selectedColumns,
  columnFormatting,
  onColumnsChange,
  onFormattingChange,
}: TableConfigurationProps) {
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

  const handleFormattingChange = (column: string, field: string, value: any) => {
    const currentFormatting = columnFormatting[column] || {};
    const newFormatting = {
      ...columnFormatting,
      [column]: {
        ...currentFormatting,
        [field]: value,
      },
    };
    onFormattingChange(newFormatting);
  };

  return (
    <div className="space-y-6">
      {/* Column Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Column Selection</CardTitle>
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

      {/* Column Formatting */}
      {selectedColumns.length > 0 && (
        <Accordion type="single" collapsible>
          <AccordionItem value="formatting">
            <AccordionTrigger className="text-base font-semibold">
              Column Formatting
            </AccordionTrigger>
            <AccordionContent className="space-y-4">
              {selectedColumns.map((column) => {
                const formatting = columnFormatting[column] || {};

                return (
                  <div key={column} className="border rounded-lg p-4 space-y-3">
                    <div className="font-medium text-sm">{column}</div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Format Type</Label>
                        <Select
                          value={formatting.type || 'text'}
                          onValueChange={(value) => handleFormattingChange(column, 'type', value)}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="text">Text</SelectItem>
                            <SelectItem value="number">Number</SelectItem>
                            <SelectItem value="currency">Currency</SelectItem>
                            <SelectItem value="percentage">Percentage</SelectItem>
                            <SelectItem value="date">Date</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {(formatting.type === 'number' ||
                        formatting.type === 'currency' ||
                        formatting.type === 'percentage') && (
                        <div>
                          <Label className="text-xs">Decimal Places</Label>
                          <Input
                            type="number"
                            min="0"
                            max="10"
                            value={formatting.precision || 2}
                            onChange={(e) =>
                              handleFormattingChange(column, 'precision', parseInt(e.target.value))
                            }
                            className="h-8"
                          />
                        </div>
                      )}

                      <div>
                        <Label className="text-xs">Prefix</Label>
                        <Input
                          value={formatting.prefix || ''}
                          onChange={(e) => handleFormattingChange(column, 'prefix', e.target.value)}
                          placeholder="e.g., $, #"
                          className="h-8"
                        />
                      </div>

                      <div>
                        <Label className="text-xs">Suffix</Label>
                        <Input
                          value={formatting.suffix || ''}
                          onChange={(e) => handleFormattingChange(column, 'suffix', e.target.value)}
                          placeholder="e.g., %, units"
                          className="h-8"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
    </div>
  );
}
