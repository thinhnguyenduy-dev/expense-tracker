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
    <div className="bg-card rounded-lg p-4 mb-4 border border-border shadow-sm">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h4 className="font-medium text-foreground text-lg">{expense.description || "Expense"}</h4>
          <p className="text-muted-foreground text-sm">{format(new Date(expense.date), "MMM d, yyyy")}</p>
        </div>
        <div className="text-right">
             <span className="text-emerald-500 font-bold block">
                <FormattedCurrency value={expense.amount} />
             </span>
             {expense.category && (
                <span className="text-xs px-2 py-1 rounded bg-muted text-foreground mt-1 inline-block" style={{ borderLeft: `3px solid ${expense.category.color}` }}>
                  {expense.category.name}
                </span>
             )}
        </div>
      </div>
      
      <div className="flex justify-end gap-2 mt-4 border-t border-border pt-3">
        <Button variant="ghost" size="sm" className="h-8 px-2 text-muted-foreground hover:text-foreground" onClick={() => onEdit(expense)}>
          <Pencil className="h-4 w-4 mr-1" /> Edit
        </Button>
        <Button variant="ghost" size="sm" className="h-8 px-2 text-muted-foreground hover:text-red-500" onClick={() => onDelete(expense.id)}>
          <Trash2 className="h-4 w-4 mr-1" /> Delete
        </Button>
      </div>
    </div>
  );
}
