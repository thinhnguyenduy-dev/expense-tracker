import { useEffect, useState, useRef, useCallback } from "react";
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
  const isSubmittingRef = useRef(false);
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

  const onSubmit = useCallback(async (values: z.infer<typeof formSchema>) => {
    if (!jar || isSubmittingRef.current || loading) return;
    isSubmittingRef.current = true;

    try {
      setLoading(true);
      await jarsApi.update(jar.id, values);
      toast.success(t("successUpdate"));
      onOpenChange(false);
      setTimeout(() => onSuccess(), 100);
    } catch (error) {
      toast.error(t("failedUpdate"));
      console.error(error);
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
    }
  }, [jar, onSuccess, onOpenChange, loading, t]);

  const handleOpenChange = useCallback((open: boolean) => {
    if (loading) return;
    onOpenChange(open);
  }, [loading, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">{t("editJar")}</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {t("editDesc")}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <fieldset disabled={loading} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground">{t("name", { fallback: "Name" })}</FormLabel>
                  <FormControl>
                    <Input {...field} className="bg-muted border-border text-foreground" />
                  </FormControl>
                  <FormMessage className="text-red-500" />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="percentage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground">{t("percentage")}</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      {...field} 
                      onChange={e => field.onChange(parseFloat(e.target.value))}
                      className="bg-muted border-border text-foreground" 
                    />
                  </FormControl>
                  <FormMessage className="text-red-500" />
                </FormItem>
              )}
            />
            </fieldset>
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
