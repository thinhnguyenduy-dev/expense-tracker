import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label"; // Assuming Label exists, or we use simple label
import { categoriesApi } from "@/lib/api";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface EditBudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  category: {
    id: number;
    name: string;
    monthly_limit: number | null;
  };
}

export function EditBudgetModal({ isOpen, onClose, onSuccess, category }: EditBudgetModalProps) {
  const [limit, setLimit] = useState<string>(category.monthly_limit ? category.monthly_limit.toString() : "");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const numLimit = limit === "" ? 0 : parseFloat(limit);
      
      if (isNaN(numLimit) || numLimit < 0) {
        toast.error("Please enter a valid positive number");
        setIsLoading(false);
        return;
      }

      await categoriesApi.update(category.id, {
        monthly_limit: numLimit === 0 ? undefined : numLimit // Send current value, backend treats None/null as removing limit if we send null? No, schema is Optional[float]. API logic: update_data.items(). sending specific value updates it.
        // If we want to remove limit, we might need a specific way. 
        // Let's assume sending 0 or empty means "no limit" or user intends to set it to 0. 
        // For better UX, 0 usually implies no budget or tight budget? 
        // Let's assume simple number update for now. 
      });

      toast.success("Budget limit updated");
      onSuccess();
      onClose();
    } catch (error) {
      console.error(error);
      toast.error("Failed to update budget limit");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Budget for {category.name}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              Monthly Limit
            </label>
            <Input 
              type="number" 
              placeholder="Enter monthly limit"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              min="0"
              step="0.01"
            />
            <p className="text-sm text-muted-foreground">
              Set to 0 or empty to remove the limit.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
