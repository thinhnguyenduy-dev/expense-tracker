"use client";

import { useState, useEffect, useRef } from "react";
import { Send, Sparkles, Loader2, MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
import { usePathname } from "next/navigation";

// Define Conversation Message Type
type Message = {
    role: "user" | "agent";
    content: string;
    isError?: boolean;
};

export function GlobalChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [conversation, setConversation] = useState<Message[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  
  // Hide on login/register pages if needed, usually global chat is fine everywhere except maybe auth pages
  const isAuthPage = pathname?.startsWith("/login") || pathname?.startsWith("/register");
  
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

  // Scroll to bottom effect
  useEffect(() => {
    if (isOpen && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [conversation, isOpen]);

  // Fetch Categories on Mount
  useEffect(() => {
      if (isAuthPage) return;

      const fetchCategories = async () => {
          try {
              const { data } = await categoriesApi.getAll();
              setCategories(data as Category[]);
          } catch (error) {
              console.error("Failed to load categories for AI Assistant", error);
          }
      };
      
      const loadHistory = async () => {
          const storedThreadId = localStorage.getItem("ai_thread_id");
          if (!storedThreadId) return;
          
          try {
              const { data } = await aiApi.getHistory(storedThreadId);
              if (data && data.length > 0) {
                  setConversation(data);
              }
          } catch (error) {
              console.error("Failed to load chat history", error);
          }
      };

      fetchCategories();
      loadHistory();
  }, [isAuthPage]);

  const handleSend = async () => {
    if (!input.trim() || isChatLoading) return;
    
    const message = input;
    setInput("");
    setConversation(prev => [...prev, { role: "user", content: message }]);
    setIsChatLoading(true);

    try {
        const storedThreadId = localStorage.getItem("ai_thread_id") || undefined;
        const response = await aiApi.chat({ message, thread_id: storedThreadId });
        const data = response.data;
        
        if (data.thread_id) {
            localStorage.setItem("ai_thread_id", data.thread_id);
        }

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
        const errorMsg = error.response?.data?.detail || "Something went wrong. Please try again.";
        setConversation(prev => [...prev, { role: "agent", content: errorMsg, isError: true }]);
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
      // Optional: don't clear conversation so user sees context
      // setConversation([]); 
        
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, t('failedSave')));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isAuthPage) return null;

  return (
    <>
      {/* Floating Action Button */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-4">
        {isOpen && (
            <Card className="w-[350px] shadow-2xl border-indigo-200 dark:border-indigo-800 transition-all duration-300 origin-bottom-right h-[500px] flex flex-col">
                <CardHeader className="p-3 pb-2 bg-indigo-50/50 dark:bg-indigo-950/20 border-b relative">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                             <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg">
                                <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                             </div>
                             <span className="font-semibold text-sm">AI Assistant</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-6 w-6 hover:text-red-500" onClick={() => setIsOpen(false)}>
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                
                <CardContent className="flex-1 flex flex-col gap-3 p-3 overflow-hidden bg-white dark:bg-gray-900/50">
                    <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-800">
                        {conversation.length === 0 && (
                            <div className="text-center text-muted-foreground text-xs py-8 px-4 border-2 border-dashed rounded-lg border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/20">
                                <p>Try saying:</p>
                                <p className="italic mt-2">"Lunch for $15"</p>
                                <p className="italic">"Spending report"</p>
                            </div>
                        )}
                        
                        {conversation.map((msg, i) => (
                            <div key={i} className={cn(
                            "flex w-full",
                            msg.role === "user" ? "justify-end" : "justify-start"
                            )}>
                            <div className={cn(
                                "max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm",
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
                                <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl rounded-bl-none px-3 py-2 shadow-sm flex items-center gap-2">
                                    <Loader2 className="h-3 w-3 animate-spin text-indigo-500" />
                                    <span className="text-xs text-muted-foreground">Thinking...</span>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                    
                    <div className="flex gap-2 relative mt-auto pt-2 border-t border-gray-100 dark:border-gray-800">
                        <Textarea 
                        value={input}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Type a message..." 
                        className="resize-none min-h-[40px] pr-10 rounded-xl border-gray-200 dark:border-gray-800 focus-visible:ring-indigo-500 text-sm py-2"
                        rows={1}
                        />
                        <Button 
                            size="icon" 
                            onClick={handleSend}
                            disabled={isChatLoading || !input.trim()}
                            className="absolute right-2 top-1/2 -translate-y-[calc(50%-6px)] h-7 w-7 bg-indigo-600 hover:bg-indigo-700 rounded-lg"
                        >
                        <Send className="h-3 w-3" />
                        </Button>
                    </div>
                </CardContent>
            </Card>
        )}

        <Button
            onClick={() => setIsOpen(!isOpen)}
            size="icon"
            className={cn(
                "h-14 w-14 rounded-full shadow-lg bg-indigo-600 hover:bg-indigo-700 transition-all duration-300",
                isOpen ? "rotate-90 opacity-0 pointer-events-none absolute" : "opacity-100"
            )}
        >
            <MessageCircle className="h-8 w-8 text-white" />
        </Button>
      </div>

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
