'use client';

import { useEffect, useState } from 'react';
import { 
  Plus, 
  Target, 
  Calendar as CalendarIcon, 
  TrendingUp, 
  MoreVertical, 
  Pencil, 
  Trash2,
  PiggyBank
} from 'lucide-react';
import { format } from 'date-fns';
import { z } from 'zod';
import { useForm, SubmitHandler, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations, useLocale } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { AmountInput } from '@/components/ui/amount-input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { goalsApi, Goal } from '@/lib/api';
import { toast } from 'sonner';

const formSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  target_amount: z.number().min(0.01, 'Target amount must be a positive number'),
  current_amount: z.number().min(0, 'Current amount must be be non-negative'),
  deadline: z.date().optional(),
  description: z.string().optional(),
  color: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [savingGoal, setSavingGoal] = useState<Goal | null>(null);
  const t = useTranslations('Goals');
  const tCommon = useTranslations('Common');

  const fetchGoals = async () => {
    try {
      const response = await goalsApi.getAll();
      setGoals(response.data);
    } catch (error) {
      toast.error(t('failedToLoad'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGoals();
  }, []);

  const handleDelete = async (id: number) => {
    try {
      await goalsApi.delete(id);
      setGoals(goals.filter((g) => g.id !== id));
      toast.success(t('successDelete'));
    } catch (error) {
      toast.error(t('failedDelete'));
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">{t('title')}</h1>
          <p className="text-slate-400 mt-1">{t('subtitle')}</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} className="bg-emerald-500 hover:bg-emerald-600">
          <Plus className="h-4 w-4 mr-2" />
          {t('newGoal')}
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {goals.map((goal) => (
          <GoalCard 
            key={goal.id} 
            goal={goal} 
            onEdit={() => setEditingGoal(goal)}
            onDelete={() => handleDelete(goal.id)}
            onAddSavings={() => setSavingGoal(goal)}
          />
        ))}

        {goals.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center py-12 text-slate-400 bg-slate-900/50 rounded-lg border border-slate-800 border-dashed">
            <Target className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">{t('noGoals')}</p>
            <p className="text-sm">{t('startSaving')}</p>
          </div>
        )}
      </div>

      <GoalDialog 
        open={isCreateOpen} 
        onOpenChange={setIsCreateOpen} 
        onSuccess={(goal) => {
          setGoals([...goals, goal]);
          setIsCreateOpen(false);
        }}
      />

      {editingGoal && (
        <GoalDialog
          open={!!editingGoal}
          onOpenChange={(open) => !open && setEditingGoal(null)}
          goal={editingGoal}
          onSuccess={(updatedGoal) => {
            setGoals(goals.map((g) => (g.id === updatedGoal.id ? updatedGoal : g)));
            setEditingGoal(null);
          }}
        />
      )}

      {savingGoal && (
        <AddSavingsDialog
          open={!!savingGoal}
          onOpenChange={(open) => !open && setSavingGoal(null)}
          goal={savingGoal}
          onSuccess={(updatedGoal) => {
            setGoals(goals.map((g) => (g.id === updatedGoal.id ? updatedGoal : g)));
            setSavingGoal(null);
          }}
        />
      )}
    </div>
  );
}

function GoalCard({ 
  goal, 
  onEdit, 
  onDelete, 
  onAddSavings 
}: { 
  goal: Goal; 
  onEdit: () => void; 
  onDelete: () => void;
  onAddSavings: () => void;
}) {
  const percentage = Math.min(100, (goal.current_amount / goal.target_amount) * 100);
  const remaining = goal.target_amount - goal.current_amount;
  
  // Calculate monthly suggestion
  let monthlySuggestion = 0;
  if (goal.deadline && remaining > 0) {
    const months = Math.max(
      1, 
      (new Date(goal.deadline).getFullYear() - new Date().getFullYear()) * 12 + 
      (new Date(goal.deadline).getMonth() - new Date().getMonth())
    );
    monthlySuggestion = remaining / months;
  }

  const locale = useLocale();
  const t = useTranslations('Goals');
  const tCommon = useTranslations('Common');

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-US', { style: 'currency', currency: locale === 'vi' ? 'VND' : 'USD' }).format(val);

  return (
    <Card className="bg-slate-900 border-slate-800 hover:border-slate-700 transition-colors">
      <CardHeader className="flex flex-row items-start justify-between pb-2">
        <div>
          <CardTitle className="text-lg font-semibold text-white">{goal.name}</CardTitle>
          <CardDescription className="text-slate-400 mt-1 line-clamp-1">
            {goal.description || 'No description'}
          </CardDescription>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0 text-slate-400 hover:text-white">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-slate-800 border-slate-700">
              <DropdownMenuItem onClick={onEdit} className="text-slate-200 hover:bg-slate-700 cursor-pointer">
                <Pencil className="h-4 w-4 mr-2" /> {tCommon('edit')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete} className="text-red-400 hover:bg-slate-700 cursor-pointer">
                <Trash2 className="h-4 w-4 mr-2" /> {tCommon('delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">{t('progress')}</span>
            <span className="text-white font-medium">{percentage.toFixed(1)}%</span>
          </div>
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div 
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${percentage}%`, backgroundColor: goal.color || '#10B981' }}
            />
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-emerald-400 font-medium">{formatCurrency(goal.current_amount)}</span>
            <span className="text-slate-500">{t('of')} {formatCurrency(goal.target_amount)}</span>
          </div>
        </div>

        {goal.deadline && (
          <div className="flex items-center gap-2 text-sm text-slate-400 bg-slate-800/50 p-2 rounded">
            <CalendarIcon className="h-4 w-4 text-slate-500" />
            <span>{t('target')} {format(new Date(goal.deadline), 'MMM d, yyyy')}</span>
          </div>
        )}

        {monthlySuggestion > 0 && (
          <div className="flex items-start gap-2 text-sm text-slate-400 bg-slate-800/50 p-2 rounded">
            <TrendingUp className="h-4 w-4 text-emerald-500 mt-0.5" />
            <span>
              {t('save')} <span className="text-white font-medium">{formatCurrency(monthlySuggestion)}</span>{t('toReachTarget')}
            </span>
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button onClick={onAddSavings} className="w-full bg-slate-800 hover:bg-slate-700 text-white border border-slate-700">
          <PiggyBank className="h-4 w-4 mr-2 text-emerald-400" />
          {t('addSavings')}
        </Button>
      </CardFooter>
    </Card>
  );
}

function GoalDialog({ 
  open, 
  onOpenChange, 
  onSuccess, 
  goal 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  onSuccess: (goal: Goal) => void; 
  goal?: Goal;
}) {
  const t = useTranslations('Goals');
  const tCommon = useTranslations('Common');

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: goal?.name || '',
      description: goal?.description || '',
      target_amount: goal?.target_amount || 0,
      current_amount: goal?.current_amount || 0,
      deadline: goal?.deadline ? new Date(goal.deadline) : undefined,
      color: goal?.color || '#10B981',
    },
  });

  // Reset form when goal changes or dialog opens
  useEffect(() => {
    if (open) {
      form.reset({
        name: goal?.name || '',
        description: goal?.description || '',
        target_amount: goal?.target_amount || 0,
        current_amount: goal?.current_amount || 0,
        deadline: goal?.deadline ? new Date(goal.deadline) : undefined,
        color: goal?.color || '#10B981',
      });
    }
  }, [open, goal, form]);

  const onSubmit = async (values: FormValues) => {
    try {
      const data = {
        ...values,
        target_amount: values.target_amount,
        current_amount: values.current_amount,
        deadline: values.deadline ? format(values.deadline, 'yyyy-MM-dd') : undefined,
      };

      let result;
      if (goal) {
        result = await goalsApi.update(goal.id, data);
        toast.success(t('successUpdate'));
      } else {
        result = await goalsApi.create(data);
        toast.success(t('successCreate'));
      }
      onSuccess(result.data);
    } catch (error) {
      toast.error(goal ? t('failedSave') : t('failedSave'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-slate-900 border-slate-800 text-white">
        <DialogHeader>
          <DialogTitle>{goal ? t('editGoal') : t('createGoal')}</DialogTitle>
          <DialogDescription className="text-slate-400">
            {goal ? t('editDesc') : t('createDesc')}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('name')}</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., New Car" {...field} className="bg-slate-800 border-slate-700" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="target_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('targetAmount')}</FormLabel>
                    <FormControl>
                      <Controller
                        control={form.control}
                        name="target_amount"
                        render={({ field }) => (
                          <AmountInput 
                            placeholder="50000000" 
                            className="bg-slate-800 border-slate-700" 
                            value={field.value}
                            onValueChange={field.onChange}
                          />
                        )}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="current_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('currentAmount')}</FormLabel>
                    <FormControl>
                      <Controller
                          control={form.control}
                          name="current_amount"
                          render={({ field }) => (
                            <AmountInput 
                              placeholder="0" 
                              className="bg-slate-800 border-slate-700" 
                              value={field.value}
                              onValueChange={field.onChange}
                            />
                          )}
                        />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="deadline"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>{t('targetDate')}</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full pl-3 text-left font-normal bg-slate-800 border-slate-700 hover:bg-slate-700 hover:text-white",
                            !field.value && "text-slate-500"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP")
                          ) : (
                            <span>{tCommon('date')}</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-slate-900 border-slate-800" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) =>
                          date < new Date("1900-01-01")
                        }
                        initialFocus
                        className="bg-slate-900 text-white"
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('description')}</FormLabel>
                  <FormControl>
                    <Input placeholder="Details about this goal..." {...field} className="bg-slate-800 border-slate-700" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit" className="bg-emerald-500 hover:bg-emerald-600 w-full sm:w-auto">
                {goal ? t('editGoal') : t('createGoal')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function AddSavingsDialog({ 
  open, 
  onOpenChange, 
  onSuccess, 
  goal 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  onSuccess: (goal: Goal) => void; 
  goal: Goal;
}) {
  const [amount, setAmount] = useState<number>(0);
  const t = useTranslations('Goals');
  const locale = useLocale();
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const addAmount = amount;
    if (!addAmount || addAmount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    try {
      const newAmount = Number(goal.current_amount) + addAmount;
      const result = await goalsApi.update(goal.id, { current_amount: newAmount });
      toast.success(t('successAddSavings', { amount: new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-US', { style: 'currency', currency: locale === 'vi' ? 'VND' : 'USD' }).format(addAmount), name: goal.name }));
      onSuccess(result.data);
    } catch (error) {
      toast.error(t('failedAddSavings'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-slate-900 border-slate-800 text-white">
        <DialogHeader>
          <DialogTitle>{t('addSavingsTo', { name: goal.name })}</DialogTitle>
          <DialogDescription className="text-slate-400">
            {t('howMuch')}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">{t('amountToAdd')}</label>
            <AmountInput 
              type="number" 
              placeholder={t('amountToAdd')} 
              value={typeof amount === 'number' ? amount : 0}
              onValueChange={setAmount}
              className="bg-slate-800 border-slate-700"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button type="submit" className="bg-emerald-500 hover:bg-emerald-600 w-full">
              {t('confirmAdd')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
