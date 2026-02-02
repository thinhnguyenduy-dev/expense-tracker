'use client';

import { Loader2, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Category } from './ExpenseDialog';

interface ExpenseBulkActionsProps {
  selectedCount: number;
  onClear: () => void;
  onBulkDelete: () => void;
  onBulkCategoryChange: (categoryId: string) => void;
  categories: Category[];
  isBulkDeleting: boolean;
  isBulkUpdating: boolean;
  bulkCategoryDialogOpen: boolean;
  onBulkCategoryDialogOpenChange: (open: boolean) => void;
  translations: {
    itemsSelected: string;
    changeCategory: string;
    changeCategoryDesc: string;
    selectCategory: string;
    deleteSelected: string;
  };
  commonTranslations: {
    clear: string;
  };
}

export function ExpenseBulkActions({
  selectedCount,
  onClear,
  onBulkDelete,
  onBulkCategoryChange,
  categories,
  isBulkDeleting,
  isBulkUpdating,
  bulkCategoryDialogOpen,
  onBulkCategoryDialogOpenChange,
  translations: t,
  commonTranslations: tCommon,
}: ExpenseBulkActionsProps) {
  if (selectedCount === 0) return null;

  return (
    <Card className="bg-emerald-500/10 dark:bg-emerald-900/30 border-emerald-500/50">
      <CardContent className="py-3 flex items-center justify-between">
        <span className="text-emerald-600 dark:text-emerald-300 font-medium">
          {t.itemsSelected.replace('{count}', selectedCount.toString())}
        </span>
        <div className="flex gap-2">
          <Dialog open={bulkCategoryDialogOpen} onOpenChange={onBulkCategoryDialogOpenChange}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="border-emerald-500 text-emerald-600 dark:text-emerald-300 hover:bg-emerald-500/10">
                {t.changeCategory}
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle className="text-foreground">{t.changeCategory}</DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  {t.changeCategoryDesc.replace('{count}', selectedCount.toString())}
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Select onValueChange={onBulkCategoryChange} disabled={isBulkUpdating}>
                  <SelectTrigger className="bg-muted border-border text-foreground">
                    <SelectValue placeholder={t.selectCategory} />
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
              </div>
            </DialogContent>
          </Dialog>
          <Button
            variant="destructive"
            size="sm"
            onClick={onBulkDelete}
            disabled={isBulkDeleting}
          >
            {isBulkDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />}
            {t.deleteSelected}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="text-muted-foreground"
          >
            <X className="h-4 w-4 mr-1" />
            {tCommon.clear}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
