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
