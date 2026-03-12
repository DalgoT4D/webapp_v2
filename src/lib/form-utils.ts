/**
 * Deep comparison utility for detecting form changes
 */

export function deepEqual(obj1: any, obj2: any): boolean {
  if (obj1 === obj2) return true;

  if (obj1 == null || obj2 == null) return obj1 === obj2;

  if (typeof obj1 !== typeof obj2) return false;

  if (typeof obj1 !== 'object') return obj1 === obj2;

  if (Array.isArray(obj1) !== Array.isArray(obj2)) return false;

  if (Array.isArray(obj1)) {
    if (obj1.length !== obj2.length) return false;
    for (let i = 0; i < obj1.length; i++) {
      if (!deepEqual(obj1[i], obj2[i])) return false;
    }
    return true;
  }

  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);

  if (keys1.length !== keys2.length) return false;

  for (const key of keys1) {
    if (!keys2.includes(key)) return false;
    if (!deepEqual(obj1[key], obj2[key])) return false;
  }

  return true;
}

/**
 * Generate a title for a duplicate chart
 */
export function generateDuplicateTitle(originalTitle: string, existingTitles: string[]): string {
  let baseName = originalTitle;
  let copyNumber = 1;

  // Check if the title already has "Copy of" prefix
  if (originalTitle.startsWith('Copy of ')) {
    baseName = originalTitle;
  } else {
    baseName = `Copy of ${originalTitle}`;
  }

  let newTitle = baseName;

  // Find next available number if duplicates exist
  while (existingTitles.includes(newTitle)) {
    copyNumber++;
    if (originalTitle.startsWith('Copy of ')) {
      // Handle existing copies - extract base and add number
      const match = originalTitle.match(/^Copy of (.+?)( \((\d+)\))?$/);
      if (match) {
        const baseTitle = match[1];
        newTitle = `Copy of ${baseTitle} (${copyNumber})`;
      } else {
        newTitle = `${originalTitle} (${copyNumber})`;
      }
    } else {
      newTitle = `Copy of ${originalTitle} (${copyNumber})`;
    }
  }

  return newTitle;
}
