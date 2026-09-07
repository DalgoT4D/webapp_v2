import { Badge } from '@/components/ui/badge';

interface AccessBadgeProps {
  level?: 'view' | 'edit' | 'owner' | string | null;
  className?: string;
}

const CONFIG: Record<string, { label: string; className: string }> = {
  owner: { label: 'Owner', className: 'bg-primary/10 text-primary border-primary/20' },
  edit: { label: 'Edit', className: 'bg-green-50 text-green-700 border-green-200' },
  view: { label: 'View', className: 'bg-gray-100 text-gray-600 border-gray-200' },
};

export function AccessBadge({ level, className }: AccessBadgeProps) {
  if (!level) return null;
  const cfg = CONFIG[level];
  if (!cfg) return null;
  return (
    <Badge variant="outline" className={`text-xs font-normal ${cfg.className} ${className ?? ''}`}>
      {cfg.label}
    </Badge>
  );
}
