"use client";

import { useState, useEffect } from "react";
import { Send, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea"; // Now exists
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { aiApi, categoriesApi, expensesApi, Category } from "@/lib/api";
import { cn, getApiErrorMessage } from "@/lib/utils";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { ExpenseDialog, ExpenseFormData } from "@/components/expenses/ExpenseDialog";

// Define Conversation Message Type
type Message = {
    role: "user" | "agent";
    content: string;
    isError?: boolean;
};

export function AIAssistant() {
  const [input, setInput] = useState("");
  const [conversation, setConversation] = useState<Message[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  
  const t = useTranslations('Expenses');
  const tCommon = useTranslations('Common');

  // Schema Definition
  const expenseSchema = z.object({
    amount: z.number().min(0.01, t('amountRequired')),
    description: z.string().min(1, t('descriptionRequired')),
    date: z.date({ message: t('dateRequired') }),
    category_id: z.string().min(1, t('categoryRequired')),
    currency: z.string().optional(),
  });

  const form = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseSchema),
    defaultValues: { date: new Date() },
  });

  // Fetch Categories on Mount
  useEffect(() => {
      const fetchCategories = async () => {
          try {
              const { data } = await categoriesApi.getAll();
              setCategories(data as Category[]);
          } catch (error) {
              console.error("Failed to load categories for AI Assistant", error);
          }
      };
      fetchCategories();
  }, []);

  const handleSend = async () => {
    if (!input.trim() || isChatLoading) return;
    
    const message = input;
    setInput("");
    setConversation(prev => [...prev, { role: "user", content: message }]);
    setIsChatLoading(true);

    try {
        const response = await aiApi.chat({ message });
        const data = response.data;

        // Add agent response
        setConversation(prev => [...prev, { role: "agent", content: data.response }]);
        
        if (data.is_completed && data.expense_data) {
            const d = data.expense_data;
            let categoryId = "";
            
            // Try to match category name
            if (d.category) {
                const match = categories.find(c => c.name.toLowerCase() === d.category.toLowerCase());
                if (match) categoryId = match.id.toString();
            }

            form.reset({
                amount: d.amount || 0,
                description: d.description || d.merchant || "",
                date: d.date ? new Date(d.date) : new Date(),
                category_id: categoryId,
                currency: d.currency || "VND"
            });

            setIsDialogOpen(true);
            toast.info("Draft ready for review");
        }
    } catch (error: any) {
        console.error(error);
        setConversation(prev => [...prev, { role: "agent", content: "Something went wrong. Please try again.", isError: true }]);
        toast.error("Failed to communicate with AI Agent.");
    } finally {
        setIsChatLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
    }
  };

  const onSubmit = async (data: ExpenseFormData) => {
    setIsSubmitting(true);
    try {
      const payload = {
        amount: data.amount,
        description: data.description,
        date: format(data.date, 'yyyy-MM-dd'),
        category_id: parseInt(data.category_id),
        currency: data.currency,
      };

      await expensesApi.create(payload);
      toast.success(t('successAdd'));
      
      setIsDialogOpen(false);
      setConversation([]); // Clear conversation on success
      
      // We can't use queryClient here, so we might need to manually trigger refresh provided by parent or just reload
      // Since dashboard pulls data on mount/update, we might need a way to refresh it.
      // However, for simplicity V1, simply saving is good. Dashboard might update eventually.
      // Better: pass a onRefresh prop or usage of global store?
      // Actually `DashboardPage` has `fetchData`. If I want to update dashboard stats, I should hook into it.
      // But `dashboardApi.getStats` acts on load.
      // Standard way without React Query: Reload page or use a context.
      // Let's just create it. The user will see it in expenses list or after refresh.
      // Optional: window.location.reload() - too harsh.
      // Let's leave as is. User can verify in Expenses tab.
        
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, t('failedSave')));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Card className="flex flex-col h-full border-indigo-100 dark:border-indigo-900 overflow-hidden relative group">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/50 via-transparent to-purple-50/50 dark:from-indigo-950/20 dark:to-purple-950/20 pointer-events-none" />
        
        <CardHeader className="pb-3 relative z-10">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg">
               <Sparkles className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
                 <CardTitle className="text-lg">AI Assistant</CardTitle>
                 <CardDescription>Type naturally to add expenses</CardDescription>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="flex-1 flex flex-col gap-4 relative z-10 min-h-[300px]">
          <div className="flex-1 overflow-y-auto space-y-4 max-h-[300px] pr-2 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-800">
             {conversation.length === 0 && (
                 <div className="text-center text-muted-foreground text-sm py-8 px-4 border-2 border-dashed rounded-lg border-gray-100 dark:border-gray-800">
                     <p>Try saying:</p>
                     <p className="italic mt-2">"Lunch at McDonald's for $15"</p>
                     <p className="italic">"Grab taxi 50k"</p>
                 </div>
             )}
             
             {conversation.map((msg, i) => (
               <div key={i} className={cn(
                 "flex w-full",
                 msg.role === "user" ? "justify-end" : "justify-start"
               )}>
                 <div className={cn(
                   "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm",
                   msg.role === "user" 
                     ? "bg-indigo-600 text-white rounded-br-none" 
                     : cn("bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-bl-none", msg.isError && "bg-red-50 text-red-600 border-red-100")
                 )}>
                   {msg.content}
                 </div>
               </div>
             ))}
             
             {isChatLoading && (
               <div className="flex justify-start">
                 <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl rounded-bl-none px-4 py-3 shadow-sm flex items-center gap-2">
                   <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
                   <span className="text-xs text-muted-foreground">Thinking...</span>
                 </div>
               </div>
             )}
          </div>
          
          <div className="flex gap-2 relative mt-auto pt-2">
            <Textarea 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..." 
              className="resize-none min-h-[50px] pr-12 rounded-xl border-gray-200 dark:border-gray-800 focus-visible:ring-indigo-500"
              rows={1}
            />
            <Button 
                size="icon" 
                onClick={handleSend}
                disabled={isChatLoading || !input.trim()}
                className="absolute right-2 top-1/2 -translate-y-[calc(50%-4px)] h-8 w-8 bg-indigo-600 hover:bg-indigo-700 rounded-lg"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <ExpenseDialog 
        isOpen={isDialogOpen} 
        onOpenChange={setIsDialogOpen}
        form={form}
        categories={categories}
        editingExpense={null}
        isSubmitting={isSubmitting}
        onSubmit={onSubmit}
      />
    </>
  );
}
