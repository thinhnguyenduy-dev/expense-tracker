import { Input } from "@/components/ui/input";
import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useAuthStore } from '@/lib/stores/auth-store';
import { usersApi } from '@/lib/api';
import { setUserLocale } from '@/i18n/locale';
import { Label } from "@/components/ui/label";
import { useTheme } from 'next-themes';
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
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [monthlyLimit, setMonthlyLimit] = useState(user?.overall_monthly_limit?.toString() || '');
  const [isUpdatingLimit, setIsUpdatingLimit] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-foreground">{t('preferences')}</CardTitle>
        <CardDescription className="text-muted-foreground">Manage your language and display preferences</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
           {/* Theme selector */}
           <div className="grid w-full max-w-sm items-center gap-1.5">
             <Label htmlFor="theme" className="text-foreground">{t('theme')}</Label>
             {mounted && (
               <Select value={theme} onValueChange={setTheme}>
                 <SelectTrigger id="theme" className="bg-muted border-border text-foreground">
                   <SelectValue placeholder={t('theme')} />
                 </SelectTrigger>
                 <SelectContent className="bg-card border-border">
                   <SelectItem value="light" className="text-foreground hover:bg-muted">{t('themeLight')}</SelectItem>
                   <SelectItem value="dark" className="text-foreground hover:bg-muted">{t('themeDark')}</SelectItem>
                   <SelectItem value="system" className="text-foreground hover:bg-muted">{t('themeSystem')}</SelectItem>
                 </SelectContent>
               </Select>
             )}
           </div>

           <div className="grid w-full max-w-sm items-center gap-1.5">
             <Label htmlFor="language" className="text-foreground">{t('language')}</Label>
             <Select 
                defaultValue={user?.language || 'vi'} 
                onValueChange={handleLanguageChange}
             >
               <SelectTrigger id="language" className="bg-muted border-border text-foreground">
                 <SelectValue placeholder={t('selectLanguage')} />
               </SelectTrigger>
               <SelectContent className="bg-card border-border">
                 <SelectItem value="vi" className="text-foreground hover:bg-muted">Tiếng Việt</SelectItem>
                 <SelectItem value="en" className="text-foreground hover:bg-muted">English</SelectItem>
               </SelectContent>
             </Select>
           </div>

           <div className="grid w-full max-w-sm items-center gap-1.5">
             <Label htmlFor="currency" className="text-foreground">Currency</Label>
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
               <SelectTrigger id="currency" className="bg-muted border-border text-foreground">
                 <SelectValue placeholder="Select Currency" />
               </SelectTrigger>
               <SelectContent className="bg-card border-border">
                 <SelectItem value="VND" className="text-foreground hover:bg-muted">VND (₫)</SelectItem>
                 <SelectItem value="USD" className="text-foreground hover:bg-muted">USD ($)</SelectItem>
               </SelectContent>
             </Select>
           </div>

           <div className="grid w-full max-w-sm items-center gap-1.5">
             <Label htmlFor="monthlyLimit" className="text-foreground">Global Monthly Budget</Label>
             <Input
                id="monthlyLimit"
                type="number"
                placeholder="e.g. 5000"
                className="bg-muted border-border text-foreground"
                value={monthlyLimit}
                onChange={(e) => setMonthlyLimit(e.target.value)}
                onBlur={handleLimitBlur}
                disabled={isUpdatingLimit}
             />
             <p className="text-xs text-muted-foreground">
               Set a global monthly spending limit to receive alerts when you exceed 80%.
             </p>
           </div>
        </div>
      </CardContent>
    </Card>
  );
}
