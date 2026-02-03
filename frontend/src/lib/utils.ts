import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number, currency: string = 'VND', locale: string = 'vi') {
  return new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-US', {
    style: 'currency',
    currency: currency,
  }).format(value);
}

/**
 * Extract error message from API response
 * Handles both string errors and Pydantic validation error arrays
 */
export function getApiErrorMessage(error: unknown, fallback: string = 'An error occurred'): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const detail = (error as any)?.response?.data?.detail;
  
  if (typeof detail === 'string') {
    return detail;
  }
  
  if (Array.isArray(detail)) {
    // Pydantic validation errors are arrays of objects with 'msg' field
    const messages = detail
      .map((e: { msg?: string }) => e.msg)
      .filter(Boolean);
    return messages.length > 0 ? messages.join(', ') : fallback;
  }
  
  return fallback;
}
