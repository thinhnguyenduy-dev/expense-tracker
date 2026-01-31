import { Jar } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import { useLocale } from 'next-intl';

interface JarCardProps {
  jar: Jar;
  onEdit: (jar: Jar) => void;
}

export function JarCard({ jar, onEdit }: JarCardProps) {
  const locale = useLocale();
  
  // Format currency
  const formatCurrency = (amount: number) => {
    // Note: This matches the formatting in JarsPage
    return new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-US', {
      style: "currency",
      currency: locale === 'vi' ? 'VND' : 'USD',
    }).format(amount);
  };

  return (
    <Card className="bg-slate-800/50 border-slate-700 hover:bg-slate-800 transition-colors">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
           <CardTitle className="text-sm font-medium text-slate-200">{jar.name}</CardTitle>
           <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-white" onClick={() => onEdit(jar)}>
             <Pencil className="h-3 w-3" />
           </Button>
        </div>
        <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 cursor-default">
          {jar.percentage}%
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-white">{formatCurrency(jar.balance)}</div>
        <p className="text-xs text-slate-400">
          Current Balance
        </p>
      </CardContent>
    </Card>
  );
}
