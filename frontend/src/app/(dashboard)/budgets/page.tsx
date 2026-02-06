"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { budgetsApi, BudgetResponse } from "@/lib/api";
import { useAuthStore } from "@/lib/stores/auth-store";
import { BudgetCard } from "@/components/budgets/BudgetCard";
import { CategoryBudgetList } from "@/components/budgets/CategoryBudgetList";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

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
      <div className="flex h-[50vh] w-full justify-center items-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col gap-2">
         <h1 className="text-3xl font-bold text-foreground tracking-tight">Budgets</h1>
         <p className="text-muted-foreground">Manage your monthly spending limits and track your progress.</p>
      </div>
      
      <div className="grid gap-8 lg:grid-cols-3">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="lg:col-span-1"
        >
             <div className="sticky top-6">
                <BudgetCard 
                    title="Total Monthly Budget" 
                    status={data.overall} 
                    currency={currency}
                    locale={locale}
                />
             </div>
        </motion.div>
        
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="lg:col-span-2"
        >
            <CategoryBudgetList 
                categories={data.categories} 
                currency={currency}
                locale={locale}
                onUpdate={fetchBudgets}
            />
        </motion.div>
      </div>
    </div>
  );
}
