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

// Auth API
export const authApi = {
  register: (data: { email: string; password: string; name: string }) =>
    api.post('/auth/register', data),
  
  login: (data: { username: string; password: string }) =>
    api.post('/auth/login', data, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }),
  
  me: () => api.get('/auth/me'),
};

// Categories API
export const categoriesApi = {
  getAll: () => api.get('/categories'),
  
  create: (data: { name: string; icon: string; color: string }) =>
    api.post('/categories', data),
  
  update: (id: number, data: { name?: string; icon?: string; color?: string }) =>
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
}

export const expensesApi = {
  getAll: (filters?: ExpenseFilter) =>
    api.get('/expenses', { params: filters }),
  
  getOne: (id: number) => api.get(`/expenses/${id}`),
  
  create: (data: { amount: number; description: string; date: string; category_id: number }) =>
    api.post('/expenses', data),
  
  update: (id: number, data: { amount?: number; description?: string; date?: string; category_id?: number }) =>
    api.put(`/expenses/${id}`, data),
  
  delete: (id: number) => api.delete(`/expenses/${id}`),
};

// Dashboard API
export const dashboardApi = {
  getStats: () => api.get('/dashboard'),
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

