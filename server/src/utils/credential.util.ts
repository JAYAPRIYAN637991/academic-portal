/**
 * Staff Credential Generation, Normalization & Security Utilities
 */

/**
 * Extracts clean first name from full staff name, removing academic titles.
 * e.g., "Prof. Sarah Jenkins" -> "Sarah"
 *       "Dr. Michael Chang" -> "Michael"
 *       "A. Rajesh" -> "Rajesh"
 */
export function extractFirstName(fullName: string): string {
  if (!fullName) return 'Staff';
  // Remove titles like Prof., Dr., Mr., Mrs., Ms.
  const clean = fullName.replace(/^(prof\.|dr\.|mr\.|mrs\.|ms\.|prof|dr|mr|mrs|ms)\s+/i, '').trim();
  const parts = clean.split(/\s+/);
  // If first part is an initial (e.g. "A. Rajesh"), take the following word
  if (parts[0].length <= 2 && parts.length > 1) {
    const candidate = parts[1].replace(/[^a-zA-Z]/g, '');
    if (candidate) return candidate;
  }
  return parts[0].replace(/[^a-zA-Z]/g, '') || 'Staff';
}

/**
 * Formats a Date of Birth string or Date into standard 8-digit DDMMYYYY format.
 * Supports:
 * - "YYYY-MM-DD" e.g. "1988-08-15" -> "15081988"
 * - "DD-MM-YYYY" e.g. "15-08-1988" -> "15081988"
 * - "DD/MM/YYYY" e.g. "15/08/1988" -> "15081988"
 * - Date object
 */
export function formatDobToDDMMYYYY(dob: string | Date): string {
  if (!dob) return '01011990';
  if (dob instanceof Date) {
    const d = String(dob.getDate()).padStart(2, '0');
    const m = String(dob.getMonth() + 1).padStart(2, '0');
    const y = String(dob.getFullYear());
    return `${d}${m}${y}`;
  }
  const cleanStr = String(dob).trim();
  // Check if YYYY-MM-DD
  const ymdMatch = cleanStr.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (ymdMatch) {
    const [, y, m, d] = ymdMatch;
    return `${d.padStart(2, '0')}${m.padStart(2, '0')}${y}`;
  }
  // Check if DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = cleanStr.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    return `${d.padStart(2, '0')}${m.padStart(2, '0')}${y}`;
  }
  // Digits only e.g. "15081988"
  const digits = cleanStr.replace(/\D/g, '');
  if (digits.length === 8) return digits;
  return '01011990';
}

/**
 * Generates standardized default staff password from Name + DOB formula:
 * FirstName + "@" + DDMMYYYY
 * e.g., Name: "Prof. Sarah Jenkins", DOB: "1988-08-15" -> "Sarah@15081988"
 */
export function generateDefaultStaffPassword(fullName: string, dob: string | Date): string {
  const firstName = extractFirstName(fullName);
  const capitalized = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
  const dobFormatted = formatDobToDDMMYYYY(dob);
  return `${capitalized}@${dobFormatted}`;
}

/**
 * Generates normalized username from staff name:
 * e.g., "Prof. Sarah Jenkins" -> "sarah.jenkins"
 */
export function generateStaffUsername(fullName: string): string {
  const clean = fullName.replace(/^(prof\.|dr\.|mr\.|mrs\.|ms\.|prof|dr|mr|mrs|ms)\s+/i, '').trim();
  return clean.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '');
}

/**
 * Cleans name by removing academic titles for fuzzy comparison.
 */
export function cleanSearchName(name: string): string {
  return name.replace(/^(prof\.|dr\.|mr\.|mrs\.|ms\.|prof|dr|mr|mrs|ms)\s+/i, '').trim().toLowerCase();
}

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validates that a password satisfies the institutional security policy:
 * - Minimum 8 characters
 * - Alphanumeric (contains letters AND numbers)
 * - Contains at least one special symbol (e.g. @, #, $, %, !, &, *, ^, ?, etc.)
 */
export function validatePasswordComplexity(password: string): PasswordValidationResult {
  const errors: string[] = [];

  if (!password || typeof password !== 'string') {
    return { isValid: false, errors: ['Password is required'] };
  }

  const trimmed = password.trim();

  if (trimmed.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  if (!/[a-zA-Z]/.test(trimmed)) {
    errors.push('Password must contain at least one letter (a-z, A-Z)');
  }

  if (!/[0-9]/.test(trimmed)) {
    errors.push('Password must contain at least one number (0-9)');
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(trimmed)) {
    errors.push('Password must contain at least one special symbol (e.g. @, #, $, !, %, *)');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}
