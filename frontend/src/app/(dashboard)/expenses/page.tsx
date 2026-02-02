'use client';

import { useEffect, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, startOfWeek, startOfMonth, endOfMonth, subMonths, startOfYear } from 'date-fns';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { useTranslations, useLocale } from 'next-intl';
import { expensesApi, categoriesApi, authApi, ExpenseFilter, PaginatedResponse, Expense } from '@/lib/api';

import { ExpenseDialog, Category, ExpenseFormData } from '@/components/expenses/ExpenseDialog';
import { ExpenseFilters, DatePreset } from '@/components/expenses/ExpenseFilters';
import { ExpenseTable } from '@/components/expenses/ExpenseTable';
import { ExpenseBulkActions } from '@/components/expenses/ExpenseBulkActions';

// Zod schema
const expenseSchema = z.object({
  amount: z.number().min(0.01, 'Amount must be greater than 0'),
  description: z.string().min(1, 'Description is required'),
  date: z.date({ message: 'Date is required' }),
  category_id: z.string().min(1, 'Category is required'),
  currency: z.string().optional(),
});

// Date range helper
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

  const form = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseSchema),
    defaultValues: { date: new Date() },
  });

  // Check family status
  useEffect(() => {
    authApi.me().then(({ data }) => {
      // @ts-ignore
      if (data.family_id) setHasFamily(true);
    }).catch(console.error);
  }, []);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const filters: ExpenseFilter = { page, page_size: pageSize, scope };
      
      if (filterCategory !== 'all') filters.category_id = parseInt(filterCategory);
      if (debouncedSearch) filters.search = debouncedSearch;
      
      const dateRange = getDateRange(datePreset);
      if (dateRange.start) filters.start_date = format(dateRange.start, 'yyyy-MM-dd');
      if (dateRange.end) filters.end_date = format(dateRange.end, 'yyyy-MM-dd');
      
      const [expensesRes, categoriesRes] = await Promise.all([
        expensesApi.getAll(filters),
        categoriesApi.getAll(),
      ]);
      
      const paginatedData = expensesRes.data as PaginatedResponse<Expense>;
      setExpenses(paginatedData.items);
      setTotal(paginatedData.total);
      setTotalPages(paginatedData.total_pages);
      setCategories(categoriesRes.data);
      setSelectedIds(new Set());
    } catch {
      toast.error(t('failedToLoad'));
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, filterCategory, debouncedSearch, datePreset, scope, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Handlers
  const openCreateDialog = () => {
    setEditingExpense(null);
    form.reset({ amount: 0, description: '', date: new Date(), category_id: '' });
    setIsDialogOpen(true);
  };

  const openEditDialog = (expense: Expense) => {
    setEditingExpense(expense);
    form.setValue('amount', Number(expense.amount));
    form.setValue('description', expense.description);
    form.setValue('date', new Date(expense.date));
    form.setValue('category_id', expense.category_id.toString());
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
        currency: data.currency,
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

  const toggleSelect = (id: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    setSelectedIds(selectedIds.size === expenses.length ? new Set() : new Set(expenses.map(e => e.id)));
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

  // Currency formatter
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-US', {
      style: 'currency',
      currency: locale === 'vi' ? 'VND' : 'USD',
    }).format(value);
  };

  const visibleTotal = expenses.reduce((sum, exp) => sum + Number(exp.amount), 0);
  const datePresetLabels: Record<DatePreset, string> = {
    all: t('DatePresets.all'),
    today: t('DatePresets.today'),
    this_week: t('DatePresets.this_week'),
    this_month: t('DatePresets.this_month'),
    last_month: t('DatePresets.last_month'),
    last_3_months: t('DatePresets.last_3_months'),
    this_year: t('DatePresets.this_year'),
  };

  if (isLoading && expenses.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t('title')}</h1>
          <p className="text-muted-foreground mt-1">{t('subtitle')}</p>
        </div>
        <Button
          onClick={openCreateDialog}
          className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600"
        >
          <Plus className="h-4 w-4 mr-2" />
          {t('addExpense')}
        </Button>
      </div>

      {/* Filters */}
      <ExpenseFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        datePreset={datePreset}
        onDatePresetChange={(preset) => { setDatePreset(preset); setPage(1); }}
        filterCategory={filterCategory}
        onFilterCategoryChange={(cat) => { setFilterCategory(cat); setPage(1); }}
        categories={categories}
        visibleTotal={visibleTotal}
        totalItems={total}
        formatCurrency={formatCurrency}
        hasFamily={hasFamily}
        scope={scope}
        onScopeChange={setScope}
        translations={{
          searchPlaceholder: t('searchPlaceholder'),
          allCategories: t('allCategories'),
          datePresets: datePresetLabels,
        }}
        commonTranslations={{ total: tCommon('total') }}
      />

      {/* Bulk Actions */}
      <ExpenseBulkActions
        selectedCount={selectedIds.size}
        onClear={() => setSelectedIds(new Set())}
        onBulkDelete={handleBulkDelete}
        onBulkCategoryChange={handleBulkCategoryChange}
        categories={categories}
        isBulkDeleting={isBulkDeleting}
        isBulkUpdating={isBulkUpdating}
        bulkCategoryDialogOpen={bulkCategoryDialogOpen}
        onBulkCategoryDialogOpenChange={setBulkCategoryDialogOpen}
        translations={{
          itemsSelected: t('itemsSelected', { count: selectedIds.size }),
          changeCategory: t('changeCategory'),
          changeCategoryDesc: t('changeCategoryDesc', { count: selectedIds.size }),
          selectCategory: t('selectCategory'),
          deleteSelected: t('deleteSelected'),
        }}
        commonTranslations={{ clear: tCommon('clear') }}
      />

      {/* Table */}
      <ExpenseTable
        expenses={expenses}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
        onToggleSelectAll={toggleSelectAll}
        onEdit={openEditDialog}
        onDelete={deleteExpense}
        formatCurrency={formatCurrency}
        page={page}
        pageSize={pageSize}
        total={total}
        totalPages={totalPages}
        onPageChange={setPage}
        searchQuery={debouncedSearch}
        onAddExpense={openCreateDialog}
        isLoading={isLoading}
        translations={{
          noExpenses: t('noExpenses'),
          startTracking: t('startTracking'),
          addExpense: t('addExpense'),
          noResults: tCommon('noResults'),
          noExpensesMatching: t('noExpensesMatching', { query: debouncedSearch }),
        }}
        commonTranslations={{
          date: tCommon('date'),
          category: tCommon('category'),
          description: tCommon('description'),
          amount: tCommon('amount'),
          actions: tCommon('actions'),
        }}
      />

      {/* Dialog */}
      <ExpenseDialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        form={form}
        categories={categories}
        editingExpense={editingExpense}
        isSubmitting={isSubmitting}
        onSubmit={onSubmit}
        translations={{
          editExpense: t('editExpense'),
          addExpense: t('addExpense'),
          editExpenseDesc: t('editExpenseDesc'),
          addExpenseDesc: t('addExpenseDesc'),
          descriptionPlaceholder: t('descriptionPlaceholder'),
          selectCategory: t('selectCategory'),
          pickDate: t('pickDate'),
        }}
        commonTranslations={{
          amount: tCommon('amount'),
          description: tCommon('description'),
          category: tCommon('category'),
          date: tCommon('date'),
          cancel: tCommon('cancel'),
          update: tCommon('update'),
          add: tCommon('add'),
        }}
      />
    </div>
  );
}
