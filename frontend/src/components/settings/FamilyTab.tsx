import { useEffect, useState, useRef, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/utils';
import { Users, Copy, Loader2, UserPlus } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { familiesApi, Family } from '@/lib/api';

const createFamilySchema = z.object({
  name: z.string().min(1, 'Family name is required'),
});

const joinFamilySchema = z.object({
  invite_code: z.string().min(1, 'Invite code is required'),
});

type CreateFamilyFormData = z.infer<typeof createFamilySchema>;
type JoinFamilyFormData = z.infer<typeof joinFamilySchema>;

export function FamilyTab() {
  const [family, setFamily] = useState<Family | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isJoinDialogOpen, setIsJoinDialogOpen] = useState(false);
  const isSubmittingRef = useRef(false);
  const t = useTranslations('Settings');

  const {
    register: registerCreate,
    handleSubmit: handleSubmitCreate,
    formState: { errors: errorsCreate, isSubmitting: isSubmittingCreate },
    reset: resetCreate,
  } = useForm<CreateFamilyFormData>({
    resolver: zodResolver(createFamilySchema),
  });

  const {
    register: registerJoin,
    handleSubmit: handleSubmitJoin,
    formState: { errors: errorsJoin, isSubmitting: isSubmittingJoin },
    reset: resetJoin,
  } = useForm<JoinFamilyFormData>({
    resolver: zodResolver(joinFamilySchema),
  });

  const fetchFamily = async () => {
    try {
      const { data } = await familiesApi.getMyFamily();
      setFamily(data);
    } catch (error: any) {
      if (error.response?.status !== 404) {
        toast.error('Failed to load family info');
      }
      setFamily(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFamily();
  }, []);

  const onCreateFamily = useCallback(async (data: CreateFamilyFormData) => {
    if (isSubmittingRef.current || isSubmittingCreate) return;
    isSubmittingRef.current = true;
    try {
      await familiesApi.create(data.name);
      toast.success('Family created successfully!');
      setIsCreateDialogOpen(false);
      resetCreate();
      setTimeout(() => fetchFamily(), 100);
    } catch (error: any) {
      toast.error(getApiErrorMessage(error, 'Failed to create family'));
    } finally {
      isSubmittingRef.current = false;
    }
  }, [isSubmittingCreate, resetCreate]);

  const onJoinFamily = useCallback(async (data: JoinFamilyFormData) => {
    if (isSubmittingRef.current || isSubmittingJoin) return;
    isSubmittingRef.current = true;
    try {
      await familiesApi.join(data.invite_code);
      toast.success('Joined family successfully!');
      setIsJoinDialogOpen(false);
      resetJoin();
      setTimeout(() => fetchFamily(), 100);
    } catch (error: any) {
      toast.error(getApiErrorMessage(error, 'Failed to join family'));
    } finally {
      isSubmittingRef.current = false;
    }
  }, [isSubmittingJoin, resetJoin]);

  const copyInviteCode = () => {
    if (family?.invite_code) {
      navigator.clipboard.writeText(family.invite_code);
      toast.success('Invite code copied to clipboard');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (family) {
    return (
      <div className="space-y-6">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Users className="h-5 w-5 text-emerald-500" />
              {family.name}
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Manage your family settings and members.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted border border-border">
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs uppercase tracking-wider">Invite Code</Label>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-mono text-emerald-500 font-bold tracking-widest">
                    {family.invite_code}
                  </span>
                  <Button variant="ghost" size="icon" onClick={copyInviteCode} className="h-8 w-8 text-muted-foreground hover:text-foreground">
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Share this code to invite members.</p>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-medium text-foreground">Members ({family.members?.length || 0})</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {family.members?.map((member) => (
                  <div key={member.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border">
                    <div className="h-10 w-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500 font-medium">
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-foreground font-medium">{member.name}</p>
                      <p className="text-sm text-muted-foreground">{member.email}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Family Sharing</CardTitle>
          <CardDescription className="text-muted-foreground">
            Create or join a family to share expenses and budgets.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Create Family */}
            <div className="p-6 rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 flex flex-col items-center text-center space-y-4">
              <div className="h-12 w-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <Users className="h-6 w-6 text-emerald-500" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">Create a Family</h3>
                <p className="text-sm text-muted-foreground mt-1">Start a new family group and invite others.</p>
              </div>
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                    Create Family
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-card border-border">
                  <DialogHeader>
                    <DialogTitle className="text-foreground">Create Family</DialogTitle>
                    <DialogDescription className="text-muted-foreground">
                      Give your family group a name.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSubmitCreate(onCreateFamily)}>
                    <fieldset disabled={isSubmittingCreate} className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label className="text-foreground">Family Name</Label>
                        <Input
                          placeholder="e.g. The Smiths"
                          className="bg-muted border-border text-foreground"
                          {...registerCreate('name')}
                        />
                        {errorsCreate.name && (
                          <p className="text-sm text-red-500">{errorsCreate.name.message}</p>
                        )}
                      </div>
                    </fieldset>
                    <DialogFooter>
                      <Button
                        type="submit"
                        disabled={isSubmittingCreate}
                        className="bg-emerald-600 hover:bg-emerald-700"
                      >
                        {isSubmittingCreate ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create'}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {/* Join Family */}
            <div className="p-6 rounded-xl bg-muted/30 border border-border flex flex-col items-center text-center space-y-4">
              <div className="h-12 w-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                <UserPlus className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">Join a Family</h3>
                <p className="text-sm text-muted-foreground mt-1">Enter an invite code to join an existing group.</p>
              </div>
              <Dialog open={isJoinDialogOpen} onOpenChange={setIsJoinDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full border-border text-foreground hover:bg-muted">
                    Join with Code
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-card border-border">
                  <DialogHeader>
                    <DialogTitle className="text-foreground">Join Family</DialogTitle>
                    <DialogDescription className="text-muted-foreground">
                      Enter the 6-character invite code.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSubmitJoin(onJoinFamily)}>
                    <fieldset disabled={isSubmittingJoin} className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label className="text-foreground">Invite Code</Label>
                        <Input
                          placeholder="e.g. A1B2C3"
                          className="bg-muted border-border text-foreground uppercase"
                          maxLength={6}
                          {...registerJoin('invite_code')}
                        />
                        {errorsJoin.invite_code && (
                          <p className="text-sm text-red-500">{errorsJoin.invite_code.message}</p>
                        )}
                      </div>
                    </fieldset>
                    <DialogFooter>
                      <Button
                        type="submit"
                        disabled={isSubmittingJoin}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        {isSubmittingJoin ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Join'}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
