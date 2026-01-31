import { format } from "date-fns";
import { FormattedCurrency } from "@/components/format/FormattedCurrency";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";
import { Income } from "@/lib/api";

interface IncomeCardProps {
  income: Income;
  onEdit: (income: Income) => void;
  onDelete: (id: number) => void;
}

export function IncomeCard({ income, onEdit, onDelete }: IncomeCardProps) {
  return (
    <div className="bg-slate-800 rounded-lg p-4 mb-4 border border-slate-700 shadow-sm">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h4 className="font-medium text-white text-lg">{income.source || "Income"}</h4>
          <p className="text-slate-400 text-sm">{format(new Date(income.date), "MMM d, yyyy")}</p>
        </div>
        <div className="text-right">
             <span className="text-emerald-400 font-bold block">
                <FormattedCurrency value={income.amount} />
             </span>
        </div>
      </div>
      
      <div className="flex justify-end gap-2 mt-4 border-t border-slate-700 pt-3">
        <Button variant="ghost" size="sm" className="h-8 px-2 text-slate-400 hover:text-white" onClick={() => onEdit(income)}>
          <Pencil className="h-4 w-4 mr-1" /> Edit
        </Button>
        <Button variant="ghost" size="sm" className="h-8 px-2 text-slate-400 hover:text-red-400" onClick={() => onDelete(income.id)}>
          <Trash2 className="h-4 w-4 mr-1" /> Delete
        </Button>
      </div>
    </div>
  );
}
