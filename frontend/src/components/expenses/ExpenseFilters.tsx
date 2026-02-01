'use client';

import { Search, Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Category } from './ExpenseDialog';

export type DatePreset = 'all' | 'today' | 'this_week' | 'this_month' | 'last_month' | 'last_3_months' | 'this_year';

interface ExpenseFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  datePreset: DatePreset;
  onDatePresetChange: (preset: DatePreset) => void;
  filterCategory: string;
  onFilterCategoryChange: (categoryId: string) => void;
  categories: Category[];
  visibleTotal: number;
  totalItems: number;
  formatCurrency: (value: number) => string;
  hasFamily: boolean;
  scope: 'personal' | 'family';
  onScopeChange: (scope: 'personal' | 'family') => void;
  translations: {
    searchPlaceholder: string;
    allCategories: string;
    datePresets: Record<DatePreset, string>;
  };
  commonTranslations: {
    total: string;
  };
}

export function ExpenseFilters({
  searchQuery,
  onSearchChange,
  datePreset,
  onDatePresetChange,
  filterCategory,
  onFilterCategoryChange,
  categories,
  visibleTotal,
  totalItems,
  formatCurrency,
  hasFamily,
  scope,
  onScopeChange,
  translations: t,
  commonTranslations: tCommon,
}: ExpenseFiltersProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* Family Toggle */}
      {hasFamily && (
        <div className="flex items-center space-x-2 bg-slate-800 p-2 rounded-lg border border-slate-700 w-fit">
          <Switch
            id="family-mode-expenses"
            checked={scope === 'family'}
            onCheckedChange={(checked) => onScopeChange(checked ? 'family' : 'personal')}
          />
          <Label htmlFor="family-mode-expenses" className="text-white cursor-pointer select-none">
            Family View
          </Label>
        </div>
      )}

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder={t.searchPlaceholder}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 bg-slate-800 border-slate-700 text-white"
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-slate-400"
            onClick={() => onSearchChange('')}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Date Presets */}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(t.datePresets) as DatePreset[]).map((preset) => (
          <Button
            key={preset}
            variant={datePreset === preset ? 'default' : 'outline'}
            size="sm"
            onClick={() => onDatePresetChange(preset)}
            className={cn(
              datePreset === preset
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
            )}
          >
            {t.datePresets[preset]}
          </Button>
        ))}
      </div>

      {/* Summary and Category Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Card className="flex-1 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border-emerald-500/30">
          <CardContent className="pt-6">
            <p className="text-sm text-slate-400">
              {datePreset === 'all' ? tCommon.total : t.datePresets[datePreset]} ({totalItems} items)
            </p>
            <p className="text-2xl font-bold text-white">{formatCurrency(visibleTotal)}</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="pt-6 flex items-center gap-3">
            <Filter className="h-5 w-5 text-slate-400" />
            <Select value={filterCategory} onValueChange={onFilterCategoryChange}>
              <SelectTrigger className="w-48 bg-slate-800 border-slate-700 text-white">
                <SelectValue placeholder={t.allCategories} />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="all" className="text-white hover:bg-slate-700">
                  {t.allCategories}
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
  );
}
