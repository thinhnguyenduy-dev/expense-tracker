import { useState } from "react";
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
  path: ["to_jar_id"], // Attach error to to_jar_id
});

interface TransferModalProps {
  jars: Jar[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function TransferModal({ jars, open, onOpenChange, onSuccess }: TransferModalProps) {
  const [loading, setLoading] = useState(false);
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

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      setLoading(true);
      await jarsApi.transfer({
        from_jar_id: parseInt(values.from_jar_id),
        to_jar_id: parseInt(values.to_jar_id),
        amount: values.amount,
      });
      toast.success(t("successTransfer"));
      form.reset();
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast.error(t("failedTransfer"));
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            {t("transferFunds")}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            {t("transferDesc")}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="from_jar_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-200">{t("from")}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                          <SelectValue placeholder={t("selectJar")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        {jars.map((jar) => (
                          <SelectItem key={jar.id} value={jar.id.toString()} className="text-white">
                            {jar.name} ({jar.balance})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-red-400" />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="to_jar_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-200">{t("to")}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                          <SelectValue placeholder={t("selectJar")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        {jars.map((jar) => (
                          <SelectItem key={jar.id} value={jar.id.toString()} className="text-white">
                            {jar.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-red-400" />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-slate-200">{tCommon("amount")}</FormLabel>
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
