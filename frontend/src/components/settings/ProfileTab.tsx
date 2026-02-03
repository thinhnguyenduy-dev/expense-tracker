'use client';

import { useTranslations } from 'next-intl';
import { useState, useRef, useCallback } from 'react';
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
  const isSubmittingRef = useRef(false);

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name || '',
      email: user?.email || '',
    },
  });

  const onSubmit = useCallback(async (data: z.infer<typeof profileSchema>) => {
    if (isSubmittingRef.current || loading) return;
    isSubmittingRef.current = true;
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
      isSubmittingRef.current = false;
    }
  }, [updateUser, t, loading]);

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-foreground">{t('profile')}</CardTitle>
        <CardDescription className="text-muted-foreground">Manage your public profile information</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <fieldset disabled={loading} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-foreground">{t('name')}</Label>
            <Input
                id="name"
                {...register('name')}
                className="bg-muted border-border text-foreground" 
            />
            {errors.name && <p className="text-red-500 text-sm">{errors.name.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email" className="text-foreground">{t('email')}</Label>
            <Input 
                id="email" 
                {...register('email')} 
                className="bg-muted border-border text-foreground"
            />
             {errors.email && <p className="text-red-500 text-sm">{errors.email.message}</p>}
          </div>
          </fieldset>
          <Button type="submit" disabled={loading} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('save')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
