import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from 'lucide-react';
import { useLocale } from 'next-intl';
import { formatCurrency } from '@/lib/utils';
import { useAuthStore } from '@/lib/stores/auth-store';

interface Bill {
  id: number;
  description: string;
  amount: number;
  next_due_date: string;
  frequency: string;
}

interface UpcomingBillsProps {
  bills: Bill[];
}

export function UpcomingBills({ bills }: UpcomingBillsProps) {
  const locale = useLocale();
  const { user } = useAuthStore();
  const currency = user?.currency || 'VND';

  if (bills.length === 0) return null;

  return (
    <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700 h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-white flex items-center gap-2 text-base">
          <Calendar className="h-4 w-4 text-emerald-400" />
          Upcoming Bills
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {bills.map((bill) => (
            <div key={bill.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-800/50 border border-slate-700/50">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-slate-200">{bill.description}</span>
                <span className="text-xs text-slate-400">Due: {new Date(bill.next_due_date).toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-US')}</span>
              </div>
              <span className="text-sm font-bold text-white">
                {formatCurrency(bill.amount, currency, locale)}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
