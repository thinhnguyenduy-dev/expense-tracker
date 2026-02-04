import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatCurrency } from "@/lib/utils";
import { AlertTriangle, CheckCircle } from "lucide-react";

interface BudgetStatus {
  limit: number | null;
  spent: number;
  percentage: number;
  is_over_limit: boolean;
  is_warning: boolean;
}

interface BudgetCardProps {
  title: string;
  status: BudgetStatus;
  currency: string;
  locale: string;
}

export function BudgetCard({ title, status, currency, locale }: BudgetCardProps) {
  const percent = Math.min(status.percentage, 100);
  let progressColor = "bg-emerald-500";
  if (status.is_over_limit) progressColor = "bg-red-500";
  else if (status.is_warning) progressColor = "bg-yellow-500";

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {status.is_over_limit ? (
          <AlertTriangle className="h-4 w-4 text-red-500" />
        ) : (
          <CheckCircle className="h-4 w-4 text-emerald-500" />
        )}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-foreground">
          {formatCurrency(status.spent, currency, locale)}
          <span className="text-muted-foreground text-sm font-normal ml-2">
            / {status.limit ? formatCurrency(status.limit, currency, locale) : "∞"}
          </span>
        </div>
        <Progress 
            value={percent} 
            className="h-2 mt-3" 
            indicatorClassName={progressColor}
        />
        <p className="text-xs text-muted-foreground mt-2">
          {status.percentage.toFixed(1)}% used
        </p>
      </CardContent>
    </Card>
  );
}
