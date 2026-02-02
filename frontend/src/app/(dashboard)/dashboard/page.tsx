'use client';

import { useEffect, useState } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  DollarSign,
  PieChart as PieChartIcon
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { dashboardApi, recurringExpensesApi } from '@/lib/api';
import { toast } from 'sonner';
import { useTranslations, useLocale } from 'next-intl';
import { Progress } from '@/components/ui/progress';

interface CategoryStat {
  category_id: number;
  category_name: string;
  category_color: string;
  total: number;
  percentage: number;
  monthly_limit?: number;
}

interface MonthlyTrend {
  month: string;
  total: number;
}

interface DashboardStats {
  total_expenses: number;
  total_this_month: number;
  total_this_week: number;
  expenses_by_category: CategoryStat[];
  monthly_trend: MonthlyTrend[];
  due_recurring_count?: number;
}

import { authApi } from '@/lib/api';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { UpcomingBills } from '@/components/dashboard/UpcomingBills';
import { formatCurrency, cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/stores/auth-store';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Bell, ArrowRight } from "lucide-react";
import Link from 'next/link';
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [upcomingBills, setUpcomingBills] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [scope, setScope] = useState<'personal' | 'family'>('personal');
  const [hasFamily, setHasFamily] = useState(false);
  const t = useTranslations('Dashboard');
  const locale = useLocale();
  const { user } = useAuthStore();
  const currency = user?.currency || 'VND';

  useEffect(() => {
    const checkFamilyStatus = async () => {
      try {
        const { data } = await authApi.me();
        // @ts-ignore
        if (data.family_id) {
          setHasFamily(true);
        }
      } catch (error) {
        console.error('Failed to check family status', error);
      }
    };
    checkFamilyStatus();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [statsRes, billsRes] = await Promise.all([
          dashboardApi.getStats(scope),
          recurringExpensesApi.getAll()
        ]);
        
        setStats(statsRes.data);

        // Process bills
        const data = billsRes.data;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const nextWeek = new Date(today);
        nextWeek.setDate(today.getDate() + 7);

        const activeBills = data.filter((bill: any) => {
              if (!bill.is_active) return false;
              // Check computed property or calculate if needed
              // Assuming API returns next_due_date
              if (!bill.next_due_date) return false;
              const dueDate = new Date(bill.next_due_date);
              dueDate.setHours(0, 0, 0, 0);
              return dueDate >= today && dueDate <= nextWeek;
        });
        activeBills.sort((a: any, b: any) => new Date(a.next_due_date).getTime() - new Date(b.next_due_date).getTime());
        setUpcomingBills(activeBills);

      } catch {
        toast.error(t('failedToLoad'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [t, scope]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  const pieChartData = stats?.expenses_by_category.map((cat) => ({
    name: cat.category_name,
    value: Number(cat.total),
    color: cat.category_color,
  })) || [];

  const barChartData = stats?.monthly_trend.map((trend) => ({
    month: trend.month,
    total: Number(trend.total),
  })) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">{t('title')}</h1>
          <p className="text-slate-400 mt-1">{t('subtitle')}</p>
        </div>
        
        {hasFamily && (
          <div className="flex items-center space-x-2 bg-slate-800 p-2 rounded-lg border border-slate-700">
            <Switch
              id="family-mode"
              checked={scope === 'family'}
              onCheckedChange={(checked) => setScope(checked ? 'family' : 'personal')}
            />
            <Label htmlFor="family-mode" className="text-white cursor-pointer select-none">
              Family View
            </Label>
          </div>
        )}
      </div>

      {/* Due Recurring Expenses Alert */}
      {stats?.due_recurring_count && stats.due_recurring_count > 0 && (
        <Alert className="bg-yellow-500/10 border-yellow-500/50 text-yellow-500">
          <Bell className="h-4 w-4" />
          <AlertTitle className="text-yellow-500 font-semibold ml-2">
            Recurring Expenses Due
          </AlertTitle>
          <AlertDescription className="flex items-center justify-between ml-2 mt-2 text-yellow-200/90">
            <span>
              You have {stats.due_recurring_count} recurring expenses that are due for processing.
            </span>
            <Button size="sm" variant="outline" className="text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/20" asChild>
              <Link href="/recurring-expenses" className="flex items-center gap-2">
                Process Now <ArrowRight className="h-3 w-3" />
              </Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Upcoming Bills and Stats Cards */}
      <div className={cn("grid gap-6", upcomingBills.length > 0 ? "grid-cols-1 lg:grid-cols-4" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3")}>
        {upcomingBills.length > 0 && (
          <div className="lg:col-span-1">
            <UpcomingBills bills={upcomingBills} />
          </div>
        )}
        <div className={cn("grid gap-4 md:grid-cols-3", upcomingBills.length > 0 ? "lg:col-span-3" : "col-span-3")}>
        <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">{t('totalExpenses')}</CardTitle>
            <DollarSign className="h-5 w-5 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {formatCurrency(Number(stats?.total_expenses) || 0, currency, locale)}
            </div>
            <p className="text-xs text-slate-400 mt-1">{t('allTimeSpending')}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">{t('thisMonth')}</CardTitle>
            <Calendar className="h-5 w-5 text-pink-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {formatCurrency(Number(stats?.total_this_month) || 0, currency, locale)}
            </div>
            <div className="flex items-center gap-1 mt-1">
              <TrendingUp className="h-3 w-3 text-green-400" />
              <p className="text-xs text-slate-400">{t('monthlySpending')}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">{t('thisWeek')}</CardTitle>
            <TrendingDown className="h-5 w-5 text-cyan-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {formatCurrency(Number(stats?.total_this_week) || 0, currency, locale)}
            </div>
            <p className="text-xs text-slate-400 mt-1">{t('weeklySpending')}</p>
          </CardContent>
        </Card>
        </div>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Monthly Trend Chart */}
        <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-400" />
              {t('monthlyTrend')}
            </CardTitle>
            <CardDescription className="text-slate-400">
              {t('monthlyTrendDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="month" stroke="#9ca3af" fontSize={12} />
                  <YAxis stroke="#9ca3af" fontSize={12} tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`} />
                    <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #475569',
                      borderRadius: '8px',
                    }}
                    labelStyle={{ color: '#fff' }}
                    formatter={(value) => [formatCurrency(Number(value) || 0, currency, locale), t('monthlyTrend')]}
                  />
                  <Bar
                    dataKey="total"
                    fill="url(#colorGradient)"
                    radius={[4, 4, 0, 0]}
                  />
                  <defs>
                    <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" />
                      <stop offset="100%" stopColor="#14b8a6" />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Category Breakdown Chart */}
        <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <PieChartIcon className="h-5 w-5 text-pink-400" />
              {t('expensesByCategory')}
            </CardTitle>
            <CardDescription className="text-slate-400">
              {t('expensesByCategoryDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              {pieChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {pieChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1e293b',
                        border: '1px solid #475569',
                        borderRadius: '8px',
                      }}
                      formatter={(value) => formatCurrency(Number(value) || 0, currency, locale)}
                    />
                    <Legend
                      wrapperStyle={{ color: '#9ca3af' }}
                      formatter={(value) => <span className="text-slate-300">{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400">
                  <p>{t('noData')}</p>
                </div>
              )}
            </div>

            {/* Budget Limits Section */}
            <div className="mt-8 space-y-4">
              <h3 className="text-lg font-medium text-white">Budget Limits</h3>
              <div className="space-y-4">
                {stats?.expenses_by_category.filter(c => c.monthly_limit).length ? (
                  stats.expenses_by_category.filter(c => c.monthly_limit).map((category) => {
                   const percentage = Math.min(100, (category.total / (category.monthly_limit || 1)) * 100);
                   const isOverBudget = Number(category.total) > (category.monthly_limit || 0);
                   
                   return (
                    <div key={category.category_id} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-300">{category.category_name}</span>
                        <span className={isOverBudget ? "text-red-400 font-medium" : "text-slate-400"}>
                          {formatCurrency(Number(category.total), currency, locale)} / {formatCurrency(Number(category.monthly_limit), currency, locale)}
                        </span>
                      </div>
                      <Progress 
                        value={percentage} 
                        className="h-2 bg-slate-700" 
                        indicatorClassName={isOverBudget ? "bg-red-500" : category.category_color ? undefined : "bg-emerald-500"}
                        style={{ backgroundColor: !isOverBudget && category.category_color ? category.category_color : undefined }}
                      />
                    </div>
                   );
                })) : (
                   <div className="text-center py-4">
                     <p className="text-sm text-slate-500 italic">No budget limits set.</p>
                     <Button variant="link" size="sm" className="text-emerald-400 mt-1" asChild>
                       <Link href="/categories">Set limits in Categories</Link>
                     </Button>
                   </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
