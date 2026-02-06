import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { AlertTriangle, Pencil, TrendingUp, Filter, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EditBudgetModal } from "./EditBudgetModal";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CategoryBudgetStatus } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";

interface CategoryBudgetListProps {
  categories: CategoryBudgetStatus[];
  currency: string;
  locale: string;
  onUpdate?: () => void;
}

export function CategoryBudgetList({ categories, currency, locale, onUpdate }: CategoryBudgetListProps) {
  const [editingCategory, setEditingCategory] = useState<CategoryBudgetStatus | null>(null);
  const [sortBy, setSortBy] = useState<'percent' | 'amount'>('percent');

  const sortedCategories = useMemo(() => {
    return [...categories].sort((a, b) => {
      if (sortBy === 'percent') {
        const percentA = a.limit ? (a.spent / a.limit) : 0;
        const percentB = b.limit ? (b.spent / b.limit) : 0;
        return percentB - percentA;
      } else {
        return b.spent - a.spent;
      }
    });
  }, [categories, sortBy]);

  // Helper for forecasting
  const getForecasting = (spent: number, limit: number | null) => {
    if (!limit || limit === 0) return null;
    const today = new Date();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const currentDay = Math.max(today.getDate(), 1);
    const dailyRunRate = spent / currentDay;
    const projected = dailyRunRate * daysInMonth;
    const isTrendingOver = projected > limit;
    return { projected, isTrendingOver };
  };

  return (
    <>
      <Card className="bg-card border-border col-span-2 overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between pb-4 border-b">
          <div className="space-y-1">
            <CardTitle className="text-xl font-semibold text-foreground">Category Budgets</CardTitle>
            <CardDescription>Monitor your spending limits by category</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSortBy(prev => prev === 'percent' ? 'amount' : 'percent')}
              className="gap-2 text-xs"
            >
              <ArrowUpDown className="h-3 w-3" />
              Sort by {sortBy === 'percent' ? '% Used' : 'Amount'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            <AnimatePresence mode="popLayout">
              {sortedCategories.map((cat) => {
                const percent = Math.min(cat.percentage, 100);
                const forecast = getForecasting(cat.spent, cat.limit);
                const showTrendWarning = forecast?.isTrendingOver && !cat.is_over_limit;
                
                let progressBarColor = "bg-emerald-500";
                if (cat.is_over_limit) progressBarColor = "bg-red-500";
                else if (cat.is_warning) progressBarColor = "bg-yellow-500";
                else if (showTrendWarning) progressBarColor = "bg-orange-400";

                return (
                  <motion.div
                    key={cat.category_id}
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="p-4 hover:bg-muted/30 transition-colors group relative"
                  >
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center bg-primary/10 text-primary font-bold text-lg`}>
                            {cat.category_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-foreground">{cat.category_name}</span>
                              {cat.is_over_limit && (
                                <Badge variant="destructive" className="py-0 px-1.5 h-5 text-[10px] uppercase">Over</Badge>
                              )}
                              {showTrendWarning && (
                                <Badge variant="secondary" className="bg-orange-100 text-orange-700 hover:bg-orange-100 py-0 px-1.5 h-5 text-[10px] uppercase">Risk</Badge>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground flex gap-1">
                               <span>{formatCurrency(cat.spent, currency, locale)}</span>
                               <span className="opacity-50">of</span>
                               <span>{cat.limit ? formatCurrency(cat.limit, currency, locale) : "∞"}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-right hidden sm:block">
                            <div className={`text-sm font-bold ${cat.is_over_limit ? 'text-red-500' : 'text-foreground'}`}>
                              {cat.percentage.toFixed(0)}%
                            </div>
                            {showTrendWarning && (
                              <div className="text-[10px] text-orange-500">
                                Projected: {formatCurrency(forecast?.projected || 0, currency, locale)}
                              </div>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => setEditingCategory(cat)}
                          >
                            <Pencil className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </div>
                      </div>

                      <div className="w-full bg-secondary/30 h-1.5 rounded-full overflow-hidden">
                        <motion.div
                          className={`h-full rounded-full ${progressBarColor}`}
                          initial={{ width: 0 }}
                          animate={{ width: `${percent}%` }}
                          transition={{ duration: 0.8, ease: "easeOut" }}
                        />
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            
            {categories.length === 0 && (
              <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
                <div className="p-4 rounded-full bg-muted">
                  <Filter className="h-8 w-8 text-muted-foreground" />
                </div>
                <div>
                   <p className="text-lg font-medium">No budgets found</p>
                   <p className="text-muted-foreground">Start by creating some expense categories.</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {editingCategory && (
        <EditBudgetModal
          isOpen={!!editingCategory}
          onClose={() => setEditingCategory(null)}
          onSuccess={() => {
            if (onUpdate) onUpdate();
          }}
          category={{
            id: editingCategory.category_id,
            name: editingCategory.category_name,
            monthly_limit: editingCategory.limit
          }}
        />
      )}
    </>
  );
}
