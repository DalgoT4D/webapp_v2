import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import SHA256 from 'crypto-js/sha256';
import Base64 from 'crypto-js/enc-base64';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Hash a password using SHA256 and encode to Base64
 * This ensures passwords are never sent in plaintext to the backend
 */
export function hashPassword(password: string): string {
  const hash = SHA256(password);
  return Base64.stringify(hash);
}
