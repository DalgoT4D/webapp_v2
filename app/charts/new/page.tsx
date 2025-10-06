'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  ChevronLeft,
  BarChart2,
  PieChart,
  LineChart,
  Hash,
  MapPin,
  Table,
  Lock,
  ArrowLeft,
} from 'lucide-react';
import { DatasetSelector } from '@/components/charts/DatasetSelector';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useUserPermissions } from '@/hooks/api/usePermissions';

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
  {
    id: 'table',
    name: 'Table',
    description: 'Display data in rows and columns',
    icon: Table,
    color: 'text-slate-600',
    bgColor: 'bg-slate-50',
  },
];

export default function NewChartPage() {
  const router = useRouter();
  const { hasPermission } = useUserPermissions();
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [selectedSchema, setSelectedSchema] = useState<string>('');
  const [selectedChartType, setSelectedChartType] = useState<string>('');

  // Check if user has create permissions
  if (!hasPermission('can_create_charts')) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <Lock className="w-6 h-6 text-red-600" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-muted-foreground mb-4">You don't have permission to create charts.</p>
          <Button variant="outline" onClick={() => router.push('/charts')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Charts
          </Button>
        </div>
      </div>
    );
  }

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

  const handleDatasetChange = (schema: string, table: string) => {
    setSelectedSchema(schema);
    setSelectedTable(table);
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

          <DatasetSelector
            schema_name={selectedSchema}
            table_name={selectedTable}
            onDatasetChange={handleDatasetChange}
            className="max-w-lg"
          />
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
        <Button variant="cancel" onClick={handleCancel}>
          Cancel
        </Button>
        <Button onClick={handleContinue} disabled={!canProceed} className="min-w-[120px]">
          Continue
        </Button>
      </div>
    </div>
  );
}
