import { useState } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { vi, enUS } from "date-fns/locale";
import { useLocale } from "next-intl";
import { Income, incomesApi } from "@/lib/api";
import { IncomeCard } from "@/components/incomes/IncomeCard";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

interface TransferHistoryWrapperProps {
  incomes: Income[];
  loading: boolean;
  t: (key: string) => string;
  tCommon: (key: string) => string;
  formatCurrency: (value: number) => string;
  setEditingIncome: (income: Income) => void;
  setOpenIncomeModal: (open: boolean) => void;
  deleteIncome: (id: number) => void;
  onRefresh: () => void;
}

export function TransferHistoryWrapper({ 
  incomes, 
  loading, 
  t, 
  tCommon, 
  formatCurrency, 
  setEditingIncome, 
  setOpenIncomeModal, 
  deleteIncome,
  onRefresh
}: TransferHistoryWrapperProps) {
  const locale = useLocale();
  const [selectedIncomes, setSelectedIncomes] = useState<number[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  const toggleSelectAll = () => {
    if (selectedIncomes.length === incomes.length) {
      setSelectedIncomes([]);
    } else {
      setSelectedIncomes(incomes.map(i => i.id));
    }
  };

  const toggleSelect = (id: number) => {
    if (selectedIncomes.includes(id)) {
      setSelectedIncomes(selectedIncomes.filter(i => i !== id));
    } else {
      setSelectedIncomes([...selectedIncomes, id]);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIncomes.length === 0) return;
    
    // Using translation for confirmBulkDelete from common namespace or fallback
    const msg = tCommon('confirmBulkDelete')?.replace('{count}', selectedIncomes.length.toString()) 
                || `Are you sure you want to delete ${selectedIncomes.length} items?`;
                
    if (!confirm(msg)) return;

    setIsDeleting(true);
    try {
      await incomesApi.bulkDelete(selectedIncomes);
      toast.success(tCommon('successBulkDelete')?.replace('{count}', selectedIncomes.length.toString()) || `${selectedIncomes.length} incomes deleted`);
      setSelectedIncomes([]);
      onRefresh(); // Trigger a refetch
    } catch (error) {
      console.error(error);
      toast.error(tCommon('failedBulkDelete') || "Failed to delete incomes");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className="md:hidden space-y-4">
        <h3 className="text-xl font-semibold text-foreground mb-2">{t('incomeHistory')}</h3>
        {incomes.length === 0 ? (
           <p className="text-muted-foreground text-center py-8">{t('noIncome')}</p>
        ) : (
           incomes.map((income) => (
             <IncomeCard 
               key={income.id} 
               income={income} 
               onEdit={(i) => { setEditingIncome(i); setOpenIncomeModal(true); }} 
               onDelete={deleteIncome} 
             />
           ))
        )}
      </div>

      <Card className="hidden md:block bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-foreground">{t('incomeHistory')}</CardTitle>
            <CardDescription className="text-muted-foreground">
              {t('incomeHistoryDesc')}
            </CardDescription>
          </div>
          {selectedIncomes.length > 0 && (
             <Button
               variant="destructive"
               size="sm"
               onClick={handleDeleteSelected}
               disabled={isDeleting}
             >
               <Trash2 className="h-4 w-4 mr-2" />
               {tCommon('deleteSelected') || "Delete Selected"} ({selectedIncomes.length})
             </Button>
          )}
        </CardHeader>
        <CardContent>
           {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full bg-muted" />
                <Skeleton className="h-12 w-full bg-muted" />
                <Skeleton className="h-12 w-full bg-muted" />
              </div>
           ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-muted">
                    <TableHead className="w-[50px]">
                      <Checkbox
                        checked={incomes.length > 0 && selectedIncomes.length === incomes.length}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Select all"
                      />
                    </TableHead>
                    <TableHead className="text-muted-foreground">{tCommon('date')}</TableHead>
                    <TableHead className="text-muted-foreground">{t('source')}</TableHead>
                    <TableHead className="text-right text-muted-foreground">{tCommon('amount')}</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {incomes.length === 0 ? (
                    <TableRow className="border-border hover:bg-muted/50">
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        {t('noIncome')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    incomes.map((income) => (
                      <TableRow key={income.id} className="border-border hover:bg-muted/50">
                        <TableCell>
                          <Checkbox
                            checked={selectedIncomes.includes(income.id)}
                            onCheckedChange={() => toggleSelect(income.id)}
                            aria-label={`Select ${income.source}`}
                          />
                        </TableCell>
                        <TableCell className="text-foreground">
                          {format(new Date(income.date), "MMM d, yyyy", { locale: locale === 'vi' ? vi : enUS })}
                        </TableCell>
                        <TableCell className="text-foreground">{income.source}</TableCell>
                        <TableCell className="text-right font-medium text-foreground">
                          {formatCurrency(income.amount)}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 justify-end">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => { setEditingIncome(income); setOpenIncomeModal(true); }}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-500" onClick={() => deleteIncome(income.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
           )}
        </CardContent>
      </Card>
    </>
  );
}
