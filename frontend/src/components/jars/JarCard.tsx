import { Jar } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import { useLocale, useTranslations } from 'next-intl';

interface JarCardProps {
  jar: Jar;
  onEdit: (jar: Jar) => void;
}

export function JarCard({ jar, onEdit }: JarCardProps) {
  const locale = useLocale();
  const t = useTranslations('Jars');
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-US', {
      style: "currency",
      currency: locale === 'vi' ? 'VND' : 'USD',
    }).format(amount);
  };

  return (
    <Card className="bg-card border-border hover:bg-muted/50 transition-colors">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
           <CardTitle className="text-sm font-medium text-foreground">{jar.name}</CardTitle>
           <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={() => onEdit(jar)}>
             <Pencil className="h-3 w-3" />
           </Button>
        </div>
        <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 cursor-default">
          {jar.percentage}%
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-foreground">{formatCurrency(jar.balance)}</div>
        <p className="text-xs text-muted-foreground">
          {t('currentBalance')}
        </p>
      </CardContent>
    </Card>
  );
}
