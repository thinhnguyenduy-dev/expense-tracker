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
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{jar.name}</CardTitle>
        <Badge variant="secondary">{jar.percentage}%</Badge>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{formatCurrency(jar.balance)}</div>
        <p className="text-xs text-muted-foreground">
          Current Balance
        </p>
      </CardContent>
    </Card>
  );
}
