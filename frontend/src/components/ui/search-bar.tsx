"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, X, Loader2, Receipt, CircleDollarSign } from "lucide-react";
import { useLocale } from "next-intl";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { searchApi, SearchResult } from "@/lib/api";
import { formatCurrency } from "@/lib/utils"; 

export function SearchBar() {
  const router = useRouter();
  const locale = useLocale();
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  React.useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.trim().length >= 2) {
        setLoading(true);
        try {
          const response = await searchApi.search(query);
          setResults(response.data);
          setOpen(true);
        } catch (error) {
          console.error("Search failed", error);
        } finally {
          setLoading(false);
        }
      } else {
        setResults([]);
        setOpen(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = (result: SearchResult) => {
    setOpen(false);
    setQuery("");
    // Navigate based on type
    if (result.type === 'expense') {
        router.push(`/expenses?search=${encodeURIComponent(result.description)}`);
    } else {
        router.push(`/incomes?search=${encodeURIComponent(result.description)}`);
    }
  };

  const clearSearch = () => {
    setQuery("");
    setResults([]);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-8 bg-muted/50 border-transparent focus:bg-background focus:border-primary"
          onFocus={() => {
              if (results.length > 0) setOpen(true);
          }}
        />
        {query && (
            <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1 h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={clearSearch}
            >
                <X className="h-3 w-3" />
            </Button>
        )}
      </div>

      {open && (
        <div className="absolute top-full mt-2 w-full z-50 rounded-md border border-border bg-card shadow-lg overflow-hidden max-h-[300px] overflow-y-auto">
            {loading ? (
                <div className="flex items-center justify-center p-4 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Searching...
                </div>
            ) : results.length > 0 ? (
                <div className="py-1">
                    {results.map((result) => (
                        <div
                            key={`${result.type}-${result.id}`}
                            className="px-3 py-2 hover:bg-muted cursor-pointer flex items-center gap-3 transition-colors"
                            onClick={() => handleSelect(result)}
                        >
                            <div className={cn(
                                "flex h-8 w-8 items-center justify-center rounded-full bg-opacity-10 shrink-0",
                                result.type === 'expense' ? "bg-red-500/10 text-red-500" : "bg-emerald-500/10 text-emerald-500"
                            )}>
                                {result.type === 'expense' ? <Receipt className="h-4 w-4" /> : <CircleDollarSign className="h-4 w-4" />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-foreground truncate">{result.description || "No description"}</div>
                                <div className="text-xs text-muted-foreground truncate">{result.category_name} • {result.date}</div>
                            </div>
                            <div className={cn(
                                "text-sm font-medium whitespace-nowrap",
                                result.type === 'expense' ? "text-red-500" : "text-emerald-500"
                            )}>
                                {result.type === 'expense' ? '-' : '+'}{formatCurrency(result.amount, 'VND', locale)}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="p-4 text-center text-sm text-muted-foreground">
                    No results found
                </div>
            )}
        </div>
      )}
    </div>
  );
}
