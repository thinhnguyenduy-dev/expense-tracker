"use client";

import { useState, useEffect, useRef } from "react";
import { Send, Sparkles, Loader2, MessageCircle, X, Maximize2, Minimize2, SquarePen, Search, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { aiApi, categoriesApi, expensesApi, incomesApi, Category } from "@/lib/api";
import { cn, getApiErrorMessage } from "@/lib/utils";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { ExpenseDialog, ExpenseFormData } from "@/components/expenses/ExpenseDialog";
import { usePathname } from "next/navigation";
import React, { memo } from "react";

// Define Conversation Message Type
type ToolCall = { name: string; args: unknown; result?: string };

type Message = {
    role: "user" | "agent";
    content: string;
    isError?: boolean;
    toolCalls?: ToolCall[];
};

type ExpenseDraft = {
    amount?: number;
    currency?: string;
    category?: string;
    category_id?: number | null;
    merchant?: string;
    description?: string;
    date?: string;
};

// Lightweight inline markdown renderer (no external library needed)
function renderInline(text: string): React.ReactNode {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**")
            ? <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>
            : part
    );
}

function renderMarkdown(text: string): React.ReactNode {
    const lines = text.split("\n");
    const nodes: React.ReactNode[] = [];
    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        if (line.startsWith("* ") || line.startsWith("- ")) {
            const items: string[] = [];
            while (i < lines.length && (lines[i].startsWith("* ") || lines[i].startsWith("- "))) {
                items.push(lines[i].slice(2));
                i++;
            }
            nodes.push(
                <ul key={i} className="list-disc pl-4 my-1 space-y-0.5">
                    {items.map((item, j) => <li key={j} className="leading-relaxed">{renderInline(item)}</li>)}
                </ul>
            );
        } else if (line === "") {
            i++;
        } else {
            nodes.push(<p key={i} className="mb-1 last:mb-0 leading-relaxed">{renderInline(line)}</p>);
            i++;
        }
    }
    return <>{nodes}</>;
}

// Compactly stringify a tool's args, e.g. {query: "SELECT ..."} → SELECT ...
function formatToolArgs(args: unknown): string {
    if (args == null) return "";
    if (typeof args === "string") return args;
    if (typeof args === "object") {
        try {
            return Object.values(args as Record<string, unknown>)
                .map((v) => (typeof v === "string" ? v : JSON.stringify(v)))
                .join(", ");
        } catch {
            return String(args);
        }
    }
    return String(args);
}

// Collapsible "what the agent did" panel — shows SQL queries / tool calls and
// their results. Populated from ChatResponse.tool_calls (e.g. the data_analyst's
// SQL trace when ANALYST_OUTPUT_MODE=full_history).
const ToolCallTrace = memo(({ calls }: { calls: ToolCall[] }) => {
    const [open, setOpen] = useState(false);
    if (!calls?.length) return null;
    return (
        <div className="mt-2 border-t border-gray-100 dark:border-gray-700 pt-1.5">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
                <Search className="h-3 w-3" />
                Tool calls ({calls.length})
                <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
            </button>
            {open && (
                <div className="mt-1.5 space-y-1.5">
                    {calls.map((c, i) => (
                        <div
                            key={i}
                            className="rounded-md bg-gray-50 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-700 p-2"
                        >
                            <div className="font-mono text-[11px] text-indigo-600 dark:text-indigo-400 break-all">
                                {c.name}({formatToolArgs(c.args)})
                            </div>
                            {c.result && (
                                <div className="mt-1 font-mono text-[11px] text-gray-500 dark:text-gray-400 whitespace-pre-wrap break-all line-clamp-6">
                                    → {c.result}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
});
ToolCallTrace.displayName = "ToolCallTrace";

const ChatMessageItem = memo(({ msg, onRetry }: { msg: Message; onRetry?: () => void }) => {
    const tAI = useTranslations("AI");
    return (
        <div className={cn("flex w-full", msg.role === "user" ? "justify-end" : "justify-start")}>
            <div className={cn(
                "max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm",
                msg.role === "user"
                    ? "bg-indigo-600 text-white rounded-br-none"
                    : cn("bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-bl-none",
                        msg.isError && "bg-red-50 text-red-600 border-red-100 dark:bg-red-950/20")
            )}>
                {msg.role === "agent" && !msg.isError ? (
                    <div className="text-gray-800 dark:text-gray-200">
                        {renderMarkdown(msg.content)}
                        {msg.toolCalls && <ToolCallTrace calls={msg.toolCalls} />}
                    </div>
                ) : (
                    <div className="space-y-1">
                        <span className="whitespace-pre-wrap">{msg.content}</span>
                        {msg.isError && onRetry && (
                            <button
                                onClick={onRetry}
                                className="block text-xs text-red-500 hover:text-red-700 underline mt-1"
                            >
                                {tAI('retry')}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
});
ChatMessageItem.displayName = "ChatMessageItem";

export function GlobalChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [input, setInput] = useState("");
  const [conversation, setConversation] = useState<Message[]>([]);
  const [lastUserMessage, setLastUserMessage] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isIncomeDialogOpen, setIsIncomeDialogOpen] = useState(false);
  const [pendingIncome, setPendingIncome] = useState<{ amount: number; source: string; date?: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [awaitingClarification, setAwaitingClarification] = useState(false);
  const [pendingDrafts, setPendingDrafts] = useState<ExpenseDraft[]>([]);
  const [currentDraftIndex, setCurrentDraftIndex] = useState(0);
  const [activeDraft, setActiveDraft] = useState<ExpenseDraft | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  
  // Hide on login/register pages if needed, usually global chat is fine everywhere except maybe auth pages
  const isAuthPage = pathname?.startsWith("/login") || pathname?.startsWith("/register");
  
  const t = useTranslations('Expenses');
  const tCommon = useTranslations('Common');
  const tAI = useTranslations('AI');

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

  // Record which draft to show, then open the dialog. The actual form.reset()
  // happens in the useEffect below — AFTER Radix mounts the dialog content and
  // react-hook-form registers the fields — otherwise the reset fires into
  // unregistered fields and the form shows empty.
  const openDraftDialog = (draft: ExpenseDraft) => {
      setActiveDraft(draft);
      setIsDialogOpen(true);
  };

  // Populate the form once the dialog is open AND we have a draft.
  useEffect(() => {
      if (!isDialogOpen || !activeDraft) return;
      const categoryId = activeDraft.category_id
          ? activeDraft.category_id.toString()
          : (categories.find(c => c.name.toLowerCase() === (activeDraft.category ?? "").toLowerCase())?.id.toString() ?? "");
      form.reset({
          amount: activeDraft.amount ?? 0,
          description: activeDraft.description ?? activeDraft.merchant ?? "",
          date: activeDraft.date ? new Date(activeDraft.date) : new Date(),
          category_id: categoryId,
          currency: activeDraft.currency ?? "VND",
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDialogOpen, activeDraft]);

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
          try {
              const storedThreadId = localStorage.getItem("ai_thread_id");
              if (storedThreadId) {
                  // Have a thread locally → load its history directly.
                  const { data } = await aiApi.getHistory(storedThreadId);
                  if (data && data.length > 0) setConversation(data);
                  return;
              }
              // No local thread (e.g. just logged in) → recover this user's most
              // recent thread from the server and restore it.
              const { data } = await aiApi.getLatestThread();
              if (data.thread_id) {
                  localStorage.setItem("ai_thread_id", data.thread_id);
                  if (data.history && data.history.length > 0) setConversation(data.history);
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
    setLastUserMessage(message);
    setConversation(prev => [...prev, { role: "user", content: message }]);
    setIsChatLoading(true);

    try {
        const storedThreadId = localStorage.getItem("ai_thread_id") || undefined;
        const response = await aiApi.chat({
            message,
            thread_id: storedThreadId,
            is_resume: awaitingClarification,
        });
        const data = response.data;

        if (data.thread_id) {
            localStorage.setItem("ai_thread_id", data.thread_id);
        }

        // Add agent response (with the agent's tool/SQL trace, if any)
        setConversation(prev => [...prev, { role: "agent", content: data.response, toolCalls: data.tool_calls }]);

        // The AI needs more info — keep the input in "answer the question" mode
        // so the next message is sent with is_resume=true.
        if (data.needs_clarification) {
            setAwaitingClarification(true);
            return;
        }

        // If we were resuming and the AI replied with another plain-text question
        // (no tool call), stay in clarification mode.
        if (awaitingClarification && !data.is_completed) {
            const looksLikeQuestion = data.response.includes("?");
            if (looksLikeQuestion) {
                setAwaitingClarification(true);
                return;
            }
        }

        setAwaitingClarification(false);

        if (data.is_completed && data.expense_data) {
            // Backend returns a single object OR an array (multi-expense).
            const drafts: ExpenseDraft[] = Array.isArray(data.expense_data)
                ? data.expense_data
                : [data.expense_data];
            setPendingDrafts(drafts);
            setCurrentDraftIndex(0);
            openDraftDialog(drafts[0]);
            if (drafts.length > 1) {
                toast.info(tAI('multiExpenseConfirm', { count: drafts.length }));
            } else {
                toast.info(tAI('draftReady'));
            }
        }

        if (data.is_completed && data.income_data) {
            const d = data.income_data;
            setPendingIncome({ amount: d.amount || 0, source: d.source || "", date: d.date });
            setIsIncomeDialogOpen(true);
            toast.info(tAI('incomeDraftReady'));
        }
    } catch (error: any) {
        console.error(error);
        const errorMsg = error.response?.data?.detail || "Something went wrong. Please try again.";
        setConversation(prev => [...prev, { role: "agent", content: errorMsg, isError: true }]);
    } finally {
        setIsChatLoading(false);
    }
  };

  const handleRetry = () => {
    if (!lastUserMessage || isChatLoading) return;
    // Remove last error message and resend
    setConversation(prev => prev.filter((_, i) => i !== prev.length - 1));
    setInput(lastUserMessage);
    setTimeout(() => handleSend(), 0);
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
      const dateStr = format(data.date, 'yyyy-MM-dd');

      // Check for duplicate: same amount + category on same date
      const { data: existing } = await expensesApi.getAll({
        start_date: dateStr,
        end_date: dateStr,
        category_id: parseInt(data.category_id),
        min_amount: data.amount,
        max_amount: data.amount,
        page_size: 1,
      });
      if (existing?.items?.length > 0) {
        const confirmed = window.confirm(
          tAI('duplicateExpenseWarning', { amount: data.amount.toLocaleString() })
        );
        if (!confirmed) { setIsSubmitting(false); return; }
      }

      await expensesApi.create({
        amount: data.amount,
        description: data.description,
        date: dateStr,
        category_id: parseInt(data.category_id),
        currency: data.currency,
      });
      toast.success(t('successAdd'));

      const nextIndex = currentDraftIndex + 1;
      if (nextIndex < pendingDrafts.length) {
        // More drafts to confirm — advance to the next one.
        setCurrentDraftIndex(nextIndex);
        openDraftDialog(pendingDrafts[nextIndex]);
        toast.info(tAI('expenseProgress', { current: nextIndex + 1, total: pendingDrafts.length }));
      } else {
        // All done — close and reset the queue.
        setIsDialogOpen(false);
        setPendingDrafts([]);
        setCurrentDraftIndex(0);
        setActiveDraft(null);
        setAwaitingClarification(false);
      }
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, t('failedSave')));
    } finally {
      setIsSubmitting(false);
    }
  };

  const onSubmitIncome = async () => {
    if (!pendingIncome) return;
    setIsSubmitting(true);
    try {
      await incomesApi.create({
        amount: pendingIncome.amount,
        source: pendingIncome.source,
        date: pendingIncome.date || format(new Date(), 'yyyy-MM-dd'),
      });
      toast.success(tAI('incomeAdded'));
      setIsIncomeDialogOpen(false);
      setPendingIncome(null);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, tAI('failedSaveIncome')));
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
            <Card className={cn(
              "shadow-2xl border-indigo-200 dark:border-indigo-800 transition-all duration-300 origin-bottom-right flex flex-col",
              isExpanded 
                ? "w-[90vw] sm:w-[600px] md:w-[700px] h-[80vh] sm:h-[700px]" 
                : "w-[350px] sm:w-[400px] h-[500px]"
            )}>
                <CardHeader className="p-3 pb-2 bg-indigo-50/50 dark:bg-indigo-950/20 border-b relative">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                             <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg">
                                <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                             </div>
                             <span className="font-semibold text-sm">{tAI('title')}</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-6 w-6 hover:text-indigo-500" title={tAI('newChat')} onClick={() => {
                                setConversation([]);
                                localStorage.removeItem("ai_thread_id");
                                setAwaitingClarification(false);
                                setPendingDrafts([]);
                                setCurrentDraftIndex(0);
                                setActiveDraft(null);
                            }}>
                                <SquarePen className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6 hover:text-indigo-500" onClick={() => setIsExpanded(!isExpanded)}>
                                {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                            </Button>
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
                                <p>{tAI('trySaying')}</p>
                                <p className="italic mt-2">{tAI('emptySuggestion1')}</p>
                                <p className="italic">{tAI('emptySuggestion2')}</p>
                            </div>
                        )}
                        
                        {conversation.map((msg, i) => (
                            <ChatMessageItem key={i} msg={msg} onRetry={msg.isError ? handleRetry : undefined} />
                        ))}
                        
                        {isChatLoading && (
                            <div className="flex justify-start">
                                <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl rounded-bl-none px-3 py-2 shadow-sm flex items-center gap-2">
                                    <Loader2 className="h-3 w-3 animate-spin text-indigo-500" />
                                    <span className="text-xs text-muted-foreground">{tAI('thinking')}</span>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                    
                    <div className="flex gap-2 relative mt-auto pt-2 border-t border-gray-100 dark:border-gray-800">
                        {awaitingClarification && (
                          <div className="absolute -top-4 left-0 text-[11px] text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            {tAI('awaitingAnswer')}
                          </div>
                        )}
                        <Textarea
                        value={input}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={awaitingClarification ? tAI('answerPlaceholder') : tAI('placeholder')}
                        className={cn(
                          "resize-none min-h-[40px] pr-10 rounded-xl focus-visible:ring-indigo-500 text-sm py-2",
                          awaitingClarification
                            ? "border-amber-400 dark:border-amber-600"
                            : "border-gray-200 dark:border-gray-800"
                        )}
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

      {/* Income confirmation dialog */}
      {isIncomeDialogOpen && pendingIncome && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl p-6 w-[320px] space-y-4">
            <h3 className="font-semibold text-base">{tAI('confirmIncome')}</h3>
            <div className="text-sm space-y-1 text-muted-foreground">
              <p>{tAI('amount')}: <span className="font-medium text-foreground">{pendingIncome.amount.toLocaleString()} VND</span></p>
              <p>{tAI('source')}: <span className="font-medium text-foreground">{pendingIncome.source}</span></p>
              {pendingIncome.date && <p>{tAI('date')}: <span className="font-medium text-foreground">{pendingIncome.date}</span></p>}
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => { setIsIncomeDialogOpen(false); setPendingIncome(null); }}>{tAI('cancel')}</Button>
              <Button size="sm" disabled={isSubmitting} onClick={onSubmitIncome} className="bg-indigo-600 hover:bg-indigo-700">
                {isSubmitting ? <Loader2 className="h-3 w-3 animate-spin" /> : tAI('confirm')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
