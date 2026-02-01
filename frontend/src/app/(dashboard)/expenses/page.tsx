'use client';

import { useEffect, useState, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, startOfWeek, startOfMonth, endOfMonth, subMonths, startOfYear } from 'date-fns';
import { Plus, Pencil, Trash2, Loader2, Filter, CalendarIcon, Search, ChevronLeft, ChevronRight, X, CameraIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AmountInput } from '@/components/ui/amount-input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { useTranslations, useLocale } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { expensesApi, categoriesApi, ExpenseFilter, PaginatedResponse, Expense } from '@/lib/api';
import { cn } from '@/lib/utils';
import { ExpenseCard } from '@/components/expenses/ExpenseCard';

interface Category {
  id: number;
  name: string;
  icon: string;
  color: string;
}

const expenseSchema = z.object({
  amount: z.number().min(0.01, 'Amount must be greater than 0'),
  description: z.string().min(1, 'Description is required'),
  date: z.date({ message: 'Date is required' }),
  category_id: z.string().min(1, 'Category is required'),
});

type ExpenseFormData = z.infer<typeof expenseSchema>;

const formatCurrency = (value: number, locale: string) => {
  return new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-US', {
    style: 'currency',
    currency: locale === 'vi' ? 'VND' : 'USD',
  }).format(value);
};

// Date range presets
type DatePreset = 'all' | 'today' | 'this_week' | 'this_month' | 'last_month' | 'last_3_months' | 'this_year';

const getDateRange = (preset: DatePreset): { start?: Date; end?: Date } => {
  const today = new Date();
  switch (preset) {
    case 'today':
      return { start: today, end: today };
    case 'this_week':
      return { start: startOfWeek(today, { weekStartsOn: 1 }), end: today };
    case 'this_month':
      return { start: startOfMonth(today), end: today };
    case 'last_month':
      const lastMonth = subMonths(today, 1);
      return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
    case 'last_3_months':
      return { start: startOfMonth(subMonths(today, 2)), end: today };
    case 'this_year':
      return { start: startOfYear(today), end: today };
    default:
      return {};
  }
};



import { authApi } from '@/lib/api';
import { Switch } from '@/components/ui/switch';

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [scope, setScope] = useState<'personal' | 'family'>('personal');
  const [hasFamily, setHasFamily] = useState(false);
  const t = useTranslations('Expenses');
  const tCommon = useTranslations('Common');
  const locale = useLocale();

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
  
  const datePresetLabels: Record<DatePreset, string> = {
    all: t('DatePresets.all'),
    today: t('DatePresets.today'),
    this_week: t('DatePresets.this_week'),
    this_month: t('DatePresets.this_month'),
    last_month: t('DatePresets.last_month'),
    last_3_months: t('DatePresets.last_3_months'),
    this_year: t('DatePresets.this_year'),
  };
  
  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  
  // Filter state
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [bulkCategoryDialogOpen, setBulkCategoryDialogOpen] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      date: new Date(),
    },
  });

  const selectedDate = watch('date');

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1); // Reset to first page on search
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Build filters
      const filters: ExpenseFilter = {
        page,
        page_size: pageSize,
        scope,
      };
      
      if (filterCategory !== 'all') {
        filters.category_id = parseInt(filterCategory);
      }
      
      if (debouncedSearch) {
        filters.search = debouncedSearch;
      }
      
      const dateRange = getDateRange(datePreset);
      if (dateRange.start) {
        filters.start_date = format(dateRange.start, 'yyyy-MM-dd');
      }
      if (dateRange.end) {
        filters.end_date = format(dateRange.end, 'yyyy-MM-dd');
      }
      
      const [expensesRes, categoriesRes] = await Promise.all([
        expensesApi.getAll(filters),
        categoriesApi.getAll(),
      ]);
      
      const paginatedData = expensesRes.data as PaginatedResponse<Expense>;
      setExpenses(paginatedData.items);
      setTotal(paginatedData.total);
      setTotalPages(paginatedData.total_pages);
      setCategories(categoriesRes.data);
      setSelectedIds(new Set()); // Clear selection on data change
    } catch {
      toast.error(t('failedToLoad'));
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, filterCategory, debouncedSearch, datePreset, scope, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleFilterChange = (categoryId: string) => {
    setFilterCategory(categoryId);
    setPage(1);
  };

  const handleDatePresetChange = (preset: DatePreset) => {
    setDatePreset(preset);
    setPage(1);
  };

  const openEditDialog = (expense: Expense) => {
    setEditingExpense(expense);
    setValue('amount', expense.amount);
    setValue('description', expense.description);
    setValue('date', new Date(expense.date));
    setValue('category_id', expense.category_id.toString());
    setIsDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingExpense(null);
    reset({
      amount: 0,
      description: '',
      date: new Date(),
      category_id: '',
    });
    setIsDialogOpen(true);
  };

  const onSubmit = async (data: ExpenseFormData) => {
    setIsSubmitting(true);
    try {
      const payload = {
        amount: data.amount,
        description: data.description,
        date: format(data.date, 'yyyy-MM-dd'),
        category_id: parseInt(data.category_id),
      };

      if (editingExpense) {
        await expensesApi.update(editingExpense.id, payload);
        toast.success(t('successUpdate'));
      } else {
        await expensesApi.create(payload);
        toast.success(t('successAdd'));
      }
      setIsDialogOpen(false);
      fetchData();
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { detail?: string } } };
      toast.error(axiosError.response?.data?.detail || t('failedSave'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteExpense = async (id: number) => {
    if (!confirm(t('confirmDelete'))) return;

    try {
      await expensesApi.delete(id);
      toast.success(t('successDelete'));
      fetchData();
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { detail?: string } } };
      toast.error(axiosError.response?.data?.detail || t('failedDelete'));
    }
  };

  // Bulk selection handlers
  const toggleSelectAll = () => {
    if (selectedIds.size === expenses.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(expenses.map(e => e.id)));
    }
  };

  const toggleSelect = (id: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkDelete = async () => {
    if (!confirm(t('confirmBulkDelete', { count: selectedIds.size }))) return;
    
    setIsBulkDeleting(true);
    try {
      await expensesApi.bulkDelete(Array.from(selectedIds));
      toast.success(t('successBulkDelete', { count: selectedIds.size }));
      setSelectedIds(new Set());
      fetchData();
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { detail?: string } } };
      toast.error(axiosError.response?.data?.detail || t('failedBulkDelete'));
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleBulkCategoryChange = async (categoryId: string) => {
    setIsBulkUpdating(true);
    try {
      await expensesApi.bulkUpdate(Array.from(selectedIds), parseInt(categoryId));
      toast.success(t('successBulkUpdate', { count: selectedIds.size }));
      setSelectedIds(new Set());
      setBulkCategoryDialogOpen(false);
      fetchData();
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { detail?: string } } };
      toast.error(axiosError.response?.data?.detail || t('failedBulkUpdate'));
    } finally {
      setIsBulkUpdating(false);
    }
  };

  if (isLoading && expenses.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  const visibleTotal = expenses.reduce((sum, exp) => sum + Number(exp.amount), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">{t('title')}</h1>
          <p className="text-slate-400 mt-1">{t('subtitle')}</p>
        </div>
        
        {hasFamily && (
          <div className="flex items-center space-x-2 bg-slate-800 p-2 rounded-lg border border-slate-700 mr-auto sm:mr-0">
             <Switch
              id="family-mode-expenses"
              checked={scope === 'family'}
              onCheckedChange={(checked) => setScope(checked ? 'family' : 'personal')}
            />
            <Label htmlFor="family-mode-expenses" className="text-white cursor-pointer select-none">
              Family View
            </Label>
          </div>
        )}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={openCreateDialog}
              className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600"
            >
              <Plus className="h-4 w-4 mr-2" />
              {t('addExpense')}
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-slate-900 border-slate-700">
            <DialogHeader>
              <DialogTitle className="text-white">
                {editingExpense ? t('editExpense') : t('addExpense')}
              </DialogTitle>
              <DialogDescription className="text-slate-400">
                {editingExpense ? t('editExpenseDesc') : t('addExpenseDesc')}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)}>
              <div className="space-y-4 py-4">
                {/* Scan Receipt Button (Only for new expenses) */}
                {!editingExpense && (
                  <div className="relative">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      id="receipt-upload"
                      onChange={async (e) => {
                         const file = e.target.files?.[0];
                         if (!file) return;
                         
                         const toastId = toast.loading('Scanning receipt...');
                         try {
                           const { data } = await import('@/lib/api').then(m => m.ocrApi.scanReceipt(file));
                           
                           if (data.amount) setValue('amount', data.amount);
                           if (data.date) setValue('date', new Date(data.date));
                           if (data.merchant) setValue('description', data.merchant);
                           else setValue('description', 'Receipt scan ' + new Date().toLocaleDateString());
                           
                           toast.success('Receipt scanned!', { id: toastId });
                         } catch (error) {
                           console.error(error);
                           toast.error('Failed to scan receipt. Ensure Tesseract is installed on server.', { id: toastId });
                         }
                         // Reset input
                         e.target.value = '';
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full border-dashed border-2 border-slate-700 bg-slate-800/50 hover:bg-slate-800 hover:border-emerald-500 hover:text-emerald-500 transition-all text-slate-400"
                      onClick={() => document.getElementById('receipt-upload')?.click()}
                    >
                      <div className="flex flex-col items-center gap-2 py-2">
                        <CameraIcon className="h-6 w-6" />
                        <span>Scan Receipt (Auto-fill)</span>
                      </div>
                    </Button>
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-slate-200">{tCommon('amount')} ({locale === 'vi' ? 'VND' : 'USD'})</Label>
                  <Controller
                    control={control}
                    name="amount"
                    render={({ field }) => (
                      <AmountInput
                        placeholder="0"
                        className="bg-slate-800 border-slate-700 text-white"
                        value={field.value}
                        onValueChange={field.onChange}
                      />
                    )}
                  />
                  {errors.amount && (
                    <p className="text-sm text-red-400">{errors.amount.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-200">{tCommon('description')}</Label>
                  <Input
                    placeholder={t('descriptionPlaceholder')}
                    className="bg-slate-800 border-slate-700 text-white"
                    {...register('description')}
                  />
                  {errors.description && (
                    <p className="text-sm text-red-400">{errors.description.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-200">{tCommon('category')}</Label>
                  <Select
                    value={watch('category_id')}
                    onValueChange={(value) => setValue('category_id', value)}
                  >
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                      <SelectValue placeholder={t('selectCategory')} />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      {categories.map((category) => (
                        <SelectItem
                          key={category.id}
                          value={category.id.toString()}
                          className="text-white hover:bg-slate-700"
                        >
                          <span className="flex items-center gap-2">
                            <span>{category.icon}</span>
                            <span>{category.name}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.category_id && (
                    <p className="text-sm text-red-400">{errors.category_id.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-200">{tCommon('date')}</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full justify-start text-left font-normal bg-slate-800 border-slate-700',
                          !selectedDate && 'text-muted-foreground'
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {selectedDate ? format(selectedDate, 'PPP') : <span>{t('pickDate')}</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-slate-800 border-slate-700">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={(date) => date && setValue('date', date)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  {errors.date && (
                    <p className="text-sm text-red-400">{errors.date.message}</p>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsDialogOpen(false)}
                  className="text-slate-400"
                >
                  {tCommon('cancel')}
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-gradient-to-r from-emerald-500 to-teal-500"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : editingExpense ? (
                    tCommon('update')
                  ) : (
                    tCommon('add')
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col gap-4">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder={t('searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-slate-800 border-slate-700 text-white"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-slate-400"
              onClick={() => setSearchQuery('')}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Date Presets */}
        <div className="flex flex-wrap gap-2">
          {(Object.keys(datePresetLabels) as DatePreset[]).map((preset) => (
            <Button
              key={preset}
              variant={datePreset === preset ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleDatePresetChange(preset)}
              className={cn(
                datePreset === preset
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
              )}
            >
              {datePresetLabels[preset]}
            </Button>
          ))}
        </div>

        {/* Summary and Category Filter */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Card className="flex-1 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border-emerald-500/30">
            <CardContent className="pt-6">
              <p className="text-sm text-slate-400">
                {datePreset === 'all' ? tCommon('total') : datePresetLabels[datePreset]} ({total} items)
              </p>
              <p className="text-2xl font-bold text-white">{formatCurrency(visibleTotal, locale)}</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-6 flex items-center gap-3">
              <Filter className="h-5 w-5 text-slate-400" />
              <Select value={filterCategory} onValueChange={handleFilterChange}>
                <SelectTrigger className="w-48 bg-slate-800 border-slate-700 text-white">
                  <SelectValue placeholder={t('allCategories')} />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="all" className="text-white hover:bg-slate-700">
                    {t('allCategories')}
                  </SelectItem>
                  {categories.map((category) => (
                    <SelectItem
                      key={category.id}
                      value={category.id.toString()}
                      className="text-white hover:bg-slate-700"
                    >
                      <span className="flex items-center gap-2">
                        <span>{category.icon}</span>
                        <span>{category.name}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <Card className="bg-emerald-900/30 border-emerald-500/50">
          <CardContent className="py-3 flex items-center justify-between">
            <span className="text-emerald-300 font-medium">
              {t('itemsSelected', { count: selectedIds.size })}
            </span>
            <div className="flex gap-2">
              <Dialog open={bulkCategoryDialogOpen} onOpenChange={setBulkCategoryDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="border-emerald-500 text-emerald-300 hover:bg-emerald-900/50">
                    {t('changeCategory')}
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-slate-900 border-slate-700">
                  <DialogHeader>
                    <DialogTitle className="text-white">{t('changeCategory')}</DialogTitle>
                    <DialogDescription className="text-slate-400">
                      {t('changeCategoryDesc', { count: selectedIds.size })}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4">
                    <Select onValueChange={handleBulkCategoryChange} disabled={isBulkUpdating}>
                      <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                        <SelectValue placeholder={t('selectCategory')} />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        {categories.map((category) => (
                          <SelectItem
                            key={category.id}
                            value={category.id.toString()}
                            className="text-white hover:bg-slate-700"
                          >
                            <span className="flex items-center gap-2">
                              <span>{category.icon}</span>
                              <span>{category.name}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </DialogContent>
              </Dialog>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDelete}
                disabled={isBulkDeleting}
              >
                {isBulkDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />}
                {t('deleteSelected')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedIds(new Set())}
                className="text-slate-400"
              >
                <X className="h-4 w-4 mr-1" />
                {tCommon('clear')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Expenses Table */}
      {expenses.length === 0 ? (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="h-16 w-16 rounded-full bg-slate-700 flex items-center justify-center mb-4">
              <Plus className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">
              {debouncedSearch ? tCommon('noResults') : t('noExpenses')}
            </h3>
            <p className="text-slate-400 text-center mb-4">
              {debouncedSearch
                ? t('noExpensesMatching', { query: debouncedSearch })
                : t('startTracking')}
            </p>
            {!debouncedSearch && (
              <Button
                onClick={openCreateDialog}
                className="bg-gradient-to-r from-emerald-500 to-teal-500"
              >
                <Plus className="h-4 w-4 mr-2" />
                {t('addExpense')}
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="md:hidden">
            {expenses.map((expense) => (
              <ExpenseCard 
                key={expense.id} 
                expense={expense} 
                onEdit={(e) => openEditDialog(e)} 
                onDelete={(id) => deleteExpense(id)} 
              />
            ))}
          </div>

          <Card className="hidden md:block bg-slate-800/50 border-slate-700 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-700 hover:bg-slate-800">
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedIds.size === expenses.length && expenses.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="text-slate-400">{tCommon('date')}</TableHead>
                  <TableHead className="text-slate-400">{tCommon('category')}</TableHead>
                  <TableHead className="text-slate-400">{tCommon('description')}</TableHead>
                  <TableHead className="text-slate-400 text-right">{tCommon('amount')}</TableHead>
                  <TableHead className="text-slate-400 text-right">{tCommon('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((expense) => (
                  <TableRow
                    key={expense.id}
                    className={cn(
                      'border-slate-700 hover:bg-slate-800/50',
                      selectedIds.has(expense.id) && 'bg-emerald-900/20'
                    )}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(expense.id)}
                        onCheckedChange={() => toggleSelect(expense.id)}
                      />
                    </TableCell>
                    <TableCell className="text-slate-300">
                      {format(new Date(expense.date), 'MMM dd, yyyy')}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-sm"
                          style={{ backgroundColor: `${expense.category?.color}20` }}
                        >
                          {expense.category?.icon}
                        </span>
                        <span className="text-slate-300">{expense.category?.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-white max-w-xs truncate">
                      {expense.description}
                    </TableCell>
                    <TableCell className="text-right font-medium text-white">
                      {formatCurrency(Number(expense.amount), locale)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(expense)}
                          className="h-8 w-8 text-slate-400 hover:text-white"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteExpense(expense.id)}
                          className="h-8 w-8 text-slate-400 hover:text-red-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-400">
                Showing {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, total)} of {total}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="bg-slate-800 border-slate-700 text-white disabled:opacity-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <span className="text-sm text-slate-400">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="bg-slate-800 border-slate-700 text-white disabled:opacity-50"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
