'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthStore } from '@/lib/stores/auth-store';
import { usersApi } from '@/lib/api';

const profileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
});

export function ProfileTab() {
  const t = useTranslations('Settings');
  const { user, updateUser } = useAuthStore();
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name || '',
      email: user?.email || '',
    },
  });

  const onSubmit = async (data: z.infer<typeof profileSchema>) => {
    setLoading(true);
    try {
      await usersApi.updateProfile(data);
      updateUser(data);
      toast.success(t('successProfile'));
    } catch (error) {
      toast.error(t('failedUpdate'));
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader>
        <CardTitle className="text-white">{t('profile')}</CardTitle>
        <CardDescription className="text-slate-400">Manage your public profile information</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-slate-200">{t('name')}</Label>
            <Input
                id="name"
                {...register('name')}
                className="bg-slate-800 border-slate-700 text-white" 
            />
            {errors.name && <p className="text-red-400 text-sm">{errors.name.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email" className="text-slate-200">{t('email')}</Label>
            <Input 
                id="email" 
                {...register('email')} 
                className="bg-slate-800 border-slate-700 text-white"
            />
             {errors.email && <p className="text-red-400 text-sm">{errors.email.message}</p>}
          </div>
          <Button type="submit" disabled={loading} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('save')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
