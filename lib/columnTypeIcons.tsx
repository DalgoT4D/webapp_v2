import { Hash, CaseLower, Clock, Binary, Braces, HelpCircle } from 'lucide-react';
import { LucideIcon } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export type ColumnDataType =
  | 'integer'
  | 'bigint'
  | 'numeric'
  | 'double precision'
  | 'real'
  | 'float'
  | 'decimal'
  | 'varchar'
  | 'text'
  | 'char'
  | 'character varying'
  | 'timestamp'
  | 'timestamptz'
  | 'date'
  | 'datetime'
  | 'time'
  | 'boolean'
  | 'bool'
  | 'json'
  | 'jsonb'
  | string;

interface ColumnTypeConfig {
  icon: LucideIcon;
  label: string;
  color: string;
}

const numericTypes = [
  'integer',
  'bigint',
  'numeric',
  'double precision',
  'real',
  'float',
  'decimal',
  'smallint',
  'int',
  'int4',
  'int8',
  'float4',
  'float8',
];

const textTypes = ['varchar', 'text', 'char', 'character varying', 'string', 'character'];

const dateTimeTypes = ['timestamp', 'timestamptz', 'date', 'datetime', 'time', 'interval'];

const booleanTypes = ['boolean', 'bool'];

const jsonTypes = ['json', 'jsonb'];

export function getColumnTypeConfig(dataType: string): ColumnTypeConfig {
  const normalizedType = dataType.toLowerCase().trim();

  if (numericTypes.some((t) => normalizedType.includes(t))) {
    return {
      icon: Hash,
      label: 'Numeric',
      color: 'text-blue-500',
    };
  }

  if (textTypes.some((t) => normalizedType.includes(t))) {
    return {
      icon: CaseLower,
      label: 'Text',
      color: 'text-green-500',
    };
  }

  if (dateTimeTypes.some((t) => normalizedType.includes(t))) {
    return {
      icon: Clock,
      label: 'Date/Time',
      color: 'text-orange-500',
    };
  }

  if (booleanTypes.some((t) => normalizedType.includes(t))) {
    return {
      icon: Binary,
      label: 'Boolean',
      color: 'text-purple-500',
    };
  }

  if (jsonTypes.some((t) => normalizedType.includes(t))) {
    return {
      icon: Braces,
      label: 'JSON',
      color: 'text-yellow-500',
    };
  }

  // Default/unknown type
  return {
    icon: HelpCircle,
    label: 'Unknown',
    color: 'text-gray-400',
  };
}

interface ColumnTypeIconProps {
  dataType: string;
  className?: string;
}

export function ColumnTypeIcon({ dataType, className = 'w-4 h-4' }: ColumnTypeIconProps) {
  const config = getColumnTypeConfig(dataType);
  const Icon = config.icon;

  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>
        <span className="inline-flex pointer-events-auto cursor-help">
          <Icon className={`${config.color} ${className} shrink-0`} aria-hidden="true" />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {dataType}
      </TooltipContent>
    </Tooltip>
  );
}
