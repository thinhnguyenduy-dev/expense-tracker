import { useState, useRef, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { jarsApi, Jar } from "@/lib/api";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AmountInput } from "@/components/ui/amount-input";

const formSchema = z.object({
  from_jar_id: z.string().min(1, "Source Jar is required"),
  to_jar_id: z.string().min(1, "Destination Jar is required"),
  amount: z.number().min(0.01, "Amount must be greater than 0"),
}).refine(data => data.from_jar_id !== data.to_jar_id, {
  message: "Source and destination jars must be different",
  path: ["to_jar_id"],
});

interface TransferModalProps {
  jars: Jar[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function TransferModal({ jars, open, onOpenChange, onSuccess }: TransferModalProps) {
  const [loading, setLoading] = useState(false);
  const isSubmittingRef = useRef(false);
  const t = useTranslations("Jars");
  const tCommon = useTranslations("Common");

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      from_jar_id: "",
      to_jar_id: "",
      amount: 0,
    },
  });

  const onSubmit = useCallback(async (values: z.infer<typeof formSchema>) => {
    if (isSubmittingRef.current || loading) return;
    isSubmittingRef.current = true;
    
    try {
      setLoading(true);
      await jarsApi.transfer({
        from_jar_id: parseInt(values.from_jar_id),
        to_jar_id: parseInt(values.to_jar_id),
        amount: values.amount,
      });
      toast.success(t("successTransfer"));
      form.reset();
      onOpenChange(false);
      setTimeout(() => onSuccess(), 100);
    } catch (error) {
      toast.error(t("failedTransfer"));
      console.error(error);
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
    }
  }, [form, onSuccess, onOpenChange, loading, t]);

  const handleOpenChange = useCallback((open: boolean) => {
    if (loading) return;
    onOpenChange(open);
  }, [loading, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            {t("transferFunds")}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {t("transferDesc")}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <fieldset disabled={loading} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="from_jar_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground">{t("from")}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-muted border-border text-foreground">
                          <SelectValue placeholder={t("selectJar")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-card border-border">
                        {jars.map((jar) => (
                          <SelectItem key={jar.id} value={jar.id.toString()} className="text-foreground">
                            {jar.name} ({jar.balance})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-red-500" />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="to_jar_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground">{t("to")}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-muted border-border text-foreground">
                          <SelectValue placeholder={t("selectJar")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-card border-border">
                        {jars.map((jar) => (
                          <SelectItem key={jar.id} value={jar.id.toString()} className="text-foreground">
                            {jar.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-red-500" />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground">{tCommon("amount")}</FormLabel>
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

            </fieldset>
            <DialogFooter>
              <Button type="submit" disabled={loading} className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white w-full">
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("transfer")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
