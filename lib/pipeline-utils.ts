import { formatDistanceToNow, differenceInSeconds, parseISO } from 'date-fns';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import { TransformTask } from '@/types/pipeline';
import {
  TASK_READABLE_NAMES,
  SYSTEM_COMMAND_ORDER,
  CUSTOM_COMMAND_DEFAULT_ORDER,
  FLOW_RUN_STARTED_BY_DATE_CUTOFF,
  WEEKDAYS,
} from '@/constants/pipeline';

/**
 * Format a timestamp to relative time (e.g., "5 minutes ago")
 */
export function lastRunTime(startTime: string | null | undefined): string {
  if (!startTime) return '-';
  try {
    return formatDistanceToNow(new Date(startTime), { addSuffix: true });
  } catch {
    return '-';
  }
}

/**
 * Get user's local timezone
 */
export function localTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Format duration in seconds to human-readable string (e.g., "2h 30m")
 */
export function formatDuration(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  let formatted = '';
  let metricCount = 0;

  if (days > 0 && metricCount < 2) {
    formatted += `${days}d `;
    metricCount++;
  }
  if (hours > 0 && metricCount < 2) {
    formatted += `${hours}h `;
    metricCount++;
  }
  if (minutes > 0 && metricCount < 2) {
    formatted += `${minutes}m `;
    metricCount++;
  }
  if ((secs > 0 || formatted === '') && metricCount < 2) {
    formatted += `${secs}s`;
  }

  return formatted.trim();
}

/**
 * Extract username from email
 */
export function trimEmail(email: string): string {
  return email.split('@')[0];
}

/**
 * Get task order from system commands or default
 */
export function getTaskOrder(slug: string): number {
  return SYSTEM_COMMAND_ORDER[slug] ?? CUSTOM_COMMAND_DEFAULT_ORDER;
}

/**
 * Make task label human-readable
 */
export function makeReadable(label: string): string {
  if (label.startsWith('run-airbyte-connection-flow-v1')) {
    return 'sync';
  }
  return TASK_READABLE_NAMES[label] ?? label;
}

/**
 * Validate if a task should be applied in pipeline by default
 */
export function validateDefaultTasksToApplyInPipeline(task: TransformTask): boolean {
  return task.generated_by === 'system' && task.pipeline_default;
}

/**
 * Convert schedule settings to cron expression (stored in UTC)
 */
export function convertToCronExpression(
  schedule: string,
  daysOfWeek: string[] = ['1'],
  timeOfDay = '1 0' // UTC hours minutes, default 1:00AM = '1 0'
): string {
  const [utcHours, utcMinutes] = timeOfDay.split(' ');

  const cronMappings: Record<string, string> = {
    manual: '',
    daily: `${utcMinutes} ${utcHours} * * *`,
    weekly: `${utcMinutes} ${utcHours} * * ${daysOfWeek.join(',')}`,
  };

  return cronMappings[schedule] ?? cronMappings.daily;
}

/**
 * Parse cron expression back to schedule settings
 */
export function convertCronToSchedule(cronExp: string | null): {
  schedule: string;
  daysOfWeek: string[];
  timeOfDay: string;
} {
  if (!cronExp) {
    return {
      schedule: 'manual',
      daysOfWeek: [],
      timeOfDay: '',
    };
  }

  const vals = cronExp.split(' ');

  // Handle 6-field cron (with seconds)
  if (vals.length === 6) {
    vals.shift();
  }

  if (vals.length !== 5) {
    return {
      schedule: 'manual',
      daysOfWeek: [],
      timeOfDay: '',
    };
  }

  const [utcMinutes, utcHours] = vals;
  const daysOfWeek = vals[4].replace(/\*/g, '');

  return {
    schedule: daysOfWeek !== '' ? 'weekly' : 'daily',
    daysOfWeek: daysOfWeek !== '' ? daysOfWeek.split(',') : [],
    timeOfDay: `${utcHours} ${utcMinutes}`,
  };
}

/**
 * Convert UTC cron to local timezone cron
 */
function cronToLocalTZ(expression: string): string {
  if (!expression) return '';

  const fields = expression.split(' ');

  // Handle 6-field cron (with seconds)
  if (fields.length === 6) {
    fields.shift();
  }

  if (fields.length !== 5) {
    return '';
  }

  // Validate that day of month and month are always "*"
  if (fields[2] !== '*' || fields[3] !== '*') {
    console.warn('cronToLocalTZ: Expected day of month and month to be "*"');
    return expression;
  }

  try {
    const [minutes, hours] = fields;
    const utcMinutes = parseInt(minutes, 10);
    const utcHours = parseInt(hours, 10);

    // Create a date in UTC with the cron time
    const now = new Date();
    const utcDate = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), utcHours, utcMinutes)
    );

    // Convert to local time
    const localDate = new Date(utcDate.toLocaleString('en-US'));

    return `${localDate.getMinutes()} ${localDate.getHours()} ${fields[2]} ${fields[3]} ${fields[4]}`;
  } catch (error) {
    console.error('Error converting cron expression to local timezone:', error);
    return expression;
  }
}

/**
 * Convert cron expression to human-readable string
 */
export function cronToString(expression: string | null): string {
  if (!expression) return 'Manual';

  try {
    const localCron = cronToLocalTZ(expression);
    if (!localCron) return 'Manual';

    const parts = localCron.split(' ');
    if (parts.length !== 5) return expression;

    const [minutes, hours, , , dayOfWeek] = parts;
    const hour = parseInt(hours, 10);
    const minute = parseInt(minutes, 10);

    // Format time as 12-hour
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    const timeStr = `${hour12}:${minute.toString().padStart(2, '0')} ${ampm}`;

    if (dayOfWeek === '*') {
      return `Daily at ${timeStr}`;
    }

    // Weekly - show days
    const days = dayOfWeek.split(',').map((d) => WEEKDAYS[d] || d);
    if (days.length === 1) {
      return `${days[0]} at ${timeStr}`;
    }
    return `${days.join(', ')} at ${timeStr}`;
  } catch (error) {
    console.error('Error converting cron to human readable format:', error);
    return expression;
  }
}

/**
 * Convert local time string to UTC time string for cron
 * @param localTime - Time in format "HH:mm" (24-hour local time)
 * @returns Time in format "H M" (UTC hours and minutes)
 */
export function localTimeToUTC(localTime: string): string {
  const [hours, minutes] = localTime.split(':').map(Number);

  // Create a date with the local time
  const localDate = new Date();
  localDate.setHours(hours, minutes, 0, 0);

  // Get UTC hours and minutes
  const utcHours = localDate.getUTCHours();
  const utcMinutes = localDate.getUTCMinutes();

  return `${utcHours} ${utcMinutes}`;
}

/**
 * Convert UTC time string to local time string
 * @param utcTime - Time in format "H M" (UTC hours and minutes)
 * @returns Time in format "HH:mm" (24-hour local time)
 */
export function utcTimeToLocal(utcTime: string): string {
  if (!utcTime) return '';

  const [hours, minutes] = utcTime.split(' ').map(Number);

  // Create a UTC date
  const utcDate = new Date();
  utcDate.setUTCHours(hours, minutes, 0, 0);

  // Get local hours and minutes
  const localHours = utcDate.getHours();
  const localMinutes = utcDate.getMinutes();

  return `${localHours.toString().padStart(2, '0')}:${localMinutes.toString().padStart(2, '0')}`;
}

/**
 * Get the user who started a flow run, respecting the date cutoff
 */
export function getFlowRunStartedBy(flowRunStartTime: string | null, user: string): string | null {
  if (!flowRunStartTime || flowRunStartTime < FLOW_RUN_STARTED_BY_DATE_CUTOFF) {
    return null;
  }
  return user === 'System' ? 'System' : trimEmail(user);
}

/**
 * Utility delay function for polling
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate duration between two timestamps
 */
export function calculateDuration(startTime: string, endTime: string): number {
  try {
    return differenceInSeconds(parseISO(endTime), parseISO(startTime));
  } catch {
    return 0;
  }
}
