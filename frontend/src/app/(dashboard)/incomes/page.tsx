'use client';

import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Search, X, CircleDollarSign } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useTranslations, useLocale } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { incomesApi, Income } from '@/lib/api';
import { IncomeModal } from '@/components/incomes/IncomeModal';
import { cn } from '@/lib/utils';
import { IncomeCard } from '@/components/incomes/IncomeCard';

const formatCurrency = (value: number, locale: string) => {
  return new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-US', {
    style: 'currency',
    currency: locale === 'vi' ? 'VND' : 'USD',
  }).format(value);
};

export default function IncomesPage() {
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [incomeToEdit, setIncomeToEdit] = useState<Income | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const t = useTranslations('Incomes');
  const tCommon = useTranslations('Common');
  const locale = useLocale();

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const response = await incomesApi.getAll();
      setIncomes(response.data);
    } catch (error) {
      console.error(error);
      toast.error(tCommon('error'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenCreate = () => {
    setIncomeToEdit(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (income: Income) => {
    setIncomeToEdit(income);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t('confirmDelete'))) return;

    try {
      await incomesApi.delete(id);
      toast.success(t('successDelete'));
      fetchData();
    } catch {
      toast.error(t('failedDelete'));
    }
  };

  const filteredIncomes = incomes.filter(income => 
    income.source.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalIncome = filteredIncomes.reduce((sum, income) => sum + Number(income.amount), 0);

  if (isLoading && incomes.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">{t('title')}</h1>
          <p className="text-slate-400 mt-1">{t('subtitle')}</p>
        </div>
        <Button
          onClick={handleOpenCreate}
          className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600"
        >
          <Plus className="h-4 w-4 mr-2" />
          {t('addIncome')}
        </Button>
      </div>

      {/* Stats & Search */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Total Card */}
          <Card className="flex-1 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border-emerald-500/30">
            <CardContent className="pt-6 flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">{tCommon('total')}</p>
                <p className="text-2xl font-bold text-white">{formatCurrency(totalIncome, locale)}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <CircleDollarSign className="h-5 w-5 text-emerald-400" />
              </div>
            </CardContent>
          </Card>

          {/* Search */}
          <div className="flex-1">
             <div className="relative h-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder={t('searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-full bg-slate-800 border-slate-700 text-white"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-slate-400"
                  onClick={() => setSearchQuery('')}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Incomes Table */}
      {filteredIncomes.length === 0 ? (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="h-16 w-16 rounded-full bg-slate-700 flex items-center justify-center mb-4">
              <CircleDollarSign className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">
              {searchQuery ? t('noIncomesMatching', { query: searchQuery }) : t('noIncomes')}
            </h3>
            <p className="text-slate-400 text-center mb-4">
              {searchQuery ? '' : t('startTracking')}
            </p>
            {!searchQuery && (
              <Button
                onClick={handleOpenCreate}
                className="bg-gradient-to-r from-emerald-500 to-teal-500"
              >
                <Plus className="h-4 w-4 mr-2" />
                {t('addIncome')}
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (

        <>
          <div className="md:hidden">
            {filteredIncomes.map((income) => (
              <IncomeCard 
                key={income.id} 
                income={income} 
                onEdit={(i: Income) => handleOpenEdit(i)} 
                onDelete={(id: number) => handleDelete(id)} 
              />
            ))}
          </div>

          <Card className="hidden md:block bg-slate-800/50 border-slate-700 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-700 hover:bg-slate-800">
                  <TableHead className="text-slate-400">{tCommon('date')}</TableHead>
                  <TableHead className="text-slate-400">{t('source')}</TableHead>
                  <TableHead className="text-slate-400 text-right">{tCommon('amount')}</TableHead>
                  <TableHead className="text-slate-400 text-right">{tCommon('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredIncomes.map((income) => (
                  <TableRow
                    key={income.id}
                    className="border-slate-700 hover:bg-slate-800/50"
                  >
                    <TableCell className="text-slate-300">
                      {format(new Date(income.date), 'MMM dd, yyyy')}
                    </TableCell>
                    <TableCell className="text-white font-medium">
                      {income.source}
                    </TableCell>
                    <TableCell className="text-right font-medium text-emerald-400">
                      +{formatCurrency(Number(income.amount), locale)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenEdit(income)}
                          className="h-8 w-8 text-slate-400 hover:text-white"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(income.id)}
                          className="h-8 w-8 text-slate-400 hover:text-red-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}

      <IncomeModal 
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        onSuccess={fetchData}
        incomeToEdit={incomeToEdit}
      />
    </div>
  );
}
