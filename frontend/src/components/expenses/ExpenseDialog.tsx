'use client';



import { UseFormReturn, Controller } from 'react-hook-form';
import { format } from 'date-fns';
import { vi, enUS } from 'date-fns/locale';
import { Loader2, CalendarIcon, CameraIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useLocale, useTranslations } from 'next-intl';

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


import { useAuthStore } from '@/lib/stores/auth-store';

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
  currency?: string;
}

interface ExpenseDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  form: UseFormReturn<ExpenseFormData>;
  categories: Category[];
  editingExpense: Expense | null;
  isSubmitting: boolean;
  onSubmit: (data: ExpenseFormData) => void;
}

export function ExpenseDialog({
  isOpen,
  onOpenChange,
  form,
  categories,
  editingExpense,
  isSubmitting,
  onSubmit,
}: ExpenseDialogProps) {
  const locale = useLocale();
  const t = useTranslations('Expenses');
  const tCommon = useTranslations('Common');
  

  const { control, register, watch, setValue, handleSubmit, formState: { errors } } = form;
  const selectedDate = watch('date');



  const handleReceiptScan = async (file: File) => {
    const toastId = toast.loading(t('scanning'));
    try {
      const { ocrApi } = await import('@/lib/api');
      const { data } = await ocrApi.scanReceipt(file);
      
      if (data.amount) setValue('amount', data.amount);
      if (data.date) setValue('date', new Date(data.date));
      if (data.merchant) setValue('description', data.merchant);
      else setValue('description', 'Receipt scan ' + new Date().toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-US'));
      
      toast.success(t('scanSuccess'), { id: toastId });
    } catch (error) {
      console.error(error);
      toast.error(t('scanFailed'), { id: toastId });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {editingExpense ? t('editExpense') : t('addExpense')}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {editingExpense ? t('editExpenseDesc') : t('addExpenseDesc')}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <fieldset disabled={isSubmitting} className="contents">
          <div className="space-y-4 py-4">
            {/* Scan Receipt Button (Only for new expenses) */}
            {!editingExpense && (
              <div className="relative group">
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
                <button
                  type="button"
                  className="w-full min-h-[100px] rounded-xl border-2 border-dashed border-border bg-muted/50 hover:bg-muted hover:border-emerald-500/70 transition-all duration-300 cursor-pointer group-hover:shadow-lg group-hover:shadow-emerald-500/10"
                  onClick={() => document.getElementById('receipt-upload')?.click()}
                >
                  <div className="flex flex-col items-center justify-center gap-3 py-4">
                    <div className="p-3 rounded-full bg-muted group-hover:bg-emerald-500/20 transition-colors duration-300">
                      <CameraIcon className="h-8 w-8 text-muted-foreground group-hover:text-emerald-500 transition-colors duration-300" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-foreground group-hover:text-emerald-500 transition-colors duration-300">
                        {t('receiptScan')}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {t('receiptScanDesc')}
                      </p>
                    </div>
                  </div>
                </button>
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-foreground">{tCommon('amount')}</Label>
                <Controller
                  control={control}
                  name="amount"
                  render={({ field }) => (
                    <AmountInput
                      placeholder="0"
                      className="bg-muted border-border text-foreground"
                      value={field.value}
                      onValueChange={field.onChange}
                    />
                  )}
                />
                {errors.amount && (
                  <p className="text-sm text-red-500">{errors.amount.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-foreground">{tCommon('description')}</Label>
              <Input
                placeholder={t('descriptionPlaceholder')}
                className="bg-muted border-border text-foreground"
                {...register('description')}
              />
              {errors.description && (
                <p className="text-sm text-red-500">{errors.description.message}</p>
              )}
            </div>


            <div className="space-y-2">
              <Label className="text-foreground">{tCommon('category')}</Label>
              <Select
                value={watch('category_id')}
                onValueChange={(value) => setValue('category_id', value)}
              >
                <SelectTrigger className="bg-muted border-border text-foreground">
                  <SelectValue placeholder={t('selectCategory')} />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {categories.map((category) => (
                    <SelectItem
                      key={category.id}
                      value={category.id.toString()}
                      className="text-foreground hover:bg-muted"
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
                <p className="text-sm text-red-500">{errors.category_id.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-foreground">{tCommon('date')}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal bg-muted border-border',
                      !selectedDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, 'PPP', { locale: locale === 'vi' ? vi : enUS }) : <span>{t('pickDate')}</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-card border-border">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => date && setValue('date', date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {errors.date && (
                <p className="text-sm text-red-500">{errors.date.message}</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="text-muted-foreground"
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
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  );
}
