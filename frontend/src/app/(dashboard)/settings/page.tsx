'use client';
 
import { useTranslations } from 'next-intl';
import { useTransition, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { setUserLocale } from '@/i18n/locale'; // We need this server action or API call logic

export default function SettingsPage() {
  const t = useTranslations('Settings');
  const { user, updateUser } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const handleLanguageChange = async (value: string) => {
    try {
      // 1. Update user profile in DB
      await usersApi.updateProfile({ language: value });
      updateUser({ language: value });

      // 2. Set cookie/locale via server action or simply refresh if middleware handles it based on user preference? 
      // Since we use next-intl, we usually change the route prefix or set a cookie.
      // If we are strictly using the DB preference, we need a way to tell next-intl's `getRequestConfig` to reload.
      // Easiest is to use the cookie approach that next-intl documentation suggests, OR just reloading page.
      // But `request.ts` reads from where? If it reads from hardcoded 'vi', we have a problem.
      
      // We need to update `request.ts` to read from a cookie or use `setUserLocale` (server action).
      // Let's assume we implement `setUserLocale`.
      
      await setUserLocale(value);
      
      toast.success(t('save'));
    } catch (error) {
      console.error(error);
      toast.error(t('failedUpdate'));
    }
  };

  return (
    <div className="p-6 space-y-6">
       <h1 className="text-3xl font-bold tracking-tight text-white">{t('title')}</h1>
       
       <Card className="bg-slate-800/50 border-slate-700">
         <CardHeader>
           <CardTitle className="text-white">{t('language')}</CardTitle>
           <CardDescription className="text-slate-400">{t('selectLanguage')}</CardDescription>
         </CardHeader>
         <CardContent>
           <div className="grid w-full max-w-sm items-center gap-1.5">
             <Label htmlFor="language" className="text-slate-200">{t('language')}</Label>
             <Select 
                disabled={isPending} 
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
         </CardContent>
       </Card>
    </div>
  );
}
