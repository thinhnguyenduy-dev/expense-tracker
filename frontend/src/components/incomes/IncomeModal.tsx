import { useEffect, useState, useRef, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { CalendarIcon, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { AmountInput } from "@/components/ui/amount-input";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { incomesApi, Income } from "@/lib/api";
import { toast } from "sonner";

const formSchema = z.object({
  amount: z.number().min(0.01, "Amount must be greater than 0"),
  source: z.string().min(1, "Source is required"),
  date: z.date({
    message: "Date is required",
  }),
});

interface IncomeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  incomeToEdit?: Income | null;
}

export function IncomeModal({ open, onOpenChange, onSuccess, incomeToEdit }: IncomeModalProps) {
  const [loading, setLoading] = useState(false);
  const isSubmittingRef = useRef(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: 0,
      source: "",
      date: new Date(),
    },
  });

  useEffect(() => {
    if (open) {
      isSubmittingRef.current = false;
    }
    if (incomeToEdit) {
      form.reset({
        amount: Number(incomeToEdit.amount),
        source: incomeToEdit.source,
        date: new Date(incomeToEdit.date),
      });
    } else {
      form.reset({
        amount: 0,
        source: "",
        date: new Date(),
      });
    }
  }, [incomeToEdit, form, open]);

  const onSubmit = useCallback(async (values: z.infer<typeof formSchema>) => {
    if (isSubmittingRef.current || loading) return;
    isSubmittingRef.current = true;
    
    try {
      setLoading(true);
      const data = {
        amount: values.amount,
        source: values.source,
        date: format(values.date, "yyyy-MM-dd"),
      };

      if (incomeToEdit) {
        await incomesApi.update(incomeToEdit.id, data);
        toast.success("Income updated successfully");
      } else {
        await incomesApi.create(data);
        toast.success("Income added successfully");
      }
      
      form.reset();
      onOpenChange(false);
      // Call onSuccess after modal is closed to prevent race conditions
      setTimeout(() => onSuccess(), 100);
    } catch (error) {
      toast.error(incomeToEdit ? "Failed to update income" : "Failed to add income");
      console.error(error);
      isSubmittingRef.current = false;
    } finally {
      setLoading(false);
    }
  }, [incomeToEdit, form, onSuccess, onOpenChange, loading]);

  // Prevent dialog close during submission
  const handleOpenChange = useCallback((open: boolean) => {
    if (loading) return; // Don't allow closing while submitting
    onOpenChange(open);
  }, [loading, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">{incomeToEdit ? "Edit Income" : "Add Income"}</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {incomeToEdit 
              ? "Update income details. This will adjust the distribution in your jars." 
              : "Add new income to distribute across your 6 Jars."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <fieldset disabled={loading} className="space-y-4">
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground">Amount</FormLabel>
                  <FormControl>
                    <AmountInput
                      placeholder="0.00"
                      value={field.value}
                      onValueChange={field.onChange}
                      className="bg-muted border-border text-foreground"
                    />
                  </FormControl>
                  <FormMessage className="text-red-500" />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="source"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground">Source</FormLabel>
                  <FormControl>
                    <Input placeholder="Salary, Bonus, etc." {...field} className="bg-muted border-border text-foreground" />
                  </FormControl>
                  <FormMessage className="text-red-500" />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel className="text-foreground">Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full pl-3 text-left font-normal bg-muted border-border text-foreground hover:bg-muted/80",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP")
                          ) : (
                            <span>Pick a date</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-card border-border" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) =>
                          date > new Date() || date < new Date("1900-01-01")
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage className="text-red-500" />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit" disabled={loading} className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white">
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {incomeToEdit ? "Save Changes" : "Add Income"}
              </Button>
            </DialogFooter>
            </fieldset>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
