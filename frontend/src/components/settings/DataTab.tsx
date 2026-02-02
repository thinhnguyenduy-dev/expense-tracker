'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Download, Trash2, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { usersApi } from '@/lib/api';
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


export function DataTab() {
  const t = useTranslations('Settings');
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { logout } = useAuthStore();
  const router = useRouter();

  const handleExport = async () => {
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
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      await usersApi.deleteAccount();
      logout();
      router.push('/login');
      toast.success('Account deleted successfully');
    } catch (error) {
      console.error(error);
      toast.error('Failed to delete account');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
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
                className="border-border text-foreground hover:bg-muted"
            >
                {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                {t('download')}
           </Button>
        </CardContent>
      </Card>

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

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Import Data</CardTitle>
          <CardDescription className="text-muted-foreground">
            Import your expenses or incomes from a CSV file.
            Required headers:
            <br />
            - Expenses: date, amount, description, category
            <br />
            - Incomes: date, amount, description, source
          </CardDescription>
        </CardHeader>
        <CardContent>
           <div className="flex items-center gap-4">
              <input
                type="file"
                accept=".csv"
                id="file-upload"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  
                  const toastId = toast.loading('Importing data...');
                  try {
                    const { dataApi } = await import('@/lib/api');
                    const response = await dataApi.importData(file);
                    toast.success(response.data.message);
                    // Reset input
                    e.target.value = '';
                  } catch (error) {
                    console.error(error);
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    toast.error((error as any)?.response?.data?.detail || 'Failed to import data');
                  } finally {
                    toast.dismiss(toastId);
                  }
                }}
              />
              <Button asChild variant="outline" className="border-border text-foreground hover:bg-muted cursor-pointer">
                <label htmlFor="file-upload">
                    <Download className="mr-2 h-4 w-4 rotate-180" />
                    Select CSV File
                </label>
              </Button>
           </div>
        </CardContent>
      </Card>
    </div>
  );
}
