'use client';

import { UseFormReturn, Controller } from 'react-hook-form';
import { format } from 'date-fns';
import { Loader2, CalendarIcon, CameraIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useLocale } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AmountInput } from '@/components/ui/amount-input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Expense } from '@/lib/api';

export interface Category {
  id: number;
  name: string;
  icon: string;
  color: string;
}

export interface ExpenseFormData {
  amount: number;
  description: string;
  date: Date;
  category_id: string;
}

interface ExpenseDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  form: UseFormReturn<ExpenseFormData>;
  categories: Category[];
  editingExpense: Expense | null;
  isSubmitting: boolean;
  onSubmit: (data: ExpenseFormData) => void;
  translations: {
    editExpense: string;
    addExpense: string;
    editExpenseDesc: string;
    addExpenseDesc: string;
    descriptionPlaceholder: string;
    selectCategory: string;
    pickDate: string;
  };
  commonTranslations: {
    amount: string;
    description: string;
    category: string;
    date: string;
    cancel: string;
    update: string;
    add: string;
  };
}

export function ExpenseDialog({
  isOpen,
  onOpenChange,
  form,
  categories,
  editingExpense,
  isSubmitting,
  onSubmit,
  translations: t,
  commonTranslations: tCommon,
}: ExpenseDialogProps) {
  const locale = useLocale();
  const { control, register, watch, setValue, handleSubmit, formState: { errors } } = form;
  const selectedDate = watch('date');

  const handleReceiptScan = async (file: File) => {
    const toastId = toast.loading('Scanning receipt...');
    try {
      const { ocrApi } = await import('@/lib/api');
      const { data } = await ocrApi.scanReceipt(file);
      
      if (data.amount) setValue('amount', data.amount);
      if (data.date) setValue('date', new Date(data.date));
      if (data.merchant) setValue('description', data.merchant);
      else setValue('description', 'Receipt scan ' + new Date().toLocaleDateString());
      
      toast.success('Receipt scanned!', { id: toastId });
    } catch (error) {
      console.error(error);
      toast.error('Failed to scan receipt. Ensure Tesseract is installed on server.', { id: toastId });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white">
            {editingExpense ? t.editExpense : t.addExpense}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            {editingExpense ? t.editExpenseDesc : t.addExpenseDesc}
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
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleReceiptScan(file);
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
              <Label className="text-slate-200">{tCommon.amount} ({locale === 'vi' ? 'VND' : 'USD'})</Label>
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
              <Label className="text-slate-200">{tCommon.description}</Label>
              <Input
                placeholder={t.descriptionPlaceholder}
                className="bg-slate-800 border-slate-700 text-white"
                {...register('description')}
              />
              {errors.description && (
                <p className="text-sm text-red-400">{errors.description.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-slate-200">{tCommon.category}</Label>
              <Select
                value={watch('category_id')}
                onValueChange={(value) => setValue('category_id', value)}
              >
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue placeholder={t.selectCategory} />
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
              <Label className="text-slate-200">{tCommon.date}</Label>
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
                    {selectedDate ? format(selectedDate, 'PPP') : <span>{t.pickDate}</span>}
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
              onClick={() => onOpenChange(false)}
              className="text-slate-400"
            >
              {tCommon.cancel}
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-gradient-to-r from-emerald-500 to-teal-500"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : editingExpense ? (
                tCommon.update
              ) : (
                tCommon.add
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
