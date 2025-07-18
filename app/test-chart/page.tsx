'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSchemas, useTables, useColumns, useChartData } from '@/hooks/api/useChart';

export default function TestChartPage() {
  const [selectedSchema, setSelectedSchema] = useState<string>('');
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [selectedXAxis, setSelectedXAxis] = useState<string>('');
  const [selectedYAxis, setSelectedYAxis] = useState<string>('');
  const [testResult, setTestResult] = useState<string>('');

  // API hooks
  const { data: schemas, isLoading: schemasLoading, error: schemasError } = useSchemas();
  const { data: tables, isLoading: tablesLoading, error: tablesError } = useTables(selectedSchema);
  const {
    data: columns,
    isLoading: columnsLoading,
    error: columnsError,
  } = useColumns(selectedSchema, selectedTable);

  // Chart data payload
  const chartPayload =
    selectedSchema && selectedTable && selectedXAxis && selectedYAxis
      ? {
          chart_type: 'bar',
          computation_type: 'raw' as const,
          schema_name: selectedSchema,
          table: selectedTable,
          xaxis: selectedXAxis,
          yaxis: selectedYAxis,
          offset: 0,
          limit: 5,
        }
      : null;

  const {
    data: chartData,
    isLoading: chartLoading,
    error: chartError,
  } = useChartData(chartPayload);

  const testConnection = async () => {
    try {
      const response = await fetch('http://localhost:8002/api/visualization/charts/', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('authToken') || 'test-token'}`,
          'x-dalgo-org': localStorage.getItem('selectedOrg') || 'test-org',
        },
      });

      const data = await response.json();
      setTestResult(JSON.stringify(data, null, 2));
    } catch (error) {
      setTestResult(`Error: ${error.message}`);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Chart Integration Test</h1>

      {/* Connection Test */}
      <Card>
        <CardHeader>
          <CardTitle>1. API Connection Test</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <p>Auth Token: {localStorage.getItem('authToken') || 'Not set'}</p>
              <p>Selected Org: {localStorage.getItem('selectedOrg') || 'Not set'}</p>
            </div>
            <Button onClick={testConnection}>Test API Connection</Button>
            {testResult && (
              <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto max-h-40">
                {testResult}
              </pre>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Schema Selection */}
      <Card>
        <CardHeader>
          <CardTitle>2. Schema Selection</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Select value={selectedSchema} onValueChange={setSelectedSchema}>
              <SelectTrigger>
                <SelectValue
                  placeholder={schemasLoading ? 'Loading schemas...' : 'Select schema'}
                />
              </SelectTrigger>
              <SelectContent>
                {schemasError && (
                  <div className="text-red-500 p-2">Error: {schemasError.message}</div>
                )}
                {schemas?.map((schema: string) => (
                  <SelectItem key={schema} value={schema}>
                    {schema}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="text-sm text-gray-600">
              Status:{' '}
              {schemasLoading
                ? 'Loading...'
                : schemas
                  ? `${schemas.length} schemas found`
                  : 'No schemas'}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table Selection */}
      <Card>
        <CardHeader>
          <CardTitle>3. Table Selection</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Select
              value={selectedTable}
              onValueChange={setSelectedTable}
              disabled={!selectedSchema}
            >
              <SelectTrigger>
                <SelectValue placeholder={tablesLoading ? 'Loading tables...' : 'Select table'} />
              </SelectTrigger>
              <SelectContent>
                {tablesError && (
                  <div className="text-red-500 p-2">Error: {tablesError.message}</div>
                )}
                {tables?.map((table: string) => (
                  <SelectItem key={table} value={table}>
                    {table}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="text-sm text-gray-600">
              Status:{' '}
              {tablesLoading
                ? 'Loading...'
                : tables
                  ? `${tables.length} tables found`
                  : 'No tables'}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Column Selection */}
      <Card>
        <CardHeader>
          <CardTitle>4. Column Selection</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">X-Axis</label>
                <Select
                  value={selectedXAxis}
                  onValueChange={setSelectedXAxis}
                  disabled={!selectedTable}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={columnsLoading ? 'Loading...' : 'Select X-Axis'} />
                  </SelectTrigger>
                  <SelectContent>
                    {columnsError && (
                      <div className="text-red-500 p-2">Error: {columnsError.message}</div>
                    )}
                    {columns?.map((column: { name: string; data_type: string }) => (
                      <SelectItem key={column.name} value={column.name}>
                        {column.name} ({column.data_type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Y-Axis</label>
                <Select
                  value={selectedYAxis}
                  onValueChange={setSelectedYAxis}
                  disabled={!selectedTable}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={columnsLoading ? 'Loading...' : 'Select Y-Axis'} />
                  </SelectTrigger>
                  <SelectContent>
                    {columnsError && (
                      <div className="text-red-500 p-2">Error: {columnsError.message}</div>
                    )}
                    {columns?.map((column: { name: string; data_type: string }) => (
                      <SelectItem key={column.name} value={column.name}>
                        {column.name} ({column.data_type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="text-sm text-gray-600">
              Status:{' '}
              {columnsLoading
                ? 'Loading...'
                : columns
                  ? `${columns.length} columns found`
                  : 'No columns'}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Chart Preview */}
      <Card>
        <CardHeader>
          <CardTitle>5. Chart Data Generation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {chartLoading && <div>Loading chart data...</div>}
            {chartError && <div className="text-red-500">Error: {chartError.message}</div>}
            {chartData && (
              <div>
                <div className="text-green-600 mb-2">✅ Chart data generated successfully!</div>
                <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto max-h-60">
                  {JSON.stringify(chartData, null, 2)}
                </pre>
              </div>
            )}
            {!chartPayload && (
              <div className="text-gray-500">
                Select schema, table, and axes to generate chart data
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Debug Info */}
      <Card>
        <CardHeader>
          <CardTitle>Debug Info</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div>Selected Schema: {selectedSchema || 'None'}</div>
            <div>Selected Table: {selectedTable || 'None'}</div>
            <div>Selected X-Axis: {selectedXAxis || 'None'}</div>
            <div>Selected Y-Axis: {selectedYAxis || 'None'}</div>
            <div>Chart Payload: {chartPayload ? 'Ready' : 'Not ready'}</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
