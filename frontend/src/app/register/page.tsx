'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Wallet, Loader2, Eye, EyeOff, ArrowRight, Sparkles, Check, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthStore } from '@/lib/stores/auth-store';

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type RegisterFormData = z.infer<typeof registerSchema>;

// Password strength checker
const getPasswordStrength = (password: string) => {
  const checks = {
    length: password.length >= 6,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
  };
  const score = Object.values(checks).filter(Boolean).length;
  return { checks, score };
};

export default function RegisterPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const { register: registerUser, login } = useAuthStore();

  useEffect(() => {
    setMounted(true);
  }, []);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  const password = watch('password') || '';
  const passwordStrength = getPasswordStrength(password);

  const onSubmit = async (data: RegisterFormData) => {
    setIsLoading(true);
    try {
      await registerUser(data.email, data.password, data.name);
      toast.success('Registration successful! Logging in...');
      await login(data.email, data.password);
      router.push('/dashboard');
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { detail?: string } } };
      toast.error(axiosError.response?.data?.detail || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  const strengthColors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-emerald-500'];
  const strengthLabels = ['Weak', 'Fair', 'Good', 'Strong'];

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated gradient background */}
      <div className="fixed inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />
      
      {/* Floating orbs for depth */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-teal-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-teal-600/10 rounded-full blur-3xl animate-pulse delay-500" />
      </div>

      {/* Subtle grid pattern */}
      <div 
        className="fixed inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
          backgroundSize: '40px 40px'
        }}
      />

      {/* Main card */}
      <Card 
        className={`
          w-full max-w-md relative z-10
          border border-white/10 
          shadow-2xl shadow-teal-500/5
          bg-gradient-to-br from-white/[0.08] to-white/[0.02]
          backdrop-blur-xl
          transition-all duration-700 ease-out
          ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}
        `}
      >
        {/* Subtle top glow line */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-teal-400/50 to-transparent" />
        
        <CardHeader className="space-y-4 text-center pb-2">
          {/* Animated logo */}
          <div 
            className={`
              mx-auto flex h-20 w-20 items-center justify-center 
              rounded-2xl -rotate-3
              bg-gradient-to-br from-teal-500 to-emerald-600 
              shadow-lg shadow-teal-500/30
              transition-all duration-700 delay-100
              hover:-rotate-6 hover:scale-105
              group cursor-default
              ${mounted ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}
            `}
          >
            <Wallet className="h-10 w-10 text-white drop-shadow-lg group-hover:scale-110 transition-transform" />
          </div>
          
          <div className={`space-y-2 transition-all duration-700 delay-200 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-white via-white to-teal-200 bg-clip-text text-transparent">
              Create Account
            </CardTitle>
            <CardDescription className="text-slate-400 flex items-center justify-center gap-2">
              <Sparkles className="h-4 w-4 text-teal-400" />
              Start tracking your expenses today
            </CardDescription>
          </div>
        </CardHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className={`space-y-4 pt-4 transition-all duration-700 delay-300 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            {/* Name field */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium text-slate-300">
                Name
              </Label>
              <div className="relative group">
                <Input
                  id="name"
                  type="text"
                  placeholder="John Doe"
                  className="
                    h-12 px-4
                    bg-white/5 
                    border border-white/10 
                    text-white placeholder:text-slate-400
                    rounded-xl
                    transition-all duration-300
                    focus:bg-white/10 focus:border-teal-500/50
                    focus:ring-2 focus:ring-teal-500/20
                    hover:border-white/20
                  "
                  {...register('name')}
                />
                <div className="absolute inset-0 rounded-xl bg-teal-500/10 opacity-0 group-focus-within:opacity-100 transition-opacity -z-10 blur-xl" />
              </div>
              {errors.name && (
                <p className="text-sm text-red-400 flex items-center gap-1 animate-in slide-in-from-top-1">
                  <span className="inline-block w-1 h-1 rounded-full bg-red-400" />
                  {errors.name.message}
                </p>
              )}
            </div>

            {/* Email field */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-slate-300">
                Email
              </Label>
              <div className="relative group">
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  className="
                    h-12 px-4
                    bg-white/5 
                    border border-white/10 
                    text-white placeholder:text-slate-400
                    rounded-xl
                    transition-all duration-300
                    focus:bg-white/10 focus:border-teal-500/50
                    focus:ring-2 focus:ring-teal-500/20
                    hover:border-white/20
                  "
                  {...register('email')}
                />
                <div className="absolute inset-0 rounded-xl bg-teal-500/10 opacity-0 group-focus-within:opacity-100 transition-opacity -z-10 blur-xl" />
              </div>
              {errors.email && (
                <p className="text-sm text-red-400 flex items-center gap-1 animate-in slide-in-from-top-1">
                  <span className="inline-block w-1 h-1 rounded-full bg-red-400" />
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Password field */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-slate-300">
                Password
              </Label>
              <div className="relative group">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="
                    h-12 px-4 pr-12
                    bg-white/5 
                    border border-white/10 
                    text-white placeholder:text-slate-400
                    rounded-xl
                    transition-all duration-300
                    focus:bg-white/10 focus:border-teal-500/50
                    focus:ring-2 focus:ring-teal-500/20
                    hover:border-white/20
                  "
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="
                    absolute right-3 top-1/2 -translate-y-1/2
                    p-1.5 rounded-lg
                    text-slate-400 hover:text-white
                    hover:bg-white/10
                    transition-all duration-200
                  "
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
                <div className="absolute inset-0 rounded-xl bg-teal-500/10 opacity-0 group-focus-within:opacity-100 transition-opacity -z-10 blur-xl" />
              </div>
              
              {/* Password strength indicator */}
              {password && (
                <div className="space-y-2 animate-in slide-in-from-top-2">
                  <div className="flex gap-1">
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                          i < passwordStrength.score ? strengthColors[passwordStrength.score - 1] : 'bg-white/10'
                        }`}
                      />
                    ))}
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">
                      {passwordStrength.score > 0 && strengthLabels[passwordStrength.score - 1]}
                    </span>
                    <div className="flex gap-2 text-slate-500">
                      <span className={`flex items-center gap-1 ${passwordStrength.checks.length ? 'text-emerald-400' : ''}`}>
                        {passwordStrength.checks.length ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                        6+ chars
                      </span>
                      <span className={`flex items-center gap-1 ${passwordStrength.checks.uppercase ? 'text-emerald-400' : ''}`}>
                        {passwordStrength.checks.uppercase ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                        A-Z
                      </span>
                      <span className={`flex items-center gap-1 ${passwordStrength.checks.number ? 'text-emerald-400' : ''}`}>
                        {passwordStrength.checks.number ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                        0-9
                      </span>
                    </div>
                  </div>
                </div>
              )}
              
              {errors.password && (
                <p className="text-sm text-red-400 flex items-center gap-1 animate-in slide-in-from-top-1">
                  <span className="inline-block w-1 h-1 rounded-full bg-red-400" />
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Confirm Password field */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm font-medium text-slate-300">
                Confirm Password
              </Label>
              <div className="relative group">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="
                    h-12 px-4 pr-12
                    bg-white/5 
                    border border-white/10 
                    text-white placeholder:text-slate-400
                    rounded-xl
                    transition-all duration-300
                    focus:bg-white/10 focus:border-teal-500/50
                    focus:ring-2 focus:ring-teal-500/20
                    hover:border-white/20
                  "
                  {...register('confirmPassword')}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="
                    absolute right-3 top-1/2 -translate-y-1/2
                    p-1.5 rounded-lg
                    text-slate-400 hover:text-white
                    hover:bg-white/10
                    transition-all duration-200
                  "
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
                <div className="absolute inset-0 rounded-xl bg-teal-500/10 opacity-0 group-focus-within:opacity-100 transition-opacity -z-10 blur-xl" />
              </div>
              {errors.confirmPassword && (
                <p className="text-sm text-red-400 flex items-center gap-1 animate-in slide-in-from-top-1">
                  <span className="inline-block w-1 h-1 rounded-full bg-red-400" />
                  {errors.confirmPassword.message}
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
                bg-gradient-to-r from-teal-500 to-emerald-500 
                hover:from-teal-400 hover:to-emerald-400
                text-white font-semibold
                rounded-xl
                shadow-lg shadow-teal-500/25
                hover:shadow-xl hover:shadow-teal-500/30
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
                  Creating account...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Create Account
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </span>
              )}
            </Button>

            {/* Sign in link */}
            <p className="text-sm text-center text-slate-400">
              Already have an account?{' '}
              <Link 
                href="/login" 
                className="
                  text-teal-400 hover:text-teal-300 
                  font-medium
                  underline-offset-4 hover:underline
                  transition-colors
                "
              >
                Sign in
              </Link>
            </p>
          </CardFooter>
        </form>

        {/* Bottom glow line */}
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent" />
      </Card>
    </div>
  );
}
