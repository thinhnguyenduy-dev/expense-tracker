import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Generic paginated response type
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// Auth API
export const authApi = {
  register: (data: { email: string; password: string; name: string }) =>
    api.post('/auth/register', data),
  
  login: (data: { username: string; password: string }) => {
    const params = new URLSearchParams();
    params.append('username', data.username);
    params.append('password', data.password);
    return api.post('/auth/login', params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  },
  
  me: () => api.get('/auth/me'),
};

// Categories API
export const categoriesApi = {
  getAll: () => api.get('/categories'),
  
  create: (data: { name: string; icon: string; color: string; jar_id?: number; monthly_limit?: number }) =>
    api.post('/categories', data),
  
  update: (id: number, data: { name?: string; icon?: string; color?: string; jar_id?: number; monthly_limit?: number }) =>
    api.put(`/categories/${id}`, data),
  
  delete: (id: number) => api.delete(`/categories/${id}`),
};

// Expenses API
export interface ExpenseFilter {
  start_date?: string;
  end_date?: string;
  category_id?: number;
  min_amount?: number;
  max_amount?: number;
  search?: string;
  page?: number;
  page_size?: number;
  scope?: 'personal' | 'family';
}

export interface Expense {
  id: number;
  amount: number;
  description: string;
  date: string;
  category_id: number;
  category: {
    id: number;
    name: string;
    icon: string;
    color: string;
  };
  created_at: string;
  original_amount?: number;
  original_currency?: string;
  exchange_rate?: number;
}

export const expensesApi = {
  getAll: (filters?: ExpenseFilter) =>
    api.get<PaginatedResponse<Expense>>('/expenses', { params: filters }),
  
  getOne: (id: number) => api.get<Expense>(`/expenses/${id}`),
  
  create: (data: { amount: number; description: string; date: string; category_id: number; currency?: string }) =>
    api.post<Expense>('/expenses', data),
  
  update: (id: number, data: { amount?: number; description?: string; date?: string; category_id?: number; currency?: string }) =>
    api.put<Expense>(`/expenses/${id}`, data),
  
  delete: (id: number) => api.delete(`/expenses/${id}`),
  
  bulkDelete: (expenseIds: number[]) =>
    api.post('/expenses/bulk-delete', { expense_ids: expenseIds }),
  
  bulkUpdate: (expenseIds: number[], categoryId: number) =>
    api.patch<Expense[]>('/expenses/bulk-update', { expense_ids: expenseIds, category_id: categoryId }),

  import: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post<{ success_count: number; failed_count: number; errors: any[]; message: string }>('/expenses/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

// Dashboard API
export const dashboardApi = {
  getStats: (scope?: 'personal' | 'family') => api.get('/dashboard', { params: { scope } }),
};

// Recurring Expenses API
export interface RecurringExpenseData {
  category_id: number;
  amount: number;
  description: string;
  frequency: 'monthly' | 'weekly' | 'yearly';
  day_of_month?: number;
  day_of_week?: number;
  start_date: string;
  end_date?: string;
  is_active?: boolean;
}

export const recurringExpensesApi = {
  getAll: () => api.get('/recurring-expenses'),
  
  getOne: (id: number) => api.get(`/recurring-expenses/${id}`),
  
  create: (data: RecurringExpenseData) => api.post('/recurring-expenses', data),
  
  update: (id: number, data: Partial<RecurringExpenseData>) =>
    api.put(`/recurring-expenses/${id}`, data),
  
  delete: (id: number) => api.delete(`/recurring-expenses/${id}`),
  
  createExpense: (id: number) => 
    api.post(`/recurring-expenses/${id}/create-expense`),
};

// Users API
export const usersApi = {
  updateProfile: (data: { name?: string; email?: string; language?: string; currency?: string; overall_monthly_limit?: number | null }) =>
    api.put('/users/profile', data),
  
  
  changePassword: (data: { current_password: string; new_password: string }) =>
    api.put('/users/password', data),
  
  deleteAccount: () => api.delete('/users/account'),
};

// Goals API
export interface Goal {
  id: number;
  name: string;
  description?: string;
  target_amount: number;
  current_amount: number;
  deadline?: string;
  color: string;
  created_at: string;
  user_name?: string;  // For family mode attribution
}

export interface GoalCreate {
  name: string;
  description?: string;
  target_amount: number;
  current_amount?: number;
  deadline?: string;
  color?: string;
}

export interface GoalUpdate {
  name?: string;
  description?: string;
  target_amount?: number;
  current_amount?: number;
  deadline?: string;
  color?: string;
}

export const goalsApi = {
  getAll: (scope?: 'personal' | 'family') => api.get<Goal[]>('/goals', { params: { scope } }),
  
  getOne: (id: number) => api.get<Goal>(`/goals/${id}`),
  
  create: (data: GoalCreate) => api.post<Goal>('/goals', data),
  
  update: (id: number, data: GoalUpdate) => api.put<Goal>(`/goals/${id}`, data),
  
  delete: (id: number) => api.delete(`/goals/${id}`),
};
// Jars API
export interface Jar {
  id: number;
  name: string;
  percentage: number;
  balance: number;
  user_id: number;
  created_at: string;
}

export interface JarCreate {
  name: string;
  percentage: number;
}

export interface JarUpdate {
  name?: string;
  percentage?: number;
}

export interface Transfer {
  id: number;
  from_jar_id: number;
  to_jar_id: number;
  amount: number;
  note?: string;
  date: string;
  from_jar_name?: string;
  to_jar_name?: string;
}

export const jarsApi = {
  getAll: () => api.get<Jar[]>('/jars'),
  create: (data: JarCreate) => api.post<Jar>('/jars', data),
  update: (id: number, data: JarUpdate) => api.put<Jar>(`/jars/${id}`, data),
  transfer: (data: { from_jar_id: number; to_jar_id: number; amount: number; note?: string }) => api.post<Transfer>('/transfers', data),
  getTransfers: () => api.get<Transfer[]>('/transfers'),
};

// Incomes API
export interface Income {
  id: number;
  amount: number;
  source: string;
  date: string;
  user_id: number;
  created_at: string;
  user_name?: string;  // For family mode attribution
  original_amount?: number;
  original_currency?: string;
  exchange_rate?: number;
}

export interface IncomeCreate {
  amount: number;
  source: string;
  date: string;
  currency?: string;
}

export const incomesApi = {
  getAll: (scope?: 'personal' | 'family', memberId?: number) => 
    api.get<Income[]>('/incomes', { params: { scope, member_id: memberId } }),
  create: (data: IncomeCreate) => api.post<Income>('/incomes', data),
  update: (id: number, data: IncomeCreate) => api.put<Income>(`/incomes/${id}`, data),
  delete: (id: number) => api.delete(`/incomes/${id}`),
};

export interface ReportResponse {
  daily_expenses: { date: string; amount: number }[];
  category_breakdown: { category_id: number; category_name: string; category_color: string; amount: number; percentage: number }[];
  income_vs_expense: { month: string; income: number; expense: number }[];
  savings_stats: { current_savings_rate: number; total_income: number; total_expense: number; net_savings: number };
  total_period: number;
  period_start: string;
  period_end: string;
}

export const reportsApi = {
  get: (startDate?: string, endDate?: string, scope?: 'personal' | 'family') => 
    api.get<ReportResponse>('/reports', { params: { start_date: startDate, end_date: endDate, scope } }),
  
  export: () => api.get('/reports/export', { responseType: 'blob' }),
};

// Data API
export const dataApi = {
  exportData: () => api.get('/data/export', { responseType: 'blob' }),
  importData: (file: File, onProgress?: (percent: number) => void) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/data/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percent);
        }
      },
    });
  },
};

// Rates API
export const ratesApi = {
  convert: (amount: number, from: string, to: string) => 
    api.get<{ converted_amount: number; rate: number }>('/rates/convert', { 
      params: { amount, from_currency: from, to_currency: to } 
    }),
};

// OCR API
export const ocrApi = {
  scanReceipt: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post<{ amount?: number; date?: string; merchant?: string; text?: string }>('/ocr/scan', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

// Family API
export interface Family {
  id: number;
  name: string;
  invite_code: string;
  created_at: string;
  members: Array<{
    id: number;
    name: string;
    email: string;
    language: string;
    family_id: number;
  }>;
}

export const familiesApi = {
  create: (name: string) => api.post<Family>('/families', { name }),
  join: (invite_code: string) => api.post<Family>('/families/join', { invite_code }),
  getMyFamily: () => api.get<Family>('/families/me'),
};

// Budgets API
export interface BudgetStatus {
  limit: number | null;
  spent: number;
  percentage: number;
  is_over_limit: boolean;
  is_warning: boolean;
}

export interface CategoryBudgetStatus extends BudgetStatus {
  category_name: string;
}

export interface BudgetResponse {
  overall: BudgetStatus;
  categories: CategoryBudgetStatus[];
}

export const budgetsApi = {
  getStatus: () => api.get<BudgetResponse>('/budgets'),
};

// Search API
export interface SearchResult {
  id: number;
  type: 'expense' | 'income';
  date: string;
  amount: number;
  description: string;
  category_name: string;
  category_color?: string;
}

// Cron API
export const cronApi = {
  run: () => api.post<{ status: string; expenses_created: number }>('/cron/run'),
};

export const searchApi = {
  search: (query: string) => api.get<SearchResult[]>('/search', { params: { q: query } }),
};
