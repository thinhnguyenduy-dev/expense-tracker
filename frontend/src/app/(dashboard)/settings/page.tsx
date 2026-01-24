'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { 
  User, 
  Shield, 
  Trash2, 
  Loader2, 
  Check, 
  X,
  Eye,
  EyeOff,
  AlertTriangle
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useAuthStore } from '@/lib/stores/auth-store';
import { usersApi } from '@/lib/api';

// Schemas
const profileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type ProfileFormData = z.infer<typeof profileSchema>;
type PasswordFormData = z.infer<typeof passwordSchema>;

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

export default function SettingsPage() {
  const router = useRouter();
  const { user, updateUser, logout } = useAuthStore();
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);
  const [isDeleteLoading, setIsDeleteLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');

  // Profile form
  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name || '',
      email: user?.email || '',
    },
  });

  // Password form
  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
  });

  const newPassword = passwordForm.watch('newPassword') || '';
  const passwordStrength = getPasswordStrength(newPassword);
  const strengthColors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-emerald-500'];
  const strengthLabels = ['Weak', 'Fair', 'Good', 'Strong'];

  // Handle profile update
  const onProfileSubmit = async (data: ProfileFormData) => {
    setIsProfileLoading(true);
    try {
      await usersApi.updateProfile({ name: data.name, email: data.email });
      updateUser({ name: data.name, email: data.email });
      toast.success('Profile updated successfully');
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { detail?: string } } };
      toast.error(axiosError.response?.data?.detail || 'Failed to update profile');
    } finally {
      setIsProfileLoading(false);
    }
  };

  // Handle password change
  const onPasswordSubmit = async (data: PasswordFormData) => {
    setIsPasswordLoading(true);
    try {
      await usersApi.changePassword({
        current_password: data.currentPassword,
        new_password: data.newPassword,
      });
      toast.success('Password changed successfully');
      passwordForm.reset();
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { detail?: string } } };
      toast.error(axiosError.response?.data?.detail || 'Failed to change password');
    } finally {
      setIsPasswordLoading(false);
    }
  };

  // Handle account deletion
  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== 'DELETE') {
      toast.error('Please type DELETE to confirm');
      return;
    }

    setIsDeleteLoading(true);
    try {
      await usersApi.deleteAccount();
      toast.success('Account deleted successfully');
      logout();
      router.push('/login');
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { detail?: string } } };
      toast.error(axiosError.response?.data?.detail || 'Failed to delete account');
    } finally {
      setIsDeleteLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
          Settings
        </h1>
        <p className="text-slate-400 mt-1">Manage your account settings and preferences</p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="bg-slate-800/50 border border-slate-700 p-1">
          <TabsTrigger 
            value="profile" 
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500/20 data-[state=active]:to-teal-500/20 data-[state=active]:text-white gap-2"
          >
            <User className="h-4 w-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger 
            value="security"
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500/20 data-[state=active]:to-teal-500/20 data-[state=active]:text-white gap-2"
          >
            <Shield className="h-4 w-4" />
            Security
          </TabsTrigger>
          <TabsTrigger 
            value="account"
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-500/20 data-[state=active]:to-orange-500/20 data-[state=active]:text-white gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Account
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                  <User className="h-5 w-5 text-white" />
                </div>
                Profile Information
              </CardTitle>
              <CardDescription className="text-slate-400">
                Update your personal information
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  {/* Name field */}
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-slate-300">Name</Label>
                    <Input
                      id="name"
                      placeholder="Your name"
                      className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-emerald-500/50 focus:ring-emerald-500/20"
                      {...profileForm.register('name')}
                    />
                    {profileForm.formState.errors.name && (
                      <p className="text-sm text-red-400">{profileForm.formState.errors.name.message}</p>
                    )}
                  </div>

                  {/* Email field */}
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-slate-300">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-emerald-500/50 focus:ring-emerald-500/20"
                      {...profileForm.register('email')}
                    />
                    {profileForm.formState.errors.email && (
                      <p className="text-sm text-red-400">{profileForm.formState.errors.email.message}</p>
                    )}
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    type="submit"
                    disabled={isProfileLoading}
                    className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white"
                  >
                    {isProfileLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save Changes'
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                  <Shield className="h-5 w-5 text-white" />
                </div>
                Change Password
              </CardTitle>
              <CardDescription className="text-slate-400">
                Update your password to keep your account secure
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-6">
                {/* Current Password */}
                <div className="space-y-2">
                  <Label htmlFor="currentPassword" className="text-slate-300">Current Password</Label>
                  <div className="relative">
                    <Input
                      id="currentPassword"
                      type={showCurrentPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-emerald-500/50 focus:ring-emerald-500/20 pr-10"
                      {...passwordForm.register('currentPassword')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {passwordForm.formState.errors.currentPassword && (
                    <p className="text-sm text-red-400">{passwordForm.formState.errors.currentPassword.message}</p>
                  )}
                </div>

                {/* New Password */}
                <div className="space-y-2">
                  <Label htmlFor="newPassword" className="text-slate-300">New Password</Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={showNewPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-emerald-500/50 focus:ring-emerald-500/20 pr-10"
                      {...passwordForm.register('newPassword')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>

                  {/* Password strength indicator */}
                  {newPassword && (
                    <div className="space-y-2 animate-in slide-in-from-top-2">
                      <div className="flex gap-1">
                        {[0, 1, 2, 3].map((i) => (
                          <div
                            key={i}
                            className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                              i < passwordStrength.score ? strengthColors[passwordStrength.score - 1] : 'bg-slate-700'
                            }`}
                          />
                        ))}
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">
                          {passwordStrength.score > 0 && strengthLabels[passwordStrength.score - 1]}
                        </span>
                        <div className="flex gap-3 text-slate-500">
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

                  {passwordForm.formState.errors.newPassword && (
                    <p className="text-sm text-red-400">{passwordForm.formState.errors.newPassword.message}</p>
                  )}
                </div>

                {/* Confirm Password */}
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-slate-300">Confirm New Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-emerald-500/50 focus:ring-emerald-500/20"
                    {...passwordForm.register('confirmPassword')}
                  />
                  {passwordForm.formState.errors.confirmPassword && (
                    <p className="text-sm text-red-400">{passwordForm.formState.errors.confirmPassword.message}</p>
                  )}
                </div>

                <div className="flex justify-end">
                  <Button
                    type="submit"
                    disabled={isPasswordLoading}
                    className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white"
                  >
                    {isPasswordLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Changing...
                      </>
                    ) : (
                      'Change Password'
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Account Tab (Danger Zone) */}
        <TabsContent value="account">
          <Card className="bg-slate-800/50 border-red-900/50">
            <CardHeader>
              <CardTitle className="text-red-400 flex items-center gap-2">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 text-white" />
                </div>
                Danger Zone
              </CardTitle>
              <CardDescription className="text-slate-400">
                Irreversible and destructive actions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-4 rounded-xl border border-red-900/50 bg-red-950/20">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h3 className="font-medium text-white">Delete Account</h3>
                    <p className="text-sm text-slate-400">
                      Once you delete your account, there is no going back. All your data will be permanently removed.
                    </p>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" className="bg-red-500 hover:bg-red-600">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Account
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="bg-slate-900 border-slate-700">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-white flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5 text-red-500" />
                          Are you absolutely sure?
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-slate-400">
                          This action cannot be undone. This will permanently delete your account and remove all your data including:
                          <ul className="list-disc list-inside mt-2 space-y-1">
                            <li>All your expenses</li>
                            <li>All your categories</li>
                            <li>All recurring expenses</li>
                            <li>Your profile information</li>
                          </ul>
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <div className="py-4">
                        <Label className="text-slate-300">
                          Type <span className="font-mono text-red-400">DELETE</span> to confirm
                        </Label>
                        <Input
                          className="mt-2 bg-slate-800 border-slate-600 text-white"
                          value={deleteConfirmation}
                          onChange={(e) => setDeleteConfirmation(e.target.value)}
                          placeholder="DELETE"
                        />
                      </div>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="bg-slate-800 border-slate-600 text-white hover:bg-slate-700">
                          Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDeleteAccount}
                          disabled={deleteConfirmation !== 'DELETE' || isDeleteLoading}
                          className="bg-red-500 hover:bg-red-600 text-white"
                        >
                          {isDeleteLoading ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Deleting...
                            </>
                          ) : (
                            'Delete Account'
                          )}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
