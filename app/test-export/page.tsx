'use client';

import { DashboardExport } from '@/components/dashboard/DashboardExport';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function TestExportPage() {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-4">Export Test Page</h1>
        <p className="text-gray-600 mb-4">
          This page tests the dashboard export functionality with a simple canvas.
        </p>

        <DashboardExport
          dashboardTitle="Test Dashboard"
          canvasSelector=".test-canvas"
          variant="dropdown"
        />
      </div>

      <div
        className="test-canvas bg-white border border-gray-300 shadow-lg p-8"
        style={{ width: 800, height: 600 }}
      >
        <h2 className="text-xl font-bold mb-4">Test Dashboard Canvas</h2>

        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Chart 1</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-32 bg-blue-100 rounded flex items-center justify-center">
                <span className="text-blue-800">Sample Chart Data</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Chart 2</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-32 bg-green-100 rounded flex items-center justify-center">
                <span className="text-green-800">Another Chart</span>
              </div>
            </CardContent>
          </Card>

          <Card className="col-span-2">
            <CardHeader>
              <CardTitle>Wide Chart</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-24 bg-purple-100 rounded flex items-center justify-center">
                <span className="text-purple-800">Full Width Chart</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-4 text-sm text-gray-500">
          This is a test canvas to verify export functionality works correctly.
        </div>
      </div>
    </div>
  );
}
