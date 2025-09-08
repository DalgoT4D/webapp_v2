import React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BarChart3, Eye, Edit, Trash2, Globe, Lock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Chart {
  id: number;
  title: string;
  chart_type: string;
  created_at: string;
  updated_at: string;
  is_public: boolean;
  config?: any;
}

interface ChartCardProps {
  chart: Chart;
  onView: (chart: Chart) => void;
  onEdit: (chart: Chart) => void;
  onDelete: (chart: Chart) => void;
}

export default function ChartCard({ chart, onView, onEdit, onDelete }: ChartCardProps) {
  const getChartIcon = () => {
    switch (chart.chart_type) {
      case 'bar':
      case 'line':
      case 'pie':
      case 'echarts':
      case 'recharts':
      case 'nivo':
        return <BarChart3 className="h-5 w-5" />;
      default:
        return <BarChart3 className="h-5 w-5" />;
    }
  };

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            {getChartIcon()}
            <CardTitle className="text-lg">{chart.title}</CardTitle>
          </div>
          <Badge
            variant={chart.is_public ? 'secondary' : 'outline'}
            className="flex items-center gap-1"
          >
            {chart.is_public ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
            {chart.is_public ? 'Public' : 'Private'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-sm text-muted-foreground">
          Updated {formatDistanceToNow(new Date(chart.updated_at), { addSuffix: true })}
        </div>
      </CardContent>
      <CardFooter className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={() => onView(chart)}>
          <Eye className="h-4 w-4 mr-1" />
          View
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onEdit(chart)}>
          <Edit className="h-4 w-4 mr-1" />
          Edit
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(chart)}
          className="text-destructive"
        >
          <Trash2 className="h-4 w-4 mr-1" />
          Delete
        </Button>
      </CardFooter>
    </Card>
  );
}
