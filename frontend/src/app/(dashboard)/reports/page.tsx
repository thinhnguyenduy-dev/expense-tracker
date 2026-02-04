'use client';

import { useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { format, subDays } from 'date-fns';
import { vi, enUS } from 'date-fns/locale';
import { Loader2, Calendar as CalendarIcon, Users, Download, TrendingUp, TrendingDown, PiggyBank, Wallet } from 'lucide-react';
import { DateRange } from 'react-day-picker';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from 'recharts';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { reportsApi, authApi, ReportResponse } from '@/lib/api';
import { cn } from '@/lib/utils';

export default function ReportsPage() {
  const [data, setData] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [scope, setScope] = useState<'personal' | 'family'>('personal');
  const [hasFamily, setHasFamily] = useState(false);
  
  const t = useTranslations('Reports');
  const tCommon = useTranslations('Common');
  const locale = useLocale();

  // Check family status
  useEffect(() => {
    authApi.me().then(({ data }) => {
      // @ts-ignore
      if (data.family_id) setHasFamily(true);
    }).catch(console.error);
  }, []);

  const fetchReports = async () => {
    if (!date?.from || !date?.to) return;
    
    setLoading(true);
    try {
      const start = format(date.from, 'yyyy-MM-dd');
      const end = format(date.to, 'yyyy-MM-dd');
      const response = await reportsApi.get(start, end, scope);
      setData(response.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
      try {
          const response = await reportsApi.export();
          const url = window.URL.createObjectURL(new Blob([response.data]));
          const link = document.createElement('a');
          link.href = url;
          const fileName = `expense_report_${format(new Date(), 'yyyy-MM-dd')}.csv`;
          link.setAttribute('download', fileName);
          document.body.appendChild(link);
          link.click();
          link.parentNode?.removeChild(link);
      } catch (error) {
          console.error("Export failed", error);
      }
  };

  useEffect(() => {
    fetchReports();
  }, [date, scope]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-US', {
      style: 'currency',
      currency: locale === 'vi' ? 'VND' : 'USD',
      maximumFractionDigits: 0,
    }).format(value);
  };

  const CustomTooltip = ({ active, payload, label }: { active?: boolean, payload?: any[], label?: string }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border p-2 rounded shadow-lg">
          <p className="text-muted-foreground text-sm mb-1">{format(new Date(label || ''), 'MMM dd, yyyy', { locale: locale === 'vi' ? vi : enUS })}</p>
          <p className="text-emerald-500 font-bold">
            {formatCurrency(payload[0].value)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <h2 className="text-3xl font-bold tracking-tight text-foreground">{t('title')}</h2>
        
        <div className="flex items-center gap-4">
          {hasFamily && (
            <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <Switch
                id="family-mode-reports"
                checked={scope === 'family'}
                onCheckedChange={(checked: boolean) => setScope(checked ? 'family' : 'personal')}
              />
              <Label htmlFor="family-mode-reports" className="text-foreground cursor-pointer select-none">
                View Family
              </Label>
            </div>
          )}
          <Button variant="outline" onClick={handleExport} className="border-border bg-muted text-foreground hover:bg-muted/80">
            <Download className="mr-2 h-4 w-4" />
            {tCommon('export')}
          </Button>

          <Popover>
          <PopoverTrigger asChild>
            <Button
              id="date"
              variant={"outline"}
              className={cn(
                "w-[300px] justify-start text-left font-normal border-border bg-muted text-foreground hover:bg-muted/80",
                !date && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {date?.from ? (
                date.to ? (
                  <>
                    {format(date.from, "LLL dd, y", { locale: locale === 'vi' ? vi : enUS })} -{" "}
                    {format(date.to, "LLL dd, y", { locale: locale === 'vi' ? vi : enUS })}
                  </>
                ) : (
                  format(date.from, "LLL dd, y", { locale: locale === 'vi' ? vi : enUS })
                )
              ) : (
                <span>Pick a date</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 bg-card border-border" align="end">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={date?.from}
              selected={date}
              onSelect={setDate}
              numberOfMonths={2}
              className="bg-card text-foreground"
            />
          </PopoverContent>
        </Popover>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
        </div>
      ) : data ? (
        <div className="space-y-6">
            
            {/* Savings Stats Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="bg-card border-border">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">{t('savingsRate')}</CardTitle>
                        <PieChart className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-foreground">{data.savings_stats?.current_savings_rate}%</div>
                        <p className="text-xs text-muted-foreground">
                            {t('ofIncomeSaved')}
                        </p>
                    </CardContent>
                </Card>
                <Card className="bg-card border-border">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">{t('netSavings')}</CardTitle>
                        <PiggyBank className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${data.savings_stats?.net_savings >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                            {formatCurrency(Number(data.savings_stats?.net_savings))}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {t('totalSavingsPeriod')}
                        </p>
                    </CardContent>
                </Card>
                 <Card className="bg-card border-border">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">{t('totalIncome')}</CardTitle>
                        <TrendingUp className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-foreground">{formatCurrency(Number(data.savings_stats?.total_income))}</div>
                    </CardContent>
                </Card>
                 <Card className="bg-card border-border">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">{t('totalExpense')}</CardTitle>
                        <TrendingDown className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-foreground">{formatCurrency(Number(data.savings_stats?.total_expense))}</div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
            
            {/* Income vs Expense Chart */}
            <Card className="col-span-2 bg-card border-border">
                <CardHeader>
                    <CardTitle className="text-foreground">{t('incomeVsExpense')}</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data.income_vs_expense}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                <XAxis 
                                    dataKey="month" 
                                    stroke="#94a3b8" 
                                />
                                <YAxis 
                                    stroke="#94a3b8"
                                    tickFormatter={(val) => new Intl.NumberFormat('en-US', { notation: "compact", maximumFractionDigits: 1 }).format(val)}
                                />
                                <Tooltip 
                                    content={({ active, payload, label }) => {
                                        if (active && payload && payload.length) {
                                            return (
                                                <div className="bg-card border border-border p-2 rounded shadow-lg">
                                                    <p className="text-muted-foreground text-sm mb-1">{label}</p>
                                                    <p className="text-emerald-500 text-sm">Income: {formatCurrency(payload[0].value as number)}</p>
                                                    <p className="text-red-500 text-sm">Expense: {formatCurrency(payload[1].value as number)}</p>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Legend />
                                <Bar dataKey="income" name={t('income')} fill="#10b981" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="expense" name={t('expense')} fill="#ef4444" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            {/* Spending Trend */}
            <Card className="col-span-2 bg-card border-border">
                <CardHeader>
                    <CardTitle className="text-foreground">{t('spendingTrend')}</CardTitle>
                    <CardDescription className="text-muted-foreground">
                        Total: <span className="text-emerald-500 font-medium">{formatCurrency(Number(data.total_period))}</span>
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={data.daily_expenses}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                <XAxis 
                                    dataKey="date" 
                                    stroke="#94a3b8" 
                                    tickFormatter={(val) => format(new Date(val), 'MMM dd', { locale: locale === 'vi' ? vi : enUS })}
                                    minTickGap={30}
                                />
                                <YAxis 
                                    stroke="#94a3b8"
                                    tickFormatter={(val) => new Intl.NumberFormat('en-US', { notation: "compact", maximumFractionDigits: 1 }).format(val)}
                                />
                                <Tooltip content={<CustomTooltip />} />
                                <Line 
                                    type="monotone" 
                                    dataKey="amount" 
                                    stroke="#10b981" 
                                    strokeWidth={3}
                                    dot={false}
                                    activeDot={{ r: 6, fill: "#10b981" }} 
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            {/* Category Breakdown */}
            <Card className="col-span-1 md:col-span-1 bg-card border-border">
                <CardHeader>
                    <CardTitle className="text-foreground">{t('categoryBreakdown')}</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="h-[300px] w-full">
                         <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={data.category_breakdown}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="amount"
                                >
                                    {data.category_breakdown.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.category_color} stroke="none" />
                                    ))}
                                </Pie>
                                <Tooltip 
                                    content={({ active, payload }: any) => {
                                        if (active && payload && payload.length) {
                                            const d = payload[0].payload;
                                            return (
                                                <div className="bg-card border border-border p-2 rounded shadow-lg">
                                                    <p className="text-foreground font-medium mb-1" style={{ color: d.category_color }}>{d.category_name}</p>
                                                    <p className="text-muted-foreground text-sm">{formatCurrency(d.amount)} ({d.percentage}%)</p>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />

                            </PieChart>
                         </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>
            
            {/* Top Categories List */}
            <Card className="col-span-1 md:col-span-1 bg-card border-border">
                <CardHeader>
                    <CardTitle className="text-foreground">{t('details')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                     {data.category_breakdown.map((cat) => (
                         <div key={cat.category_id} className="flex items-center justify-between">
                             <div className="flex items-center gap-2">
                                 <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.category_color }}></div>
                                 <span className="text-foreground">{cat.category_name}</span>
                             </div>
                             <div className="text-right">
                                 <div className="text-foreground font-medium">{formatCurrency(Number(cat.amount))}</div>
                                 <div className="text-xs text-muted-foreground">{cat.percentage}%</div>
                             </div>
                         </div>
                     ))}
                     {data.category_breakdown.length === 0 && (
                         <p className="text-muted-foreground text-center py-4">{t('noData')}</p>
                     )}
                </CardContent>
            </Card>

        </div>
        </div>
      ) : null}
    </div>
  );
}
