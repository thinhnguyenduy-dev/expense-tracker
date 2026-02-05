"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Receipt, CircleDollarSign, Menu, PiggyBank } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Sidebar } from "@/components/layout/sidebar";
import { useState } from "react";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

export function BottomNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (path: string) => pathname === path;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-t border-border md:hidden safe-area-bottom pb-safe">
      <div className="flex items-center justify-around px-2 py-2">
        <Link
          href="/dashboard"
          className={cn(
            "flex flex-col items-center gap-1 p-2 rounded-lg transition-colors flex-1",
            isActive("/dashboard")
              ? "text-emerald-500"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <LayoutDashboard className="h-6 w-6" />
          <span className="text-[10px] font-medium">Home</span>
        </Link>
        <Link
          href="/expenses"
          className={cn(
            "flex flex-col items-center gap-1 p-2 rounded-lg transition-colors flex-1",
            isActive("/expenses")
              ? "text-emerald-500"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Receipt className="h-6 w-6" />
          <span className="text-[10px] font-medium">Out</span>
        </Link>

        {/* FAB Style Add Button (Center) */}
        <Link href="/expenses?new=true" className="-mt-8 z-10">
            <div className="h-14 w-14 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/30 flex items-center justify-center text-white hover:scale-105 transition-transform border-4 border-background ring-2 ring-emerald-500/20">
                <span className="text-3xl font-light mb-1 relative top-[-1px]">+</span>
            </div>
        </Link>

        <Link
          href="/incomes"
          className={cn(
            "flex flex-col items-center gap-1 p-2 rounded-lg transition-colors flex-1",
            isActive("/incomes")
              ? "text-emerald-500"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <CircleDollarSign className="h-6 w-6" />
          <span className="text-[10px] font-medium">In</span>
        </Link>

        {/* Menu Trigger for full Sidebar */}
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <button
                    className={cn(
                        "flex flex-col items-center gap-1 p-2 rounded-lg transition-colors flex-1",
                        "text-muted-foreground hover:text-foreground"
                    )}
                >
                    <Menu className="h-6 w-6" />
                    <span className="text-[10px] font-medium">Menu</span>
                </button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72 border-r border-border">
                <VisuallyHidden>
                    <SheetTitle>Navigation Menu</SheetTitle>
                </VisuallyHidden>
                <Sidebar staticMode={true} onClose={() => setOpen(false)} />
            </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
