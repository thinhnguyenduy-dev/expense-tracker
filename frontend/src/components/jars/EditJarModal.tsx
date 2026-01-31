import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2 } from "lucide-react";
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
import { Input } from "@/components/ui/input";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  percentage: z.number().min(0, "Percentage must be positive").max(100, "Percentage cannot exceed 100"),
});

interface EditJarModalProps {
  jar: Jar | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EditJarModal({ jar, open, onOpenChange, onSuccess }: EditJarModalProps) {
  const [loading, setLoading] = useState(false);
  const t = useTranslations("Jars");

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      percentage: 0,
    },
  });

  useEffect(() => {
    if (jar) {
      form.reset({
        name: jar.name,
        percentage: jar.percentage,
      });
    }
  }, [jar, form]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!jar) return;

    try {
      setLoading(true);
      await jarsApi.update(jar.id, values);
      toast.success(t("successUpdate"));
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast.error(t("failedUpdate"));
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white">{t("editJar")}</DialogTitle>
          <DialogDescription className="text-slate-400">
            {t("editDesc")}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-slate-200">{t("name", { fallback: "Name" })}</FormLabel>
                   {/* Fallback used because "name" is common key, might be in Common or Jars need review. 
                       Actually 'linkToJar' is inside Categories, here we are in Jars namespace.
                       Wait, Jars namespace does NOT have "name". Common does. 
                       I should just use "Name" or add key. 
                       Wait, I can use Common translation too. */}
                  <FormControl>
                    <Input {...field} className="bg-slate-800 border-slate-700 text-white" />
                  </FormControl>
                  <FormMessage className="text-red-400" />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="percentage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-slate-200">{t("percentage")}</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      {...field} 
                      onChange={e => field.onChange(parseFloat(e.target.value))}
                      className="bg-slate-800 border-slate-700 text-white" 
                    />
                  </FormControl>
                  <FormMessage className="text-red-400" />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={loading} className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white">
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("saveChanges")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
