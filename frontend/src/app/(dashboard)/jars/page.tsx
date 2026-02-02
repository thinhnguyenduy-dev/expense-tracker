"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Pencil, Loader2, ArrowRightLeft } from "lucide-react";
import { format } from "date-fns";
import { useTranslations, useLocale } from 'next-intl';
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { JarCard } from "@/components/jars/JarCard";
import { IncomeModal } from "@/components/incomes/IncomeModal";
import { EditJarModal } from "@/components/jars/EditJarModal";
import { TransferModal } from "@/components/jars/TransferModal";
import { TransfersHistory } from "@/components/jars/TransfersHistory";
import { TransferHistoryWrapper } from "@/components/jars/TransferHistoryWrapper";
import { Jar, Income, jarsApi, incomesApi } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";

export default function JarsPage() {
  const [jars, setJars] = useState<Jar[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [loading, setLoading] = useState(true);
  const [openIncomeModal, setOpenIncomeModal] = useState(false);
  const [editingIncome, setEditingIncome] = useState<Income | null>(null);
  const [editingJar, setEditingJar] = useState<Jar | null>(null);
  const [openTransfer, setOpenTransfer] = useState(false);

  const t = useTranslations('Jars');
  const tCommon = useTranslations('Common');
  const locale = useLocale();

  const fetchData = async () => {
    try {
      setLoading(true);
      const [jarsData, incomesData] = await Promise.all([
        jarsApi.getAll(),
        incomesApi.getAll(),
      ]);
      setJars(jarsData.data);
      setIncomes(incomesData.data);
    } catch (error) {
      console.error("Failed to fetch jars data", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-US', {
      style: "currency",
      currency: locale === 'vi' ? 'VND' : 'USD',
    }).format(amount);
  };

  const deleteIncome = async (id: number) => {
    if (!confirm(tCommon('confirmDelete'))) return;
    
    try {
      await incomesApi.delete(id);
      toast.success(t('successDeleteIncome') || "Income deleted successfully");
      fetchData();
    } catch (error) {
      toast.error(t('failedDeleteIncome') || "Failed to delete income");
      console.error(error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight text-white">{t('title')}</h2>
        <div className="flex items-center space-x-2">
          {/* Actions: Add Income and Transfer */}
          <Button onClick={() => { setEditingIncome(null); setOpenIncomeModal(true); }} className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600">
            <Plus className="mr-2 h-4 w-4" /> {t('addIncome')}
          </Button>
          <Button onClick={() => setOpenTransfer(true)} className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600">
            <ArrowRightLeft className="mr-2 h-4 w-4" /> {t('transferFunds')}
          </Button>
        </div>
      </div>
      
      {/* Jars Display */}
      <h3 className="text-xl font-semibold mt-6 mb-4 text-white">{t('yourJars')}</h3>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loading
          ? Array(6)
              .fill(0)
              .map((_, i) => (
                <Card key={i} className="bg-slate-800/50 border-slate-700">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <Skeleton className="h-4 w-[100px] bg-slate-700" />
                    <Skeleton className="h-4 w-[40px] bg-slate-700" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-8 w-[100px] bg-slate-700" />
                    <Skeleton className="mt-2 h-3 w-[60px] bg-slate-700" />
                  </CardContent>
                </Card>
              ))
          : jars.map((jar) => <JarCard key={jar.id} jar={jar} onEdit={setEditingJar} />)}
      </div>

      {/* Income History */}
      <div className="grid gap-6 md:grid-cols-1 mt-8">
        <TransferHistoryWrapper 
          incomes={incomes} 
          loading={loading} 
          t={t} 
          tCommon={tCommon} 
          formatCurrency={formatCurrency}
          setEditingIncome={setEditingIncome}
          setOpenIncomeModal={setOpenIncomeModal}
          deleteIncome={deleteIncome}
        />
        <TransfersHistory /> 
      </div>


      <IncomeModal 
        open={openIncomeModal} 
        onOpenChange={setOpenIncomeModal}
        onSuccess={fetchData} 
        incomeToEdit={editingIncome}
      />
      
      <EditJarModal
        jar={editingJar}
        open={!!editingJar}
        onOpenChange={(open) => !open && setEditingJar(null)}
        onSuccess={fetchData}
      />

      <TransferModal
        jars={jars}
        open={openTransfer}
        onOpenChange={setOpenTransfer}
        onSuccess={fetchData}
      />
    </div>
  );
}
