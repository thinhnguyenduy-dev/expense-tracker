'use client';

import { useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { format, subDays } from 'date-fns';
import { Loader2, Calendar as CalendarIcon, Users } from 'lucide-react';
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
  Legend
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
        <div className="bg-slate-800 border border-slate-700 p-2 rounded shadow-lg">
          <p className="text-slate-300 text-sm mb-1">{format(new Date(label || ''), 'MMM dd, yyyy')}</p>
          <p className="text-emerald-400 font-bold">
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
        <h2 className="text-3xl font-bold tracking-tight text-white">{t('title')}</h2>
        
        <div className="flex items-center gap-4">
          {hasFamily && (
            <div className="flex items-center gap-2 bg-slate-800 rounded-lg px-3 py-2">
              <Users className="h-4 w-4 text-slate-400" />
              <Switch
                id="family-mode-reports"
                checked={scope === 'family'}
                onCheckedChange={(checked: boolean) => setScope(checked ? 'family' : 'personal')}
              />
              <Label htmlFor="family-mode-reports" className="text-white cursor-pointer select-none">
                View Family
              </Label>
            </div>
          )}
          <Popover>
          <PopoverTrigger asChild>
            <Button
              id="date"
              variant={"outline"}
              className={cn(
                "w-[300px] justify-start text-left font-normal border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700",
                !date && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {date?.from ? (
                date.to ? (
                  <>
                    {format(date.from, "LLL dd, y")} -{" "}
                    {format(date.to, "LLL dd, y")}
                  </>
                ) : (
                  format(date.from, "LLL dd, y")
                )
              ) : (
                <span>Pick a date</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 bg-slate-800 border-slate-700" align="end">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={date?.from}
              selected={date}
              onSelect={setDate}
              numberOfMonths={2}
              className="bg-slate-800 text-white"
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
        <div className="grid gap-6 md:grid-cols-2">
            {/* Spending Trend */}
            <Card className="col-span-2 bg-slate-800/50 border-slate-700">
                <CardHeader>
                    <CardTitle className="text-white">{t('spendingTrend')}</CardTitle>
                    <CardDescription className="text-slate-400">
                        Total: <span className="text-emerald-400 font-medium">{formatCurrency(Number(data.total_period))}</span>
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
                                    tickFormatter={(val) => format(new Date(val), 'MMM dd')}
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
            <Card className="col-span-1 md:col-span-1 bg-slate-800/50 border-slate-700">
                <CardHeader>
                    <CardTitle className="text-white">{t('categoryBreakdown')}</CardTitle>
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
                                                <div className="bg-slate-800 border border-slate-700 p-2 rounded shadow-lg">
                                                    <p className="text-white font-medium mb-1" style={{ color: d.category_color }}>{d.category_name}</p>
                                                    <p className="text-slate-300 text-sm">{formatCurrency(d.amount)} ({d.percentage}%)</p>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Legend 
                                    verticalAlign="bottom" 
                                    height={36}
                                    formatter={(value: any, entry: any) => <span className="text-slate-300 ml-1">{entry.payload.category_name}</span>}
                                />
                            </PieChart>
                         </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>
            
            {/* Top Categories List */}
            <Card className="col-span-1 md:col-span-1 bg-slate-800/50 border-slate-700">
                <CardHeader>
                    <CardTitle className="text-white">{t('details')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                     {data.category_breakdown.map((cat) => (
                         <div key={cat.category_id} className="flex items-center justify-between">
                             <div className="flex items-center gap-2">
                                 <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.category_color }}></div>
                                 <span className="text-slate-200">{cat.category_name}</span>
                             </div>
                             <div className="text-right">
                                 <div className="text-white font-medium">{formatCurrency(Number(cat.amount))}</div>
                                 <div className="text-xs text-slate-500">{cat.percentage}%</div>
                             </div>
                         </div>
                     ))}
                     {data.category_breakdown.length === 0 && (
                         <p className="text-slate-400 text-center py-4">{t('noData')}</p>
                     )}
                </CardContent>
            </Card>

        </div>
      ) : null}
    </div>
  );
}
