
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { AlertTriangle, CheckCircle, TrendingUp, TrendingDown } from "lucide-react";
import { motion } from "framer-motion";

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
  
  // Determine gradient and status colors
  let gradient = "from-emerald-500/10 to-emerald-500/5 border-emerald-500/20";
  let iconColor = "text-emerald-500";
  let textColor = "text-emerald-700 dark:text-emerald-400";
  let barColor = "bg-emerald-500";
  let StatusIcon = CheckCircle;

  if (status.is_over_limit) {
    gradient = "from-red-500/10 to-red-500/5 border-red-500/20";
    iconColor = "text-red-500";
    textColor = "text-red-700 dark:text-red-400";
    barColor = "bg-red-500";
    StatusIcon = AlertTriangle;
  } else if (status.is_warning) {
    gradient = "from-yellow-500/10 to-yellow-500/5 border-yellow-500/20";
    iconColor = "text-yellow-500";
    textColor = "text-yellow-700 dark:text-yellow-400";
    barColor = "bg-yellow-500";
    StatusIcon = TrendingUp;
  }

  const remaining = status.limit ? status.limit - status.spent : 0;
  const isSurplus = remaining >= 0;

  return (
    <Card className={`relative overflow-hidden border transition-all duration-300 hover:shadow-lg ${gradient}`}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-medium text-muted-foreground flex items-center gap-2">
          {title}
        </CardTitle>
        <div className={`p-2 rounded-full bg-background/50 backdrop-blur-sm ${iconColor}`}>
           <StatusIcon className="h-5 w-5" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-1 mb-6">
          <span className="text-4xl font-bold tracking-tight text-foreground">
            {formatCurrency(status.spent, currency, locale)}
          </span>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
             <span>of {status.limit ? formatCurrency(status.limit, currency, locale) : "∞"}</span>
             <span className="text-xs text-muted-foreground/50">•</span>
             <span className={isSurplus ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
                {status.limit ? (
                   `${isSurplus ? 'Remaining: ' : 'Over by: '}${formatCurrency(Math.abs(remaining), currency, locale)}`
                ) : 'No limit set'}
             </span>
          </div>
        </div>

        <div className="space-y-2">
           <div className="flex justify-between text-xs font-medium text-muted-foreground">
              <span>{Math.round(status.percentage)}% Used</span>
           </div>
           
           <div className="h-3 w-full bg-secondary/50 rounded-full overflow-hidden backdrop-blur-sm">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${percent}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                className={`h-full rounded-full ${barColor} shadow-sm`}
              />
           </div>
        </div>
      </CardContent>
    </Card>
  );
}
