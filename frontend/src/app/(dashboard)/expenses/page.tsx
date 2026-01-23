'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { Plus, Pencil, Trash2, Loader2, Filter, CalendarIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
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
import { expensesApi, categoriesApi, ExpenseFilter } from '@/lib/api';
import { cn } from '@/lib/utils';

interface Category {
  id: number;
  name: string;
  icon: string;
  color: string;
}

interface Expense {
  id: number;
  amount: number;
  description: string;
  date: string;
  category_id: number;
  category: Category;
  created_at: string;
}

const expenseSchema = z.object({
  amount: z.string().min(1, 'Amount is required'),
  description: z.string().min(1, 'Description is required'),
  date: z.date({ message: 'Date is required' }),
  category_id: z.string().min(1, 'Category is required'),
});

type ExpenseFormData = z.infer<typeof expenseSchema>;

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(value);
};

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filters, setFilters] = useState<ExpenseFilter>({});
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const {
    register,
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

  const fetchData = async () => {
    try {
      const [expensesRes, categoriesRes] = await Promise.all([
        expensesApi.getAll(filters),
        categoriesApi.getAll(),
      ]);
      setExpenses(expensesRes.data);
      setCategories(categoriesRes.data);
    } catch {
      toast.error('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filters]);

  const handleFilterChange = (categoryId: string) => {
    setFilterCategory(categoryId);
    if (categoryId === 'all') {
      setFilters({});
    } else {
      setFilters({ category_id: parseInt(categoryId) });
    }
  };

  const openEditDialog = (expense: Expense) => {
    setEditingExpense(expense);
    setValue('amount', expense.amount.toString());
    setValue('description', expense.description);
    setValue('date', new Date(expense.date));
    setValue('category_id', expense.category_id.toString());
    setIsDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingExpense(null);
    reset({
      amount: '',
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
        amount: parseFloat(data.amount),
        description: data.description,
        date: format(data.date, 'yyyy-MM-dd'),
        category_id: parseInt(data.category_id),
      };

      if (editingExpense) {
        await expensesApi.update(editingExpense.id, payload);
        toast.success('Expense updated successfully');
      } else {
        await expensesApi.create(payload);
        toast.success('Expense added successfully');
      }
      setIsDialogOpen(false);
      fetchData();
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { detail?: string } } };
      toast.error(axiosError.response?.data?.detail || 'Failed to save expense');
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteExpense = async (id: number) => {
    if (!confirm('Are you sure you want to delete this expense?')) return;

    try {
      await expensesApi.delete(id);
      toast.success('Expense deleted successfully');
      fetchData();
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { detail?: string } } };
      toast.error(axiosError.response?.data?.detail || 'Failed to delete expense');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  const totalExpenses = expenses.reduce((sum, exp) => sum + Number(exp.amount), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Expenses</h1>
          <p className="text-slate-400 mt-1">Track and manage your spending</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={openCreateDialog}
              className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Expense
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-slate-900 border-slate-700">
            <DialogHeader>
              <DialogTitle className="text-white">
                {editingExpense ? 'Edit Expense' : 'Add Expense'}
              </DialogTitle>
              <DialogDescription className="text-slate-400">
                {editingExpense ? 'Update expense details' : 'Record a new expense'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label className="text-slate-200">Amount (VND)</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    className="bg-slate-800 border-slate-700 text-white"
                    {...register('amount')}
                  />
                  {errors.amount && (
                    <p className="text-sm text-red-400">{errors.amount.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-200">Description</Label>
                  <Input
                    placeholder="What did you spend on?"
                    className="bg-slate-800 border-slate-700 text-white"
                    {...register('description')}
                  />
                  {errors.description && (
                    <p className="text-sm text-red-400">{errors.description.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-200">Category</Label>
                  <Select
                    value={watch('category_id')}
                    onValueChange={(value) => setValue('category_id', value)}
                  >
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                      <SelectValue placeholder="Select a category" />
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
                  <Label className="text-slate-200">Date</Label>
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
                        {selectedDate ? format(selectedDate, 'PPP') : <span>Pick a date</span>}
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
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-gradient-to-r from-emerald-500 to-teal-500"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : editingExpense ? (
                    'Update'
                  ) : (
                    'Add'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Card className="flex-1 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border-emerald-500/30">
          <CardContent className="pt-6">
            <p className="text-sm text-slate-400">Total Expenses</p>
            <p className="text-2xl font-bold text-white">{formatCurrency(totalExpenses)}</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="pt-6 flex items-center gap-3">
            <Filter className="h-5 w-5 text-slate-400" />
            <Select value={filterCategory} onValueChange={handleFilterChange}>
              <SelectTrigger className="w-48 bg-slate-800 border-slate-700 text-white">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="all" className="text-white hover:bg-slate-700">
                  All Categories
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

      {/* Expenses Table */}
      {expenses.length === 0 ? (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="h-16 w-16 rounded-full bg-slate-700 flex items-center justify-center mb-4">
              <Plus className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">No expenses yet</h3>
            <p className="text-slate-400 text-center mb-4">
              Start tracking your spending by adding your first expense
            </p>
            <Button
              onClick={openCreateDialog}
              className="bg-gradient-to-r from-emerald-500 to-teal-500"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Expense
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-slate-800/50 border-slate-700 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-700 hover:bg-slate-800">
                <TableHead className="text-slate-400">Date</TableHead>
                <TableHead className="text-slate-400">Category</TableHead>
                <TableHead className="text-slate-400">Description</TableHead>
                <TableHead className="text-slate-400 text-right">Amount</TableHead>
                <TableHead className="text-slate-400 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((expense) => (
                <TableRow
                  key={expense.id}
                  className="border-slate-700 hover:bg-slate-800/50"
                >
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
                    {formatCurrency(Number(expense.amount))}
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
      )}
    </div>
  );
}
