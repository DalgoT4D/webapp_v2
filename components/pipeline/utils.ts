import { formatDistanceToNow, differenceInSeconds, parseISO } from 'date-fns';
import moment from 'moment';
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
 * Adjust day-of-week field by a given shift (-1, 0, or +1)
 * Handles comma-separated values and ranges (e.g., "1,3,5" or "1-5")
 * Normalizes results to 0-6 range (0=Sunday, 6=Saturday)
 */
function adjustDayOfWeek(dowField: string, shift: number): string {
  if (dowField === '*' || shift === 0) {
    return dowField;
  }

  return dowField
    .split(',')
    .map((token) => {
      // Handle ranges like "1-5"
      if (token.includes('-')) {
        const parts = token.split('-');
        if (parts.length === 2) {
          const start = parseInt(parts[0], 10);
          const end = parseInt(parts[1], 10);
          if (!isNaN(start) && !isNaN(end)) {
            const newStart = (((start + shift) % 7) + 7) % 7;
            const newEnd = (((end + shift) % 7) + 7) % 7;
            return `${newStart}-${newEnd}`;
          }
        }
        return token; // Unrecognized range format, preserve unchanged
      }

      // Handle single numbers
      const num = parseInt(token, 10);
      if (!isNaN(num)) {
        return String((((num + shift) % 7) + 7) % 7);
      }

      // Unrecognized token (e.g., "MON"), preserve unchanged
      return token;
    })
    .join(',');
}

/**
 * Convert UTC cron to local timezone cron (using moment.js - same as webapp v1)
 * minutes, hours, day of month, month, day of week
 * 0 1 * * *
 * WE ASSUME AND REQUIRE that d-o-m and m are always "*"
 */
export function cronToLocalTZ(expression: string): string {
  if (!expression) return '';

  const fields = expression.split(' ');

  // Handle 6-field cron (with seconds)
  if (fields.length === 6) {
    fields.shift();
  }

  if (fields.length !== 5) {
    return '';
  }

  // Validating that day of month and month are always "*"
  if (fields[2] !== '*' || fields[3] !== '*') {
    console.warn('cronToLocalTZ: Expected day of month and month to be "*"');
    return expression;
  }

  try {
    const [minutes, hours] = fields; // these are the UTC minutes and hours

    // Create moment in UTC with the cron time
    const utcTime = moment.utc().hours(parseInt(hours, 10)).minutes(parseInt(minutes, 10));

    // Convert to local time (clone first since .local() mutates the object)
    const localTime = utcTime.clone().local();

    // Calculate day shift from UTC to local
    // Moment handles the day boundary crossing, we just need to extract the shift
    let dayShift = localTime.date() - utcTime.date();
    // Normalize for month boundaries (e.g., 31→1 should be +1, not -30)
    if (dayShift > 1) dayShift = -1;
    if (dayShift < -1) dayShift = 1;

    // Adjust day-of-week field if needed
    const adjustedDow = adjustDayOfWeek(fields[4], dayShift);

    return `${localTime.minutes()} ${localTime.hours()} ${fields[2]} ${fields[3]} ${adjustedDow}`;
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
 * Convert local time string to UTC time string for cron (using moment.js - same as webapp v1)
 * @param localTime - Time in format "HH:mm" or "H:mm" (24-hour local time)
 * @returns Time in format "H M" (UTC hours and minutes)
 * @throws Error if input format is invalid
 */
export function localTimeToUTC(localTime: string): string {
  // Validate input format: "HH:mm" or "H:mm" (24-hour format)
  const timeRegex = /^([01]?\d|2[0-3]):([0-5]\d)$/;
  const match = localTime?.match(timeRegex);

  if (!match) {
    throw new Error(
      `Invalid time format: "${localTime}". Expected format "HH:mm" (e.g., "09:30" or "14:00")`
    );
  }

  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);

  // Create a deterministic local moment using startOf('day') as base
  // This avoids carrying over any unpredictable time values from moment()
  const localMoment = moment().startOf('day').hours(hours).minutes(minutes);

  // Convert to UTC and get hours/minutes
  const utcMoment = moment.utc(localMoment);

  return `${utcMoment.hours()} ${utcMoment.minutes()}`;
}

/**
 * Convert UTC time string to local time string (using moment.js - same as webapp v1)
 * @param utcTime - Time in format "H M" (UTC hours and minutes, space-separated)
 * @returns Time in format "HH:mm" (24-hour local time)
 * @throws Error if input format is invalid
 */
export function utcTimeToLocal(utcTime: string): string {
  if (!utcTime) return '';

  // Validate input format: "H M" or "HH MM" (space-separated hours and minutes)
  const timeRegex = /^([01]?\d|2[0-3])\s+([0-5]?\d)$/;
  const match = utcTime.match(timeRegex);

  if (!match) {
    throw new Error(
      `Invalid UTC time format: "${utcTime}". Expected format "H M" (e.g., "9 30" or "14 0")`
    );
  }

  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);

  // Create a deterministic UTC moment and convert to local
  const localMoment = moment.utc().startOf('day').hours(hours).minutes(minutes).local();

  return `${localMoment.hours().toString().padStart(2, '0')}:${localMoment.minutes().toString().padStart(2, '0')}`;
}

// Precompute cutoff timestamp once for efficiency
const CUTOFF_MS = Date.parse(FLOW_RUN_STARTED_BY_DATE_CUTOFF);

/**
 * Get the user who started a flow run, respecting the date cutoff
 * Returns null for runs before the cutoff date (when we started recording who triggered runs)
 */
export function getFlowRunStartedBy(flowRunStartTime: string | null, user: string): string | null {
  if (!flowRunStartTime) {
    return null;
  }

  // Parse the timestamp to numeric milliseconds for accurate comparison
  const startTimeMs = Date.parse(flowRunStartTime);

  // Handle invalid parse results (NaN) or dates before cutoff
  if (isNaN(startTimeMs) || startTimeMs < CUTOFF_MS) {
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
