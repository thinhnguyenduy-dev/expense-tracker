import { Input } from "@/components/ui/input";
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useAuthStore } from '@/lib/stores/auth-store';
import { usersApi } from '@/lib/api';
import { setUserLocale } from '@/i18n/locale';
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function PreferencesTab() {
  const t = useTranslations('Settings');
  const { user, updateUser } = useAuthStore();
  const [monthlyLimit, setMonthlyLimit] = useState(user?.overall_monthly_limit?.toString() || '');
  const [isUpdatingLimit, setIsUpdatingLimit] = useState(false);

  const handleLanguageChange = async (value: string) => {
    try {
      await usersApi.updateProfile({ language: value });
      updateUser({ language: value });
      await setUserLocale(value);
      toast.success(t('save'));
    } catch (error) {
      console.error(error);
      toast.error(t('failedUpdate'));
    }
  };

  const handleLimitBlur = async () => {
    if (monthlyLimit === user?.overall_monthly_limit?.toString()) return;
    
    setIsUpdatingLimit(true);
    try {
      const limitValue = monthlyLimit ? parseFloat(monthlyLimit) : null;
      await usersApi.updateProfile({ overall_monthly_limit: limitValue });
      updateUser({ overall_monthly_limit: limitValue });
      toast.success(t('save'));
    } catch (error) {
       console.error(error);
       toast.error(t('failedUpdate'));
    } finally {
      setIsUpdatingLimit(false);
    }
  };

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader>
        <CardTitle className="text-white">{t('preferences')}</CardTitle>
        <CardDescription className="text-slate-400">Manage your language and display preferences</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
           <div className="grid w-full max-w-sm items-center gap-1.5">
             <Label htmlFor="language" className="text-slate-200">{t('language')}</Label>
             <Select 
                defaultValue={user?.language || 'vi'} 
                onValueChange={handleLanguageChange}
             >
               <SelectTrigger id="language" className="bg-slate-800 border-slate-700 text-white">
                 <SelectValue placeholder={t('selectLanguage')} />
               </SelectTrigger>
               <SelectContent className="bg-slate-800 border-slate-700">
                 <SelectItem value="vi" className="text-white hover:bg-slate-700">Tiếng Việt</SelectItem>
                 <SelectItem value="en" className="text-white hover:bg-slate-700">English</SelectItem>
               </SelectContent>
             </Select>
           </div>

           <div className="grid w-full max-w-sm items-center gap-1.5">
             <Label htmlFor="currency" className="text-slate-200">Currency</Label>
             <Select 
                defaultValue={user?.currency || 'VND'} 
                onValueChange={async (value) => {
                  try {
                    await usersApi.updateProfile({ currency: value });
                    updateUser({ currency: value });
                    toast.success(t('save'));
                  } catch (error) {
                    console.error(error);
                    toast.error(t('failedUpdate'));
                  }
                }}
             >
               <SelectTrigger id="currency" className="bg-slate-800 border-slate-700 text-white">
                 <SelectValue placeholder="Select Currency" />
               </SelectTrigger>
               <SelectContent className="bg-slate-800 border-slate-700">
                 <SelectItem value="VND" className="text-white hover:bg-slate-700">VND (₫)</SelectItem>
                 <SelectItem value="USD" className="text-white hover:bg-slate-700">USD ($)</SelectItem>
               </SelectContent>
             </Select>
           </div>

           <div className="grid w-full max-w-sm items-center gap-1.5">
             <Label htmlFor="monthlyLimit" className="text-slate-200">Global Monthly Budget</Label>
             <Input
                id="monthlyLimit"
                type="number"
                placeholder="e.g. 5000"
                className="bg-slate-800 border-slate-700 text-white"
                value={monthlyLimit}
                onChange={(e) => setMonthlyLimit(e.target.value)}
                onBlur={handleLimitBlur}
                disabled={isUpdatingLimit}
             />
             <p className="text-xs text-slate-400">
               Set a global monthly spending limit to receive alerts when you exceed 80%.
             </p>
           </div>
        </div>
      </CardContent>
    </Card>
  );
}
