'use client';

import { useTranslations } from 'next-intl';
import { useAuthStore } from '@/lib/stores/auth-store';
import { usersApi } from '@/lib/api';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { setUserLocale } from '@/i18n/locale';

export function PreferencesTab() {
  const t = useTranslations('Settings');
  const { user, updateUser } = useAuthStore();

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

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader>
        <CardTitle className="text-white">{t('preferences')}</CardTitle>
        <CardDescription className="text-slate-400">Manage your language and display preferences</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
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
        </div>
      </CardContent>
    </Card>
  );
}
