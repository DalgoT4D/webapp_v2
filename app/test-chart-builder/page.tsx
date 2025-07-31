'use client';

import { useState } from 'react';
import { ChartBuilder } from '@/components/charts/ChartBuilder';
import type { ChartCreate } from '@/types/charts';

export default function TestChartBuilderPage() {
  const [log, setLog] = useState<string[]>(['Page loaded']);

  const addLog = (message: string) => {
    setLog((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  const handleSave = async (data: ChartCreate) => {
    addLog('Save called with data: ' + JSON.stringify(data));
  };

  const handleCancel = () => {
    addLog('Cancel clicked');
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Chart Builder Test Page</h1>

      <div className="mb-4 p-4 bg-gray-100 rounded">
        <h2 className="font-semibold mb-2">Debug Log:</h2>
        <div className="font-mono text-sm">
          {log.map((entry, index) => (
            <div key={`log-${index}`}>{entry}</div>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <p className="text-sm text-gray-600">
          This is a test page to verify ChartBuilder component renders correctly.
        </p>
        <p className="text-sm text-gray-600">
          Navigate to this page at: <code className="bg-gray-200 px-1">/test-chart-builder</code>
        </p>
      </div>

      <div className="border-2 border-blue-300 p-4 rounded">
        <h2 className="text-lg font-semibold mb-4">ChartBuilder Component:</h2>
        <ChartBuilder onSave={handleSave} onCancel={handleCancel} />
      </div>
    </div>
  );
}
