'use client';

import { useTranslations } from 'next-intl';
import { useRef, useState, useCallback } from 'react';
import { Download, Trash2, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { usersApi } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/utils';
import { useAuthStore } from '@/lib/stores/auth-store';
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
} from "@/components/ui/alert-dialog";


import { Progress } from "@/components/ui/progress";

export function DataTab() {
  const t = useTranslations('Settings');
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const { logout } = useAuthStore();
  const router = useRouter();
  const isSubmittingRef = useRef(false);

  const handleExport = useCallback(async () => {
    if (isSubmittingRef.current || exporting) return;
    isSubmittingRef.current = true;
    setExporting(true);
    try {
      const response = await import('@/lib/api').then(mod => mod.dataApi.exportData());

      const blob = new Blob([response.data], { type: 'application/zip' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `expense_tracker_export_${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success('Data exported successfully');
    } catch (error) {
      console.error(error);
      toast.error('Failed to export data');
    } finally {
      setExporting(false);
      isSubmittingRef.current = false;
    }
  }, [exporting]);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isSubmittingRef.current) return;
    
    const file = e.target.files?.[0];
    if (!file) return;

    isSubmittingRef.current = true;
    setImporting(true);
    setProgress(0);
    const toastId = toast.loading('Importing data...');
    
    try {
      const { dataApi } = await import('@/lib/api');
      const response = await dataApi.importData(file, (percent) => {
        setProgress(percent);
      });
      toast.success(response.data.message);
      // Reset input
      e.target.value = '';
    } catch (error) {
      console.error(error);
      toast.error(getApiErrorMessage(error, 'Failed to import data'));
    } finally {
      toast.dismiss(toastId);
      setImporting(false);
      setProgress(0);
      isSubmittingRef.current = false;
    }
  };

  const handleDeleteAccount = useCallback(async () => {
    if (isSubmittingRef.current || deleting) return;
    isSubmittingRef.current = true;
    setDeleting(true);
    try {
      await usersApi.deleteAccount();
      toast.success('Account deleted successfully');
      await logout();
    } catch (error) {
      console.error(error);
      toast.error('Failed to delete account');
    } finally {
      setDeleting(false);
      isSubmittingRef.current = false;
    }
  }, [deleting, logout, router]);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        {/* Export Card */}
        <Card className="bg-card border-border">
            <CardHeader>
            <CardTitle className="text-foreground">{t('exportData')}</CardTitle>
            <CardDescription className="text-muted-foreground">{t('exportDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
            <Button 
                    onClick={handleExport} 
                    disabled={exporting}
                    variant="outline"
                    className="border-border text-foreground hover:bg-muted w-full sm:w-auto"
                >
                    {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                    {t('download')}
            </Button>
            </CardContent>
        </Card>

        {/* Import Card */}
        <Card className="bg-card border-border">
            <CardHeader>
            <CardTitle className="text-foreground">Import Data</CardTitle>
            <CardDescription className="text-muted-foreground">
                Import from CSV. Supported types:
                <br />
                - <b>Jars</b>: name, percentage, balance
                <br />
                - <b>Categories</b>: name, icon, color, monthly_limit, jar
                <br />
                - <b>Goals</b>: name, target_amount, current_amount, deadline, color
                <br />
                - <b>Expenses</b>: date, amount, description, category
                <br />
                - <b>Incomes</b>: date, amount, source
            </CardDescription>
            </CardHeader>
            <CardContent>
            <div className="space-y-4">
                <div className="flex items-center gap-4">
                    <input
                        type="file"
                        accept=".csv"
                        id="file-upload"
                        className="hidden"
                        onChange={handleImport}
                        disabled={importing}
                    />
                    <Button asChild variant="outline" className={`border-border text-foreground hover:bg-muted w-full sm:w-auto ${importing ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}`}>
                        <label htmlFor={importing ? undefined : "file-upload"}>
                            {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4 rotate-180" />}
                            {importing ? 'Importing...' : 'Select CSV File'}
                        </label>
                    </Button>
                </div>
                {importing && (
                    <div className="space-y-1">
                        <Progress value={progress} className="h-2" />
                        <p className="text-xs text-muted-foreground text-right">{progress}%</p>
                    </div>
                )}
            </div>
            </CardContent>
        </Card>
      </div>

      <Card className="bg-red-500/5 dark:bg-red-900/10 border-red-500/20 dark:border-red-900/30">
        <CardHeader>
          <CardTitle className="text-red-600 dark:text-red-400 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            {t('deleteAccount')}
          </CardTitle>
          <CardDescription className="text-red-600/70 dark:text-red-400/70">{t('deleteDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="bg-red-600 hover:bg-red-700">
                    <Trash2 className="mr-2 h-4 w-4" />
                    {t('delete')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-card border-border">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-foreground">Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription className="text-muted-foreground">
                    This action cannot be undone. This will permanently delete your account and remove your data from our servers.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="bg-muted text-foreground border-border hover:bg-muted/80">Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteAccount} className="bg-red-600 hover:bg-red-700 text-white">
                    {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete Account"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
