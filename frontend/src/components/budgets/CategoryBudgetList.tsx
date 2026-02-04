import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatCurrency } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";

interface CategoryBudgetStatus {
  category_name: string;
  limit: number | null;
  spent: number;
  percentage: number;
  is_over_limit: boolean;
  is_warning: boolean;
}

interface CategoryBudgetListProps {
  categories: CategoryBudgetStatus[];
  currency: string;
  locale: string;
}

export function CategoryBudgetList({ categories, currency, locale }: CategoryBudgetListProps) {
  return (
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

           return (
            <div key={index} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="font-medium text-foreground flex items-center gap-2">
                    {cat.category_name}
                    {cat.is_over_limit && <AlertTriangle className="h-3 w-3 text-red-500" />}
                </div>
                <div className="text-sm text-muted-foreground">
                  {formatCurrency(cat.spent, currency, locale)} / {cat.limit ? formatCurrency(cat.limit, currency, locale) : "∞"}
                </div>
              </div>
              <Progress 
                value={percent} 
                className="h-2" 
                indicatorClassName={progressColor}
              />
            </div>
           );
        })}
        {categories.length === 0 && (
            <p className="text-muted-foreground text-center">No categories with budget limits found.</p>
        )}
      </CardContent>
    </Card>
  );
}
