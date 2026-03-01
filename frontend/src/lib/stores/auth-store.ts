import { create } from 'zustand';
import { authApi } from '@/lib/api';

export interface User {
  id: number;
  email: string;
  name: string;
  language: string;
  currency: string;
  overall_monthly_limit?: number | null;
  created_at: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
  setToken: (token: string) => void;
  updateUser: (data: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: typeof window !== 'undefined' ? localStorage.getItem('token') : null,
  isLoading: true,
  isAuthenticated: false,

  login: async (email: string, password: string) => {
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);
    
    const response = await authApi.login({ username: email, password });
    const token = response.data.access_token;
    
    localStorage.setItem('token', token);
    set({ token, isAuthenticated: true });
    
    await get().loadUser();
  },

  register: async (email: string, password: string, name: string) => {
    await authApi.register({ email, password, name });
  },

  logout: async () => {
    try {
      if (get().isAuthenticated) {
        await authApi.logout();
      }
    } catch (error) {
      console.error('Logout error', error);
    } finally {
      localStorage.removeItem('token');
      set({ user: null, token: null, isAuthenticated: false, isLoading: false });
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
  },

  loadUser: async () => {
    const token = get().token;
    if (!token) {
      set({ isLoading: false, isAuthenticated: false });
      return;
    }

    try {
      const response = await authApi.me();
      set({ user: response.data, isAuthenticated: true, isLoading: false });
    } catch {
      localStorage.removeItem('token');
      set({ user: null, token: null, isAuthenticated: false, isLoading: false });
    }
  },

  setToken: (token: string) => {
    localStorage.setItem('token', token);
    set({ token, isAuthenticated: true });
  },

  updateUser: (data: Partial<User>) => {
    const currentUser = get().user;
    if (currentUser) {
      set({ user: { ...currentUser, ...data } });
    }
  },
}));
