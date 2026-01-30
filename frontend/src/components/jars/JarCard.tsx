import { Jar } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface JarCardProps {
  jar: Jar;
}

export function JarCard({ jar }: JarCardProps) {
  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  return (
    <Card className="bg-slate-800/50 border-slate-700 hover:bg-slate-800 transition-colors">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-slate-200">{jar.name}</CardTitle>
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
