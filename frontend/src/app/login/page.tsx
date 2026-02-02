'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Wallet, Loader2, Eye, EyeOff, ArrowRight, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthStore } from '@/lib/stores/auth-store';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const { login } = useAuthStore();

  useEffect(() => {
    setMounted(true);
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      await login(data.email, data.password);
      toast.success('Login successful!');
      router.push('/dashboard');
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { detail?: string } } };
      toast.error(axiosError.response?.data?.detail || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-background">
      {/* Animated gradient background */}
      <div className="fixed inset-0 bg-gradient-to-br from-background via-muted to-background dark:from-slate-950 dark:via-slate-900 dark:to-slate-950" />
      
      {/* Floating orbs for depth */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-emerald-500/10 dark:bg-emerald-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-teal-500/10 dark:bg-teal-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-600/5 dark:bg-emerald-600/10 rounded-full blur-3xl animate-pulse delay-500" />
      </div>

      {/* Subtle grid pattern */}
      <div 
        className="fixed inset-0 opacity-[0.02] dark:opacity-[0.02]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
          backgroundSize: '40px 40px'
        }}
      />

      {/* Main card */}
      <Card 
        className={`
          w-full max-w-md relative z-10
          border border-border
          shadow-2xl shadow-emerald-500/5
          bg-card/80 dark:bg-gradient-to-br dark:from-white/[0.08] dark:to-white/[0.02]
          backdrop-blur-xl
          transition-all duration-700 ease-out
          ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}
        `}
      >
        {/* Subtle top glow line */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent" />
        
        <CardHeader className="space-y-4 text-center pb-2">
          {/* Animated logo */}
          <div 
            className={`
              mx-auto flex h-20 w-20 items-center justify-center 
              rounded-2xl rotate-3
              bg-gradient-to-br from-emerald-500 to-teal-600 
              shadow-lg shadow-emerald-500/30
              transition-all duration-700 delay-100
              hover:rotate-6 hover:scale-105
              group cursor-default
              ${mounted ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}
            `}
          >
            <Wallet className="h-10 w-10 text-white drop-shadow-lg group-hover:scale-110 transition-transform" />
          </div>
          
          <div className={`space-y-2 transition-all duration-700 delay-200 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <CardTitle className="text-3xl font-bold text-foreground dark:bg-gradient-to-r dark:from-white dark:via-white dark:to-emerald-200 dark:bg-clip-text dark:text-transparent">
              Welcome Back
            </CardTitle>
            <CardDescription className="text-muted-foreground flex items-center justify-center gap-2">
              <Sparkles className="h-4 w-4 text-emerald-500" />
              Sign in to manage your expenses
            </CardDescription>
          </div>
        </CardHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className={`space-y-5 pt-4 transition-all duration-700 delay-300 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            {/* Email field */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-foreground">
                Email
              </Label>
              <div className="relative group">
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  className="
                    h-12 px-4
                    bg-muted/50 dark:bg-white/5
                    border border-border dark:border-white/10
                    text-foreground placeholder:text-muted-foreground
                    rounded-xl
                    transition-all duration-300
                    focus:bg-muted dark:focus:bg-white/10 focus:border-emerald-500/50
                    focus:ring-2 focus:ring-emerald-500/20
                    hover:border-emerald-500/30
                  "
                  {...register('email')}
                />
                {/* Focus glow */}
                <div className="absolute inset-0 rounded-xl bg-emerald-500/10 opacity-0 group-focus-within:opacity-100 transition-opacity -z-10 blur-xl" />
              </div>
              {errors.email && (
                <p className="text-sm text-red-500 flex items-center gap-1 animate-in slide-in-from-top-1">
                  <span className="inline-block w-1 h-1 rounded-full bg-red-500" />
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Password field */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-foreground">
                Password
              </Label>
              <div className="relative group">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="
                    h-12 px-4 pr-12
                    bg-muted/50 dark:bg-white/5
                    border border-border dark:border-white/10
                    text-foreground placeholder:text-muted-foreground
                    rounded-xl
                    transition-all duration-300
                    focus:bg-muted dark:focus:bg-white/10 focus:border-emerald-500/50
                    focus:ring-2 focus:ring-emerald-500/20
                    hover:border-emerald-500/30
                  "
                  {...register('password')}
                />
                {/* Password visibility toggle */}
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="
                    absolute right-3 top-1/2 -translate-y-1/2
                    p-1.5 rounded-lg
                    text-muted-foreground hover:text-foreground
                    hover:bg-muted
                    transition-all duration-200
                  "
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
                {/* Focus glow */}
                <div className="absolute inset-0 rounded-xl bg-emerald-500/10 opacity-0 group-focus-within:opacity-100 transition-opacity -z-10 blur-xl" />
              </div>
              {errors.password && (
                <p className="text-sm text-red-500 flex items-center gap-1 animate-in slide-in-from-top-1">
                  <span className="inline-block w-1 h-1 rounded-full bg-red-500" />
                  {errors.password.message}
                </p>
              )}
            </div>
          </CardContent>

          <CardFooter className={`flex flex-col gap-4 pt-6 transition-all duration-700 delay-400 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            {/* Submit button */}
            <Button
              type="submit"
              className="
                w-full h-12
                bg-gradient-to-r from-emerald-500 to-teal-500 
                hover:from-emerald-400 hover:to-teal-400
                text-white font-semibold
                rounded-xl
                shadow-lg shadow-emerald-500/25
                hover:shadow-xl hover:shadow-emerald-500/30
                hover:-translate-y-0.5
                active:translate-y-0
                transition-all duration-300
                relative overflow-hidden
                group
              "
              disabled={isLoading}
            >
              {/* Button shine effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Signing in...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Sign In
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </span>
              )}
            </Button>

            {/* Sign up link */}
            <p className="text-sm text-center text-muted-foreground">
              Don&apos;t have an account?{' '}
              <Link 
                href="/register" 
                className="
                  text-emerald-500 hover:text-emerald-400 
                  font-medium
                  underline-offset-4 hover:underline
                  transition-colors
                "
              >
                Sign up
              </Link>
            </p>
          </CardFooter>
        </form>

        {/* Bottom glow line */}
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-teal-400/30 to-transparent" />
      </Card>
    </div>
  );
}
