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
import { usersApi } from '@/lib/api';

const passwordSchema = z.object({
  current_password: z.string().min(1, 'Current password is required'),
  new_password: z.string().min(6, 'Password must be at least 6 characters'),
  confirm_password: z.string().min(1, 'Please confirm your password'),
}).refine((data) => data.new_password === data.confirm_password, {
  message: "Passwords don't match",
  path: ["confirm_password"],
});

export function SecurityTab() {
  const t = useTranslations('Settings');
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
        current_password: '',
        new_password: '',
        confirm_password: ''
    }
  });

  const onSubmit = async (data: z.infer<typeof passwordSchema>) => {
    setLoading(true);
    try {
      await usersApi.changePassword({
        current_password: data.current_password,
        new_password: data.new_password,
      });
      toast.success(t('successPassword'));
      reset();
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { detail?: string } } };
      toast.error(axiosError.response?.data?.detail || t('failedUpdate'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-foreground">{t('security')}</CardTitle>
        <CardDescription className="text-muted-foreground">Update your password</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
           <div className="space-y-2">
            <Label htmlFor="current" className="text-foreground">{t('currentPassword')}</Label>
            <Input 
                id="current" 
                type="password"
                {...register('current_password')}
                className="bg-muted border-border text-foreground" 
            />
            {errors.current_password && <p className="text-red-500 text-sm">{errors.current_password.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="new" className="text-foreground">{t('newPassword')}</Label>
            <Input 
                id="new" 
                type="password"
                {...register('new_password')} 
                className="bg-muted border-border text-foreground"
            />
             {errors.new_password && <p className="text-red-500 text-sm">{errors.new_password.message}</p>}
          </div>
           <div className="space-y-2">
            <Label htmlFor="confirm" className="text-foreground">{t('confirmPassword')}</Label>
            <Input 
                id="confirm" 
                type="password"
                {...register('confirm_password')} 
                className="bg-muted border-border text-foreground"
            />
             {errors.confirm_password && <p className="text-red-500 text-sm">{errors.confirm_password.message}</p>}
          </div>
          <Button type="submit" disabled={loading} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('changePassword')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
