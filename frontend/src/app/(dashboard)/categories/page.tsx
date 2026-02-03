'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
} from "@/components/ui/select";
import { categoriesApi, jarsApi } from '@/lib/api';
import { formatCurrency } from "@/lib/utils";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useLocale } from 'next-intl';

interface Category {
  id: number;
  name: string;
  icon: string;
  color: string;
  jar_id?: number | null;
  created_at: string;
  monthly_limit?: number | null;
}

interface Jar {
  id: number;
  name: string;
}

const categorySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  icon: z.string().min(1, 'Icon is required'),
  color: z.string().min(1, 'Color is required'),
  jar_id: z.number().optional().nullable(),
  monthly_limit: z.number().optional().nullable(),
});

type CategoryFormData = z.infer<typeof categorySchema>;

const defaultIcons = ['🍔', '🚗', '🛍️', '🎬', '💡', '🏥', '📚', '✈️', '💄', '📦', '🏠', '💰', '🎮', '🏃', '☕'];
const defaultColors = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85929E',
  '#E74C3C', '#3498DB', '#2ECC71', '#F39C12', '#9B59B6',
];

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [jars, setJars] = useState<Jar[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);
  const t = useTranslations('Categories');
  const tCommon = useTranslations('Common');
  const locale = useLocale();
  const { user } = useAuthStore();
  const currency = user?.currency || 'VND';

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      icon: '📦',
      color: '#85929E',
    },
  });

  const selectedIcon = watch('icon');
  const selectedColor = watch('color');

  const fetchCategories = async () => {
    try {
      const [categoriesRes, jarsRes] = await Promise.all([
        categoriesApi.getAll(),
        jarsApi.getAll(),
      ]);
      setCategories(categoriesRes.data);
      setJars(jarsRes.data);
    } catch {
      toast.error(t('failedToLoad'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const openEditDialog = (category: Category) => {
    setEditingCategory(category);
    setValue('name', category.name);
    setValue('icon', category.icon);
    setValue('color', category.color);
    setValue('jar_id', category.jar_id);
    setValue('monthly_limit', category.monthly_limit);
    setIsDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingCategory(null);
    reset({ name: '', icon: '📦', color: '#85929E', jar_id: null, monthly_limit: null });
    setIsDialogOpen(true);
  };

  const onSubmit = useCallback(async (data: CategoryFormData) => {
    if (isSubmittingRef.current || isSubmitting) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    try {
      const apiData = {
        ...data,
        jar_id: data.jar_id === null ? undefined : data.jar_id,
        monthly_limit: data.monthly_limit === null ? undefined : data.monthly_limit
      };
      
      if (editingCategory) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await categoriesApi.update(editingCategory.id, apiData as any);
        toast.success(t('successUpdate'));
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await categoriesApi.create(apiData as any);
        toast.success(t('successCreate'));
      }
      setIsDialogOpen(false);
      setTimeout(() => fetchCategories(), 100);
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { detail?: string } } };
      toast.error(axiosError.response?.data?.detail || t('failedSave'));
    } finally {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  }, [editingCategory, t]);

  const handleDialogOpenChange = useCallback((open: boolean) => {
    if (isSubmitting) return;
    setIsDialogOpen(open);
  }, [isSubmitting]);

  const deleteCategory = async (id: number) => {
    if (!confirm(t('confirmDelete'))) return;
    
    try {
      await categoriesApi.delete(id);
      toast.success(t('successDelete'));
      fetchCategories();
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { detail?: string } } };
      toast.error(axiosError.response?.data?.detail || t('failedDelete'));
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t('title')}</h1>
          <p className="text-muted-foreground mt-1">{t('subtitle')}</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
          <DialogTrigger asChild>
            <Button
              onClick={openCreateDialog}
              className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600"
            >
              <Plus className="h-4 w-4 mr-2" />
              {t('addCategory')}
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-foreground">
                {editingCategory ? t('editCategory') : t('createCategory')}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                {editingCategory ? t('editDesc') : t('createDesc')}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)}>
              <fieldset disabled={isSubmitting} className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label className="text-foreground">{t('name')}</Label>
                  <Input
                    placeholder={t('categoryName')}
                    className="bg-muted border-border text-foreground"
                    {...register('name')}
                  />
                  {errors.name && (
                    <p className="text-sm text-red-400">{errors.name.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-foreground">{t('icon')}</Label>
                  <div className="flex flex-wrap gap-2">
                    {defaultIcons.map((icon) => (
                      <button
                        key={icon}
                        type="button"
                        onClick={() => setValue('icon', icon)}
                        className={`w-10 h-10 text-xl rounded-lg transition-all ${
                          selectedIcon === icon
                            ? 'bg-emerald-500/30 ring-2 ring-emerald-500'
                            : 'bg-muted hover:bg-muted/80'
                        }`}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                  <input type="hidden" {...register('icon')} />
                </div>

                <div className="space-y-2">
                  <Label className="text-foreground">{t('color')}</Label>
                  <div className="flex flex-wrap gap-2">
                    {defaultColors.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setValue('color', color)}
                        className={`w-8 h-8 rounded-full transition-all ${
                          selectedColor === color
                            ? 'ring-2 ring-foreground ring-offset-2 ring-offset-background'
                            : ''
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <input type="hidden" {...register('color')} />
                </div>

                <div className="space-y-2">
                  <Label className="text-foreground">{t('linkToJar')}</Label>
                  <Select
                    value={watch('jar_id')?.toString() || "none"}
                    onValueChange={(value) => setValue('jar_id', value === "none" ? null : parseInt(value))}
                  >
                    <SelectTrigger className="bg-muted border-border text-foreground">
                      <SelectValue placeholder={t('selectJar')} />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="none" className="text-muted-foreground">
                        {t('noJar')}
                      </SelectItem>
                      {jars.map((jar) => (
                        <SelectItem key={jar.id} value={jar.id.toString()} className="text-foreground">
                          {jar.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {t('linkJarDesc')}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-foreground">{t('monthlyLimit')} (Optional)</Label>
                  <Input
                    type="number"
                    placeholder="e.g. 500"
                    className="bg-muted border-border text-foreground"
                    {...register('monthly_limit', { valueAsNumber: true })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Set a budget limit for this category to get alerts.
                  </p>
                </div>

                {/* Preview */}
                <div className="pt-4 border-t border-border">
                  <Label className="text-foreground mb-2 block">{t('preview')}</Label>
                  <div
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg"
                    style={{ backgroundColor: `${selectedColor}20` }}
                  >
                    <span className="text-xl">{selectedIcon}</span>
                    <span className="font-medium" style={{ color: selectedColor }}>
                      {watch('name') || t('categoryName')}
                    </span>
                  </div>
                </div>
              </fieldset>
              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsDialogOpen(false)}
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
                  ) : editingCategory ? (
                    tCommon('update')
                  ) : (
                    tCommon('create')
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Categories Grid */}
      {categories.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Plus className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">{t('noCategories')}</h3>
            <p className="text-muted-foreground text-center mb-4">
              {t('startOrganizing')}
            </p>
            <Button
              onClick={openCreateDialog}
              className="bg-gradient-to-r from-emerald-500 to-teal-500"
            >
              <Plus className="h-4 w-4 mr-2" />
              {t('createCategory')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {categories.map((category) => (
            <Card
              key={category.id}
              className="bg-gradient-to-br from-card to-muted/50 border-border hover:border-muted-foreground/30 transition-colors"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div
                    className="h-12 w-12 rounded-lg flex items-center justify-center text-2xl"
                    style={{ backgroundColor: `${category.color}20` }}
                  >
                    {category.icon}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(category)}
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteCategory(category.id)}
                      className="h-8 w-8 text-muted-foreground hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <CardTitle className="text-foreground mb-1">{category.name}</CardTitle>
                <CardDescription className="text-muted-foreground">
                  <div
                    className="inline-block w-3 h-3 rounded-full mr-2"
                    style={{ backgroundColor: category.color }}
                  />
                  {category.color}
                  {category.jar_id && (
                    <span className="ml-2 inline-flex items-center rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-500">
                      {jars.find(j => j.id === category.jar_id)?.name}
                    </span>
                  )}
                  {category.monthly_limit && category.monthly_limit > 0 && (
                    <div className="mt-4 space-y-2">
                       <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Budget</span>
                          <span className="text-foreground font-medium">
                            {formatCurrency(Number(category.monthly_limit || 0), currency, locale)}
                          </span>
                       </div>
                       {/* Note: In a real implementation we would need to pass 'spent' amount from backend. 
                           For now, this is a placeholder or we need to fetch stats.
                           Let's check if we can easily get stats.
                           Actually, Dashboard API returns stats. Categories API usually just returns definitions.
                           We might need to fetch stats here or update Categories API to include current month spend.
                           
                           Decision: Let's assume for this step we just show the limit. 
                           To show progress, we would need to fetch expenses or update the API.
                           Let's update the Categories API response in backend to include 'current_month_expenses' later.
                           For now, let's visualy indicate the limit is set.
                       */}
                        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden border border-border">
                           <div className="h-full bg-slate-600 w-0" />
                        </div>
                    </div>
                  )}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
