'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardBuilderV2 } from '@/components/dashboard/dashboard-builder-v2';
import { createDashboard } from '@/hooks/api/useDashboards';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function CreateDashboardPage() {
  const router = useRouter();
  const [step, setStep] = useState<'details' | 'builder'>('details');
  const [dashboardId, setDashboardId] = useState<number | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [gridColumns, setGridColumns] = useState(12);

  const handleCreate = async () => {
    if (!title.trim()) {
      toast({
        title: 'Title required',
        description: 'Please enter a title for your dashboard',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);
    try {
      const dashboard = await createDashboard({
        title,
        description,
        grid_columns: gridColumns,
      });

      setDashboardId(dashboard.id);
      setStep('builder');

      toast({
        title: 'Dashboard created',
        description: 'You can now add components to your dashboard',
      });
    } catch (error: any) {
      toast({
        title: 'Failed to create dashboard',
        description: error.message || 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  if (step === 'builder' && dashboardId) {
    return (
      <div className="h-screen flex flex-col">
        <div className="border-b px-6 py-3 bg-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboards">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Dashboards
                </Button>
              </Link>
              <div>
                <h1 className="text-xl font-semibold">{title}</h1>
                {description && <p className="text-sm text-gray-500">{description}</p>}
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          <DashboardBuilderV2
            dashboardId={dashboardId}
            initialData={{
              title,
              description,
              grid_columns: gridColumns,
              layout_config: [],
              components: {},
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 max-w-2xl">
      <div className="mb-6">
        <Link href="/dashboards">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboards
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create New Dashboard</CardTitle>
          <CardDescription>Set up your dashboard details before building</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="title">Dashboard Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Sales Performance Dashboard"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this dashboard is for..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="grid-columns">Grid Columns</Label>
            <select
              id="grid-columns"
              value={gridColumns}
              onChange={(e) => setGridColumns(Number(e.target.value))}
              className="w-full px-3 py-2 border rounded-md"
            >
              <option value={12}>12 Columns (Default)</option>
              <option value={14}>14 Columns</option>
              <option value={16}>16 Columns</option>
            </select>
            <p className="text-sm text-gray-500">
              More columns provide finer control over component placement
            </p>
          </div>

          <div className="flex justify-end gap-3">
            <Link href="/dashboards">
              <Button variant="outline">Cancel</Button>
            </Link>
            <Button onClick={handleCreate} disabled={isCreating || !title.trim()}>
              {isCreating ? 'Creating...' : 'Create & Build'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
