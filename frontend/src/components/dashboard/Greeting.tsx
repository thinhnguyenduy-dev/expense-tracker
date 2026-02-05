"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/lib/stores/auth-store";
import { Sun, Moon, Sunrise, Sunset, LucideIcon } from "lucide-react";
import { FadeIn } from "@/components/ui/motion";

export function Greeting() {
  const { user } = useAuthStore();
  const [greeting, setGreeting] = useState("");
  const [Icon, setIcon] = useState<LucideIcon>(Sun);

  useEffect(() => {
    const hour = new Date().getHours();
    
    if (hour >= 5 && hour < 12) {
      setGreeting("Good Morning");
      setIcon(Sunrise);
    } else if (hour >= 12 && hour < 18) {
      setGreeting("Good Afternoon");
      setIcon(Sun);
    } else if (hour >= 18 && hour < 22) {
      setGreeting("Good Evening");
      setIcon(Sunset);
    } else {
      setGreeting("Good Night");
      setIcon(Moon);
    }
  }, []);

  return (
    <FadeIn>
      <div className="flex items-center gap-2 mb-1">
        <Icon className="h-5 w-5 text-yellow-500 animate-pulse" />
        <span className="text-muted-foreground text-sm font-medium uppercase tracking-wider">
          {greeting}
        </span>
      </div>
      <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-500 to-teal-500">
        {user?.name || "Welcome Back"}!
      </h1>
    </FadeIn>
  );
}
