'use client';

import { useState } from 'react';
import {
  Plus,
  BarChart2,
  PieChart,
  LineChart,
  MoreVertical,
  Edit,
  Trash,
  Star,
  StarOff,
} from 'lucide-react';
import Link from 'next/link';
import { useCharts, useDeleteChart, useUpdateChart } from '@/hooks/api/useChart';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { format } from 'date-fns';
import { toast } from 'sonner';
import type { Chart } from '@/types/charts';

const chartIcons = {
  bar: BarChart2,
  pie: PieChart,
  line: LineChart,
};

export default function ChartsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteChartId, setDeleteChartId] = useState<number | null>(null);
  const { data: charts, isLoading, error, mutate } = useCharts();
  const { trigger: deleteChart } = useDeleteChart();
  const { trigger: updateChart } = useUpdateChart();

  const filteredCharts = charts?.filter(
    (chart) =>
      chart.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      chart.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDelete = async () => {
    if (!deleteChartId) return;

    try {
      await deleteChart(deleteChartId);
      toast.success('Chart deleted successfully');
      mutate();
      setDeleteChartId(null);
    } catch (error) {
      toast.error('Failed to delete chart');
    }
  };

  const handleToggleFavorite = async (chart: Chart) => {
    try {
      await updateChart({
        id: chart.id,
        data: { is_favorite: !chart.is_favorite },
      });
      toast.success(chart.is_favorite ? 'Removed from favorites' : 'Added to favorites');
      mutate();
    } catch (error) {
      toast.error('Failed to update favorite status');
    }
  };

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center text-red-600">
          Failed to load charts. Please try again later.
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Charts</h1>
          <p className="text-muted-foreground mt-1">Create and manage your data visualizations</p>
        </div>
        <Link href="/charts/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create Chart
          </Button>
        </Link>
      </div>

      <div className="mb-6">
        <Input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search charts..."
          className="max-w-sm"
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2 mt-2"></div>
              </CardHeader>
              <CardContent>
                <div className="h-20 bg-gray-200 rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredCharts?.length === 0 ? (
        <div className="text-center py-12">
          <BarChart2 className="mx-auto h-12 w-12 text-gray-400" />
          <p className="mt-4 text-lg text-gray-600">No charts found</p>
          <p className="text-sm text-gray-500 mt-1">
            {searchTerm ? 'Try a different search term or ' : ''}
            <Link href="/charts/new" className="text-primary hover:underline">
              create your first chart
            </Link>
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCharts?.map((chart) => {
            const IconComponent =
              chartIcons[chart.chart_type as keyof typeof chartIcons] || BarChart2;

            return (
              <Card key={chart.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2">
                      <IconComponent className="h-5 w-5 text-primary" />
                      <CardTitle className="text-lg">{chart.title}</CardTitle>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/charts/${chart.id}`}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleFavorite(chart)}>
                          {chart.is_favorite ? (
                            <>
                              <StarOff className="mr-2 h-4 w-4" />
                              Remove from favorites
                            </>
                          ) : (
                            <>
                              <Star className="mr-2 h-4 w-4" />
                              Add to favorites
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setDeleteChartId(chart.id)}
                          className="text-red-600"
                        >
                          <Trash className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  {chart.description && (
                    <CardDescription className="mt-1 line-clamp-2">
                      {chart.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center justify-between">
                      <span>Type:</span>
                      <span className="capitalize">{chart.chart_type}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Source:</span>
                      <span className="font-mono text-xs">
                        {chart.schema_name}.{chart.table_name}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Updated:</span>
                      <span>{format(new Date(chart.updated_at), 'MMM d, yyyy')}</span>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <Link href={`/charts/${chart.id}`}>
                      <Button variant="outline" size="sm" className="w-full">
                        View Chart
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AlertDialog open={deleteChartId !== null} onOpenChange={() => setDeleteChartId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Chart</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this chart? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
