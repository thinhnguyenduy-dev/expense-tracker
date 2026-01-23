'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

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
import { categoriesApi } from '@/lib/api';

interface Category {
  id: number;
  name: string;
  icon: string;
  color: string;
  created_at: string;
}

const categorySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  icon: z.string().min(1, 'Icon is required'),
  color: z.string().min(1, 'Color is required'),
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
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      const response = await categoriesApi.getAll();
      setCategories(response.data);
    } catch {
      toast.error('Failed to load categories');
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
    setIsDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingCategory(null);
    reset({ name: '', icon: '📦', color: '#85929E' });
    setIsDialogOpen(true);
  };

  const onSubmit = async (data: CategoryFormData) => {
    setIsSubmitting(true);
    try {
      if (editingCategory) {
        await categoriesApi.update(editingCategory.id, data);
        toast.success('Category updated successfully');
      } else {
        await categoriesApi.create(data);
        toast.success('Category created successfully');
      }
      setIsDialogOpen(false);
      fetchCategories();
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { detail?: string } } };
      toast.error(axiosError.response?.data?.detail || 'Failed to save category');
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteCategory = async (id: number) => {
    if (!confirm('Are you sure you want to delete this category?')) return;
    
    try {
      await categoriesApi.delete(id);
      toast.success('Category deleted successfully');
      fetchCategories();
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { detail?: string } } };
      toast.error(axiosError.response?.data?.detail || 'Failed to delete category');
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
          <h1 className="text-3xl font-bold text-white">Categories</h1>
          <p className="text-slate-400 mt-1">Organize your expenses with custom categories</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={openCreateDialog}
              className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Category
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-slate-900 border-slate-700">
            <DialogHeader>
              <DialogTitle className="text-white">
                {editingCategory ? 'Edit Category' : 'Create Category'}
              </DialogTitle>
              <DialogDescription className="text-slate-400">
                {editingCategory ? 'Update your category details' : 'Add a new category to organize your expenses'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label className="text-slate-200">Name</Label>
                  <Input
                    placeholder="Category name"
                    className="bg-slate-800 border-slate-700 text-white"
                    {...register('name')}
                  />
                  {errors.name && (
                    <p className="text-sm text-red-400">{errors.name.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-200">Icon</Label>
                  <div className="flex flex-wrap gap-2">
                    {defaultIcons.map((icon) => (
                      <button
                        key={icon}
                        type="button"
                        onClick={() => setValue('icon', icon)}
                        className={`w-10 h-10 text-xl rounded-lg transition-all ${
                          selectedIcon === icon
                            ? 'bg-emerald-500/30 ring-2 ring-emerald-500'
                            : 'bg-slate-800 hover:bg-slate-700'
                        }`}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                  <input type="hidden" {...register('icon')} />
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-200">Color</Label>
                  <div className="flex flex-wrap gap-2">
                    {defaultColors.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setValue('color', color)}
                        className={`w-8 h-8 rounded-full transition-all ${
                          selectedColor === color
                            ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900'
                            : ''
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <input type="hidden" {...register('color')} />
                </div>

                {/* Preview */}
                <div className="pt-4 border-t border-slate-700">
                  <Label className="text-slate-200 mb-2 block">Preview</Label>
                  <div
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg"
                    style={{ backgroundColor: `${selectedColor}20` }}
                  >
                    <span className="text-xl">{selectedIcon}</span>
                    <span className="font-medium" style={{ color: selectedColor }}>
                      {watch('name') || 'Category Name'}
                    </span>
                  </div>
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
                  ) : editingCategory ? (
                    'Update'
                  ) : (
                    'Create'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Categories Grid */}
      {categories.length === 0 ? (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="h-16 w-16 rounded-full bg-slate-700 flex items-center justify-center mb-4">
              <Plus className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">No categories yet</h3>
            <p className="text-slate-400 text-center mb-4">
              Create your first category to start organizing expenses
            </p>
            <Button
              onClick={openCreateDialog}
              className="bg-gradient-to-r from-emerald-500 to-teal-500"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Category
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {categories.map((category) => (
            <Card
              key={category.id}
              className="bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700 hover:border-slate-600 transition-colors"
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
                      className="h-8 w-8 text-slate-400 hover:text-white"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteCategory(category.id)}
                      className="h-8 w-8 text-slate-400 hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <CardTitle className="text-white mb-1">{category.name}</CardTitle>
                <CardDescription className="text-slate-400">
                  <div
                    className="inline-block w-3 h-3 rounded-full mr-2"
                    style={{ backgroundColor: category.color }}
                  />
                  {category.color}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
