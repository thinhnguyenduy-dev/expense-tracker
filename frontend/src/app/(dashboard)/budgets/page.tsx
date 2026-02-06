"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { budgetsApi, BudgetResponse } from "@/lib/api";
import { useAuthStore } from "@/lib/stores/auth-store";
import { BudgetCard } from "@/components/budgets/BudgetCard";
import { CategoryBudgetList } from "@/components/budgets/CategoryBudgetList";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function BudgetsPage() {
  const t = useTranslations('Dashboard');
  const locale = useLocale();
  const { user } = useAuthStore();
  const currency = user?.currency || 'VND';
  
  const [data, setData] = useState<BudgetResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBudgets();
  }, []);

  const fetchBudgets = async () => {
    try {
      const response = await budgetsApi.getStatus();
      setData(response.data);
    } catch (error) {
      toast.error("Failed to load budget status");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-foreground">Budgets</h1>
      
      <div className="grid gap-6 md:grid-cols-2">
        <div className="col-span-2 md:col-span-1">
             <BudgetCard 
                title="Overall Monthly Budget" 
                status={data.overall} 
                currency={currency}
                locale={locale}
             />
        </div>
        
        <CategoryBudgetList 
            categories={data.categories} 
            currency={currency}
            locale={locale}
            onUpdate={fetchBudgets}
        />
      </div>
    </div>
  );
}
