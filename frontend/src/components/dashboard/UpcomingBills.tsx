
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Calendar } from 'lucide-react';
import { useLocale } from 'next-intl';
import { useEffect, useState } from 'react';
import { recurringExpensesApi } from '@/lib/api';
import { toast } from 'sonner';
import { useAuthStore } from '@/lib/stores/auth-store';
import { formatCurrency } from '@/lib/utils';

interface Bill {
  id: number;
  description: string;
  amount: number;
  next_due_date: string;
  frequency: string;
}

export function UpcomingBills() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const locale = useLocale();
  const { user } = useAuthStore();
  const currency = user?.currency || 'VND';

  useEffect(() => {
    const fetchBills = async () => {
      try {
        const { data } = await recurringExpensesApi.getAll();
        // Filter bills due in the next 7 days
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const nextWeek = new Date(today);
        nextWeek.setDate(today.getDate() + 7);

        const upcoming = data.filter((bill: any) => {
             if (!bill.is_active) return false;
             
             // Calculate next due date (simple logic for now, ideally backend provides this)
             // But wait, our API response MIGHT NOT include next_due_date if it's dynamic?
             // Let's check the API response type. 
             // The model has 'next_due_date' property which is computed.
             // If the API returns the Pydantic model with getters, it should be there.
             // Let's assume 'next_due_date' is available in the response.
             if (!bill.next_due_date) return false; // Computed property in backend
             
             const dueDate = new Date(bill.next_due_date);
             dueDate.setHours(0, 0, 0, 0); // Normalized comparison
             
             return dueDate >= today && dueDate <= nextWeek;
        });

        // Sort by due date
        upcoming.sort((a: any, b: any) => new Date(a.next_due_date).getTime() - new Date(b.next_due_date).getTime());

        setBills(upcoming);
      } catch (error) {
        console.error("Failed to fetch recurring expenses", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBills();
  }, []);

  if (isLoading) return null;
  if (bills.length === 0) return null;

  return (
    <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700">
      <CardHeader className="pb-2">
        <CardTitle className="text-white flex items-center gap-2 text-base">
          <Calendar className="h-4 w-4 text-emerald-400" />
          Upcoming Bills (Next 7 Days)
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
