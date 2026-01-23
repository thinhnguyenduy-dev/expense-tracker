// Shared TypeScript types for Expense Tracker

export interface User {
  id: number;
  email: string;
  name: string;
  created_at: string;
}

export interface Category {
  id: number;
  name: string;
  icon: string;
  color: string;
  user_id: number;
  created_at: string;
}

export interface Expense {
  id: number;
  amount: number;
  description: string;
  date: string;
  category_id: number;
  category?: Category;
  user_id: number;
  created_at: string;
}

export interface DashboardStats {
  total_expenses: number;
  total_this_month: number;
  total_this_week: number;
  expenses_by_category: CategoryStat[];
  monthly_trend: MonthlyTrend[];
}

export interface CategoryStat {
  category_id: number;
  category_name: string;
  category_color: string;
  total: number;
  percentage: number;
}

export interface MonthlyTrend {
  month: string;
  total: number;
}

// Request/Response types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface CreateExpenseRequest {
  amount: number;
  description: string;
  date: string;
  category_id: number;
}

export interface UpdateExpenseRequest {
  amount?: number;
  description?: string;
  date?: string;
  category_id?: number;
}

export interface CreateCategoryRequest {
  name: string;
  icon: string;
  color: string;
}

export interface UpdateCategoryRequest {
  name?: string;
  icon?: string;
  color?: string;
}

export interface ExpenseFilter {
  start_date?: string;
  end_date?: string;
  category_id?: number;
  min_amount?: number;
  max_amount?: number;
}
