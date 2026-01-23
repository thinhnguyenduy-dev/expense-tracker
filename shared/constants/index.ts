// Shared constants for Expense Tracker

export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/api/auth/login',
    REGISTER: '/api/auth/register',
    ME: '/api/auth/me',
  },
  CATEGORIES: '/api/categories',
  EXPENSES: '/api/expenses',
  DASHBOARD: '/api/dashboard',
} as const;

export const DEFAULT_CATEGORIES = [
  { name: 'Food & Dining', icon: '🍔', color: '#FF6B6B' },
  { name: 'Transportation', icon: '🚗', color: '#4ECDC4' },
  { name: 'Shopping', icon: '🛍️', color: '#45B7D1' },
  { name: 'Entertainment', icon: '🎬', color: '#96CEB4' },
  { name: 'Bills & Utilities', icon: '💡', color: '#FFEAA7' },
  { name: 'Healthcare', icon: '🏥', color: '#DDA0DD' },
  { name: 'Education', icon: '📚', color: '#98D8C8' },
  { name: 'Travel', icon: '✈️', color: '#F7DC6F' },
  { name: 'Personal Care', icon: '💄', color: '#BB8FCE' },
  { name: 'Other', icon: '📦', color: '#85929E' },
] as const;

export const CHART_COLORS = [
  '#FF6B6B',
  '#4ECDC4',
  '#45B7D1',
  '#96CEB4',
  '#FFEAA7',
  '#DDA0DD',
  '#98D8C8',
  '#F7DC6F',
  '#BB8FCE',
  '#85929E',
] as const;

export const DATE_FORMATS = {
  DISPLAY: 'MMM dd, yyyy',
  API: 'yyyy-MM-dd',
  MONTH_YEAR: 'MMM yyyy',
} as const;

export const CURRENCY = {
  CODE: 'VND',
  SYMBOL: '₫',
  LOCALE: 'vi-VN',
} as const;
