
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
import { Income } from "@/lib/api";

interface TransferHistoryWrapperProps {
  incomes: Income[];
  loading: boolean;
  t: (key: string) => string;
  tCommon: (key: string) => string;
  formatCurrency: (value: number) => string;
  setEditingIncome: (income: Income) => void;
  setOpenIncomeModal: (open: boolean) => void;
  deleteIncome: (id: number) => void;
}

export function TransferHistoryWrapper({ 
  incomes, 
  loading, 
  t, 
  tCommon, 
  formatCurrency, 
  setEditingIncome, 
  setOpenIncomeModal, 
  deleteIncome 
}: TransferHistoryWrapperProps) {
  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader>
        <CardTitle className="text-white">{t('incomeHistory')}</CardTitle>
        <CardDescription className="text-slate-400">
          {t('incomeHistoryDesc')}
        </CardDescription>
      </CardHeader>
      <CardContent>
         {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full bg-slate-700" />
              <Skeleton className="h-12 w-full bg-slate-700" />
              <Skeleton className="h-12 w-full bg-slate-700" />
            </div>
         ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-700 hover:bg-slate-800">
                  <TableHead className="text-slate-400">{tCommon('date')}</TableHead>
                  <TableHead className="text-slate-400">{t('source')}</TableHead>
                  <TableHead className="text-right text-slate-400">{tCommon('amount')}</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {incomes.length === 0 ? (
                  <TableRow className="border-slate-700 hover:bg-slate-800/50">
                    <TableCell colSpan={4} className="text-center text-slate-400">
                      {t('noIncome')}
                    </TableCell>
                  </TableRow>
                ) : (
                  incomes.map((income) => (
                    <TableRow key={income.id} className="border-slate-700 hover:bg-slate-800/50">
                      <TableCell className="text-slate-300">
                        {format(new Date(income.date), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="text-slate-300">{income.source}</TableCell>
                      <TableCell className="text-right font-medium text-white">
                        {formatCurrency(income.amount)}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 justify-end">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white" onClick={() => { setEditingIncome(income); setOpenIncomeModal(true); }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-400" onClick={() => deleteIncome(income.id)}>
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
  );
}
