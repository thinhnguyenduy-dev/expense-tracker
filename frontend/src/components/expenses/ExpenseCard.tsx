import { format } from "date-fns";
import { FormattedCurrency } from "@/components/format/FormattedCurrency";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";
import { Expense } from "@/lib/api";

interface ExpenseCardProps {
  expense: Expense;
  onEdit: (expense: Expense) => void;
  onDelete: (id: number) => void;
}

export function ExpenseCard({ expense, onEdit, onDelete }: ExpenseCardProps) {
  return (
    <div className="bg-slate-800 rounded-lg p-4 mb-4 border border-slate-700 shadow-sm">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h4 className="font-medium text-white text-lg">{expense.description || "Expense"}</h4>
          <p className="text-slate-400 text-sm">{format(new Date(expense.date), "MMM d, yyyy")}</p>
        </div>
        <div className="text-right">
             <span className="text-emerald-400 font-bold block">
                <FormattedCurrency value={expense.amount} />
             </span>
             {expense.category && (
                <span className="text-xs px-2 py-1 rounded bg-slate-700 text-slate-300 mt-1 inline-block" style={{ borderLeft: `3px solid ${expense.category.color}` }}>
                  {expense.category.name}
                </span>
             )}
        </div>
      </div>
      
      <div className="flex justify-end gap-2 mt-4 border-t border-slate-700 pt-3">
        <Button variant="ghost" size="sm" className="h-8 px-2 text-slate-400 hover:text-white" onClick={() => onEdit(expense)}>
          <Pencil className="h-4 w-4 mr-1" /> Edit
        </Button>
        <Button variant="ghost" size="sm" className="h-8 px-2 text-slate-400 hover:text-red-400" onClick={() => onDelete(expense.id)}>
          <Trash2 className="h-4 w-4 mr-1" /> Delete
        </Button>
      </div>
    </div>
  );
}
