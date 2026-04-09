/**
 * Flexible Date/Time Formatter Utility
 * Accepts multiple input formats and normalizes to YYYY-MM-DD HH:MM
 */

export const formatDateTime = (input: string, includeTime: boolean = true): string => {
  if (!input || !input.trim()) return '';

  const trimmed = input.trim().toUpperCase();
  
  // Extract date and time parts
  const dateTimeMatch = trimmed.match(/^(.+?)([\d]{1,2}:[\d]{2})?(?:\s*(AM|PM))?$/);
  if (!dateTimeMatch) return '';

  const datePart = dateTimeMatch[1].trim();
  const timePart = dateTimeMatch[2];
  const meridiem = dateTimeMatch[3];

  // Parse date in multiple formats
  let day = 0, month = 0, year = 0;

  // Try DD/MM/YYYY or DD-MM-YYYY
  const slashMatch = datePart.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4}|\d{2})$/);
  if (slashMatch) {
    day = parseInt(slashMatch[1], 10);
    month = parseInt(slashMatch[2], 10);
    year = parseInt(slashMatch[3], 10);
    if (year < 100) {
      year += year > 50 ? 1900 : 2000;
    }
  }

  // Try YYYY-MM-DD
  const isoMatch = datePart.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (isoMatch && !slashMatch) {
    year = parseInt(isoMatch[1], 10);
    month = parseInt(isoMatch[2], 10);
    day = parseInt(isoMatch[3], 10);
  }

  // Try DDMMMYYYY (e.g., 09APR2026)
  const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const textMatch = datePart.match(/^(\d{1,2})(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)(\d{4}|\d{2})$/);
  if (textMatch && !slashMatch && !isoMatch) {
    day = parseInt(textMatch[1], 10);
    month = monthNames.indexOf(textMatch[2]) + 1;
    year = parseInt(textMatch[3], 10);
    if (year < 100) {
      year += year > 50 ? 1900 : 2000;
    }
  }

  // Validate date
  if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1900 || year > 2100) {
    return '';
  }

  // Format date as YYYY-MM-DD
  const formattedDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  if (!includeTime) {
    return formattedDate;
  }

  // Parse and format time
  let hours = 0, minutes = 0;

  if (timePart) {
    const timeMatch = timePart.match(/(\d{1,2}):(\d{2})/);
    if (timeMatch) {
      hours = parseInt(timeMatch[1], 10);
      minutes = parseInt(timeMatch[2], 10);

      // Convert to 24-hour format if AM/PM provided
      if (meridiem === 'PM' && hours !== 12) {
        hours += 12;
      } else if (meridiem === 'AM' && hours === 12) {
        hours = 0;
      }

      // Validate time
      if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        hours = 0;
        minutes = 0;
      }
    }
  }

  const formattedTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  return `${formattedDate} ${formattedTime}`;
};

/**
 * Parse a datetime string and return structured date/time object
 */
export const parseDateTime = (input: string) => {
  const formatted = formatDateTime(input, true);
  if (!formatted) return null;

  const [datePart, timePart] = formatted.split(' ');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hours, minutes] = timePart.split(':').map(Number);

  return {
    year,
    month,
    day,
    hours,
    minutes,
    formatted,
  };
};

/**
 * Get input format hint for UI
 */
export const getDateTimeHint = (): string => {
  return 'DD/MM/YYYY HH:MM (or DD/MM/YYYY, 09APR2026 10:30 AM, etc.)';
};

/**
 * Format a Date object to our standard format
 */
export const dateToString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
};
