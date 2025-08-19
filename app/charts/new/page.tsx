'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ChevronLeft,
  BarChart2,
  PieChart,
  LineChart,
  Hash,
  MapPin,
  Database,
  Search,
  ChevronDown,
} from 'lucide-react';
import { useAllSchemaTables } from '@/hooks/api/useChart';
import { cn } from '@/lib/utils';
import Link from 'next/link';

// Chart type definitions with descriptions
const chartTypes = [
  {
    id: 'bar',
    name: 'Bar Chart',
    description: 'Compare values across categories',
    icon: BarChart2,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
  },
  {
    id: 'pie',
    name: 'Pie Chart',
    description: 'Show proportions of a whole',
    icon: PieChart,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
  },
  {
    id: 'line',
    name: 'Line Chart',
    description: 'Display trends over time',
    icon: LineChart,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
  },
  {
    id: 'number',
    name: 'Number',
    description: 'Display key metrics and KPIs',
    icon: Hash,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
  },
  {
    id: 'map',
    name: 'Map',
    description: 'Visualize geographic data',
    icon: MapPin,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
  },
];

export default function NewChartPage() {
  const router = useRouter();
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [selectedSchema, setSelectedSchema] = useState<string>('');
  const [selectedChartType, setSelectedChartType] = useState<string>('');
  const [searchTable, setSearchTable] = useState<string>('');

  // Use the new hook that properly handles all schemas/tables
  const { data: allTables, isLoading: isLoadingTables, error } = useAllSchemaTables();

  // Filter tables based on search
  const filteredTables = useMemo(() => {
    if (!allTables.length) return [];
    if (!searchTable.trim()) return allTables;

    const search = searchTable.toLowerCase();
    return allTables.filter(
      (table) =>
        table.full_name.toLowerCase().includes(search) ||
        table.table_name.toLowerCase().includes(search) ||
        table.schema_name.toLowerCase().includes(search)
    );
  }, [allTables, searchTable]);

  const canProceed = selectedSchema && selectedTable && selectedChartType;

  const handleContinue = () => {
    if (!canProceed) return;

    // Navigate to configure with selected parameters
    const params = new URLSearchParams({
      schema: selectedSchema,
      table: selectedTable,
      type: selectedChartType,
    });

    router.push(`/charts/new/configure?${params.toString()}`);
  };

  const handleTableSelect = (fullTableName: string) => {
    const [schema, table] = fullTableName.split('.');
    setSelectedSchema(schema);
    setSelectedTable(table);
    setSearchTable(''); // Clear search after selection
  };

  const handleCancel = () => {
    router.push('/charts');
  };

  return (
    <div className="px-8 py-6 ml-0">
      {/* Header with Back button */}
      <div className="flex items-center gap-4 mb-8">
        <Link href="/charts">
          <Button variant="ghost" size="icon">
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Create a new chart</h1>
          <p className="text-muted-foreground mt-1">Select your dataset and choose a chart type</p>
        </div>
      </div>

      <div className="max-w-5xl space-y-8">
        {/* Dataset Selection */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-medium">
              1
            </div>
            <h2 className="text-xl font-semibold">Choose a dataset</h2>
          </div>

          <div className="space-y-4">
            {/* Table Selection with Integrated Search Dropdown */}
            <div>
              <label className="block text-sm font-medium mb-2">Table</label>
              <Select
                value={selectedTable ? `${selectedSchema}.${selectedTable}` : ''}
                onValueChange={handleTableSelect}
                disabled={isLoadingTables}
              >
                <SelectTrigger className="h-14 w-full max-w-lg">
                  <div className="flex items-center gap-2 w-full">
                    <Search className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                    <SelectValue
                      placeholder={
                        isLoadingTables ? 'Loading tables...' : 'Search and select a table...'
                      }
                      className="text-base"
                    />
                  </div>
                </SelectTrigger>
                <SelectContent className="max-h-80 w-full min-w-[500px]">
                  <div className="sticky top-0 bg-background border-b p-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                      <Input
                        placeholder="Type to search tables..."
                        value={searchTable}
                        onChange={(e) => setSearchTable(e.target.value)}
                        className="pl-10 h-9 text-sm"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  </div>
                  <div className="max-h-64 overflow-auto">
                    {isLoadingTables ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">
                        Loading tables from all schemas...
                      </div>
                    ) : filteredTables.length === 0 ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">
                        {searchTable ? 'No tables match your search' : 'No tables found'}
                      </div>
                    ) : (
                      filteredTables.map((table) => (
                        <SelectItem key={table.full_name} value={table.full_name}>
                          <div className="flex items-center gap-2">
                            <Database className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                            <span className="font-mono text-sm">{table.full_name}</span>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </div>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Chart Type Selection */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-medium">
              2
            </div>
            <h2 className="text-xl font-semibold">Choose chart type</h2>
          </div>

          <div className="flex flex-wrap gap-4">
            {chartTypes.map((chart) => {
              const IconComponent = chart.icon;
              const isSelected = selectedChartType === chart.id;

              return (
                <Card
                  key={chart.id}
                  className={cn(
                    'cursor-pointer transition-all duration-200 hover:shadow-md flex-1 min-w-0',
                    isSelected && 'ring-2 ring-blue-600 shadow-md'
                  )}
                  onClick={() => setSelectedChartType(chart.id)}
                >
                  <CardContent className="p-6 h-32">
                    <div className="flex flex-col items-center justify-center gap-3 text-center h-full">
                      <div className={cn('p-3 rounded-lg', chart.bgColor)}>
                        <IconComponent className={cn('w-6 h-6', chart.color)} />
                      </div>
                      <div>
                        <h3 className="font-medium text-sm">{chart.name}</h3>
                        <p className="text-xs text-muted-foreground mt-1">{chart.description}</p>
                        {isSelected && (
                          <Badge variant="default" className="bg-blue-600 text-xs mt-2">
                            Selected
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Actions */}
      <Separator className="my-8" />
      <div className="flex justify-between items-center">
        <Button variant="outline" onClick={handleCancel}>
          Cancel
        </Button>
        <Button onClick={handleContinue} disabled={!canProceed} className="min-w-[120px]">
          Continue
        </Button>
      </div>
    </div>
  );
}
