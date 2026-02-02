import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { CalendarIcon, Loader2 } from "lucide-react";

import { useAuthStore } from "@/lib/stores/auth-store";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { cn, formatCurrency } from "@/lib/utils";
import { incomesApi, ratesApi } from "@/lib/api";
import { toast } from "sonner";

// Inline ConversionPreview component
function ConversionPreview({ amount, from, to }: { amount: number; from: string; to: string }) {
  const [converted, setConverted] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Simple debounce
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (amount <= 0) return;
      setLoading(true);
      try {
        const { data } = await ratesApi.convert(amount, from, to);
        setConverted(data.converted_amount);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [amount, from, to]);

  if (loading) return <span className="animate-pulse">Calculating...</span>;
  if (converted === null) return null;
  
  return (
    <span>≈ {formatCurrency(converted, to, 'en-US')}</span> 
  );
}


const formSchema = z.object({
  amount: z.number().min(0.01, "Amount must be greater than 0"),
  source: z.string().min(1, "Source is required"),
  currency: z.string().optional(),
  date: z.date({
    message: "Date is required",
  }),
});

interface AddIncomeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AddIncomeModal({ open, onOpenChange, onSuccess }: AddIncomeModalProps) {
  const [loading, setLoading] = useState(false);
  const { user } = useAuthStore();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: 0,
      source: "",
      currency: user?.currency || "VND", // Default will be set in useEffect too but good here
      date: new Date(),
    },
  });

  // Ensure default currency is set when user data loads
  useEffect(() => {
    if (user?.currency && !form.getValues("currency")) {
      form.setValue("currency", user.currency);
    }
  }, [user?.currency, form]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      setLoading(true);
      await incomesApi.create({
        amount: values.amount,
        source: values.source,
        currency: values.currency,
        date: format(values.date, "yyyy-MM-dd"),
      });
      toast.success("Income added successfully");
      form.reset();
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast.error("Failed to add income");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white">Add Income</DialogTitle>
          <DialogDescription className="text-slate-400">
            Add new income to distribute across your 6 Jars.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-200">Amount</FormLabel>
                    <FormControl>
                      <AmountInput
                        placeholder="0.00"
                        value={field.value}
                        onValueChange={field.onChange}
                        className="bg-slate-800 border-slate-700 text-white"
                      />
                    </FormControl>
                    <FormMessage className="text-red-400" />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-200">Currency</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                          <SelectValue placeholder="Currency" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        <SelectItem value="VND" className="text-white hover:bg-slate-700">VND (₫)</SelectItem>
                        <SelectItem value="USD" className="text-white hover:bg-slate-700">USD ($)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="source"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-slate-200">Source</FormLabel>
                  <FormControl>
                    <Input placeholder="Salary, Bonus, etc." {...field} className="bg-slate-800 border-slate-700 text-white" />
                  </FormControl>
                  <FormMessage className="text-red-400" />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel className="text-slate-200">Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full pl-3 text-left font-normal bg-slate-800 border-slate-700 text-white hover:bg-slate-700 hover:text-white",
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
                    <PopoverContent className="w-auto p-0 bg-slate-800 border-slate-700" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) =>
                          date > new Date() || date < new Date("1900-01-01")
                        }
                        initialFocus
                        className="bg-slate-800 text-white"
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage className="text-red-400" />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={loading} className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white">
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add Income
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
