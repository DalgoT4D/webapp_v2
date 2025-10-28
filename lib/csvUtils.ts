/**
 * Utility functions for CSV generation and download
 */

/**
 * Escapes a value for CSV format by:
 * - Wrapping in quotes if it contains comma, newline, or quote
 * - Escaping quotes by doubling them
 */
function escapeCsvValue(value: any): string {
  const str = String(value ?? '');
  // If contains comma, newline, or quote, wrap in quotes and escape quotes
  if (str.includes(',') || str.includes('\n') || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Converts an array of state names to CSV format
 */
export function statesToCsv(states: Array<{ state: string } | string>): string {
  const header = 'State Name\n';
  const rows = states
    .map((item) => {
      const stateName = typeof item === 'string' ? item : item.state;
      return escapeCsvValue(stateName);
    })
    .join('\n');
  return header + rows;
}

/**
 * Converts an array of district data to CSV format
 */
export function districtsToCsv(districts: Array<{ state: string; district: string }>): string {
  const header = 'State Name,District Name\n';
  const rows = districts
    .map((row) => `${escapeCsvValue(row.state)},${escapeCsvValue(row.district)}`)
    .join('\n');
  return header + rows;
}

/**
 * Downloads data as a CSV file by creating a blob and triggering download
 */
export function downloadCsv(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Fetches region names from API and downloads as CSV
 * Handles both CSV and JSON responses from backend
 */
export async function downloadRegionNames(
  apiBaseUrl: string,
  countryCode: string,
  regionType: 'state' | 'district',
  options?: {
    onSuccess?: (message: string) => void;
    onError?: (error: Error) => void;
  }
): Promise<void> {
  const url = `${apiBaseUrl}/api/charts/regions/export-names/?country_code=${countryCode}&region_type=${regionType}`;

  const response = await fetch(url, {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'text/csv, application/json' },
  });

  if (!response.ok) {
    throw new Error(`Failed: ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type') || '';
  let csvContent: string;

  if (contentType.includes('text/csv')) {
    // Backend returned CSV directly
    csvContent = await response.text();
  } else {
    // Backend returned JSON, convert to CSV
    const data = await response.json();

    if (regionType === 'state') {
      csvContent = statesToCsv(data);
    } else {
      csvContent = districtsToCsv(data);
    }
  }

  const filename = `${countryCode.toLowerCase()}_${regionType}s.csv`;
  downloadCsv(csvContent, filename);

  options?.onSuccess?.(`Downloaded ${regionType} names for ${countryCode}`);
}
