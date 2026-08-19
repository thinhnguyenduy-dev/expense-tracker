'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { UseFormReturn, Controller } from 'react-hook-form';
import { format } from 'date-fns';
import { vi, enUS } from 'date-fns/locale';
import { Loader2, CalendarIcon, CameraIcon, Plus, X } from 'lucide-react';
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
import { Expense, resolveUploadUrl } from '@/lib/api';

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

export interface ExpenseImagePayload {
  existingUrls: string[];
  files: File[];
}

interface ExpenseDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  form: UseFormReturn<ExpenseFormData>;
  categories: Category[];
  editingExpense: Expense | null;
  isSubmitting: boolean;
  onSubmit: (data: ExpenseFormData, images: ExpenseImagePayload) => void;
}

type ImageItem =
  | { id: string; kind: 'existing'; url: string }
  | { id: string; kind: 'new'; file: File; preview: string };

const MAX_IMAGES = 5;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scannedRef = useRef(false);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);

  const { control, register, watch, setValue, handleSubmit, formState: { errors } } = form;
  const selectedDate = watch('date');

  useEffect(() => {
    if (!isOpen) {
      setImages((prev) => {
        prev.forEach((item) => {
          if (item.kind === 'new') URL.revokeObjectURL(item.preview);
        });
        return [];
      });
      scannedRef.current = false;
      setPreviewSrc(null);
      return;
    }

    scannedRef.current = false;
    setImages(
      (editingExpense?.images ?? []).map((url) => ({
        id: url,
        kind: 'existing' as const,
        url,
      }))
    );
  }, [isOpen, editingExpense]);

  const handleReceiptScan = async (file: File) => {
    const toastId = toast.loading(t('scanning'));
    try {
      const { ocrApi } = await import('@/lib/api');
      const { data } = await ocrApi.scanReceipt(file);

      if (data.amount) setValue('amount', data.amount);
      if (data.date) setValue('date', new Date(data.date));
      if (data.merchant) setValue('description', data.merchant);
      else if (!watch('description')) {
        setValue(
          'description',
          'Receipt scan ' + new Date().toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-US')
        );
      }

      toast.success(t('scanSuccess'), { id: toastId });
    } catch (error) {
      console.error(error);
      toast.error(t('scanFailed'), { id: toastId });
    }
  };

  const addFiles = (fileList: FileList | File[]) => {
    const incoming = Array.from(fileList);
    if (incoming.length === 0) return;

    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) {
      toast.error(t('maxImages'));
      return;
    }

    const next: ImageItem[] = [];
    for (const file of incoming.slice(0, remaining)) {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        toast.error(t('invalidImage'));
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error(t('imageTooLarge'));
        continue;
      }
      next.push({
        id: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
        kind: 'new',
        file,
        preview: URL.createObjectURL(file),
      });
    }

    if (next.length === 0) return;

    const firstNew = next[0];
    const currentAmount = watch('amount');
    setImages((prev) => [...prev, ...next]);

    if (
      !editingExpense &&
      !scannedRef.current &&
      firstNew.kind === 'new' &&
      (!currentAmount || currentAmount === 0)
    ) {
      scannedRef.current = true;
      handleReceiptScan(firstNew.file);
    }
  };

  const removeImage = (id: string) => {
    setImages((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target?.kind === 'new') URL.revokeObjectURL(target.preview);
      return prev.filter((item) => item.id !== id);
    });
  };

  const imageSrc = (item: ImageItem) =>
    item.kind === 'existing' ? resolveUploadUrl(item.url) : item.preview;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {editingExpense ? t('editExpense') : t('addExpense')}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {editingExpense ? t('editExpenseDesc') : t('addExpenseDesc')}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={handleSubmit((data) =>
            onSubmit(data, {
              existingUrls: images
                .filter((item): item is Extract<ImageItem, { kind: 'existing' }> => item.kind === 'existing')
                .map((item) => item.url),
              files: images
                .filter((item): item is Extract<ImageItem, { kind: 'new' }> => item.kind === 'new')
                .map((item) => item.file),
            })
          )}
        >
          <fieldset disabled={isSubmitting} className="contents">
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-foreground">{t('attachments')}</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) addFiles(e.target.files);
                  e.target.value = '';
                }}
              />

              {images.length === 0 ? (
                <button
                  type="button"
                  className={cn(
                    'w-full min-h-[100px] rounded-xl border-2 border-dashed bg-muted/50 transition-all duration-300 cursor-pointer',
                    isDragging
                      ? 'border-emerald-500 bg-emerald-500/10'
                      : 'border-border hover:bg-muted hover:border-emerald-500/70 hover:shadow-lg hover:shadow-emerald-500/10'
                  )}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
                  }}
                >
                  <div className="flex flex-col items-center justify-center gap-3 py-4">
                    <div className="p-3 rounded-full bg-muted">
                      <CameraIcon className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <div className="text-center px-4">
                      <p className="text-sm font-medium text-foreground">
                        {editingExpense ? t('attachments') : t('receiptScan')}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {t('attachmentsDesc')}
                      </p>
                    </div>
                  </div>
                </button>
              ) : (
                <div
                  className={cn(
                    'rounded-xl border-2 border-dashed p-3 transition-colors',
                    isDragging ? 'border-emerald-500 bg-emerald-500/10' : 'border-border bg-muted/30'
                  )}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
                  }}
                >
                  <div className="grid grid-cols-3 gap-2">
                    {images.map((item) => (
                      <div
                        key={item.id}
                        className="group relative aspect-square overflow-hidden rounded-lg bg-muted"
                      >
                        <button
                          type="button"
                          className="h-full w-full"
                          onClick={() => setPreviewSrc(imageSrc(item))}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={imageSrc(item)}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeImage(item.id)}
                          className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                          aria-label={t('removeImage')}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                    {images.length < MAX_IMAGES && (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border bg-muted/50 text-muted-foreground hover:border-emerald-500/70 hover:text-emerald-500"
                      >
                        <Plus className="h-5 w-5" />
                        <span className="text-[10px]">{t('addImage')}</span>
                      </button>
                    )}
                  </div>
                  <p className="mt-2 text-center text-[11px] text-muted-foreground">
                    {t('attachmentsHint', { count: images.length, max: MAX_IMAGES })}
                  </p>
                </div>
              )}
            </div>

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
      {previewSrc &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"
            onClick={() => setPreviewSrc(null)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Escape' && setPreviewSrc(null)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewSrc}
              alt=""
              className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>,
          document.body
        )}
    </Dialog>
  );
}
