import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatCurrency } from "@/lib/utils";
import { AlertTriangle, Pencil, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EditBudgetModal } from "./EditBudgetModal";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CategoryBudgetStatus } from "@/lib/api";

interface CategoryBudgetListProps {
  categories: CategoryBudgetStatus[];
  currency: string;
  locale: string;
  onUpdate?: () => void;
}

export function CategoryBudgetList({ categories, currency, locale, onUpdate }: CategoryBudgetListProps) {
  const [editingCategory, setEditingCategory] = useState<CategoryBudgetStatus | null>(null);

  // Helper for forecasting
  const getForecasting = (spent: number, limit: number | null) => {
    if (!limit || limit === 0) return null;
    
    const today = new Date();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const currentDay = today.getDate();
    
    // Calculate projected spend
    // Avoid division by zero if it's day 0 (unlikely but safe)
    const day = Math.max(currentDay, 1);
    const dailyRunRate = spent / day;
    const projected = dailyRunRate * daysInMonth;
    
    const isTrendingOver = projected > limit;
    
    return {
      projected,
      isTrendingOver
    };
  };

  return (
    <>
      <Card className="bg-card border-border col-span-2">
        <CardHeader>
          <CardTitle className="text-foreground">Category Budgets</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {categories.map((cat, index) => {
             const percent = Math.min(cat.percentage, 100);
             let progressColor = "bg-emerald-500";
             if (cat.is_over_limit) progressColor = "bg-red-500";
             else if (cat.is_warning) progressColor = "bg-yellow-500";
             
             const forecast = getForecasting(cat.spent, cat.limit);
             // Show warning if trending over, even if not currently over limit
             const showTrendWarning = forecast?.isTrendingOver && !cat.is_over_limit;

             return (
              <div key={index} className="space-y-2 group">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-foreground flex items-center gap-2">
                      {cat.category_name}
                      {cat.is_over_limit && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <AlertTriangle className="h-4 w-4 text-red-500" />
                            </TooltipTrigger>
                            <TooltipContent>Over Budget!</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      {showTrendWarning && (
                         <TooltipProvider>
                         <Tooltip>
                           <TooltipTrigger>
                             <TrendingUp className="h-4 w-4 text-orange-500" />
                           </TooltipTrigger>
                           <TooltipContent>Trending to overspend: Projected {formatCurrency(forecast?.projected || 0, currency, locale)}</TooltipContent>
                         </Tooltip>
                       </TooltipProvider>
                      )}
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="text-sm text-muted-foreground">
                      {formatCurrency(cat.spent, currency, locale)} / {cat.limit ? formatCurrency(cat.limit, currency, locale) : "∞"}
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon-sm" 
                      className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6"
                      onClick={() => setEditingCategory(cat)}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                
                <Progress 
                  value={percent} 
                  className="h-2" 
                  indicatorClassName={progressColor}
                />
                
                {/* Optional Forecast Text below progress */}
                {showTrendWarning && (
                   <p className="text-xs text-orange-500">
                     ⚠️ At current rate, you will spend {formatCurrency(forecast?.projected || 0, currency, locale)}
                   </p>
                )}
              </div>
             );
          })}
          {categories.length === 0 && (
              <p className="text-muted-foreground text-center">No categories found.</p>
          )}
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
