"use client";

import { useState, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, AlertCircle, CheckCircle, FileUp, Download } from "lucide-react";
import { expensesApi } from "@/lib/api";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ImportExpensesModalProps {
  onSuccess: () => void;
}

export function ImportExpensesModal({ onSuccess }: ImportExpensesModalProps) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ success: number; failed: number; errors: any[] } | null>(null);
  const isSubmittingRef = useRef(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResult(null);
    }
  };

  const downloadTemplate = () => {
    const headers = "date,amount,category,description";
    const sample = "2024-02-01,15.50,Food,Lunch at Cafe";
    const csvContent = "data:text/csv;charset=utf-8," + headers + "\n" + sample;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "expenses_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleUpload = useCallback(async () => {
    if (!file || isSubmittingRef.current || uploading) return;

    isSubmittingRef.current = true;
    setUploading(true);
    try {
      const response = await expensesApi.import(file);
      setResult({
        success: response.data.success_count,
        failed: response.data.failed_count,
        errors: response.data.errors,
      });

      if (response.data.success_count > 0) {
        toast.success(`Successfully imported ${response.data.success_count} expenses.`);
        onSuccess();
      }
      
      if (response.data.failed_count > 0) {
        toast.warning(`${response.data.failed_count} rows failed to import.`);
      }

      // If strict success (no errors), close modal
      if (response.data.failed_count === 0) {
        setOpen(false);
        setFile(null);
        setResult(null);
      }
    } catch (error) {
      console.error("Import failed", error);
      toast.error("Failed to upload file. Please check the format.");
    } finally {
      setUploading(false);
      isSubmittingRef.current = false;
    }
  }, [file, uploading, onSuccess]);

  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (uploading) return;
    setOpen(newOpen);
  }, [uploading]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Upload className="h-4 w-4" />
          Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Import Expenses</DialogTitle>
          <DialogDescription>
            Upload a CSV file to bulk import expenses.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="flex items-center gap-4 p-4 border rounded-lg bg-muted/50 border-dashed">
            <div className="p-3 bg-background rounded-full shadow-sm">
                <FileUp className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
                <p className="text-sm font-medium">Upload CSV</p>
                <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    className="text-xs text-muted-foreground file:mr-4 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-xs file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 mt-1"
                />
            </div>
          </div>
            
          <div className="flex justify-end">
              <Button variant="link" size="sm" onClick={downloadTemplate} className="text-muted-foreground h-auto p-0">
                  <Download className="mr-2 h-3 w-3" /> Download Template
              </Button>
          </div>

          {result && result.failed > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Import Issues</AlertTitle>
              <AlertDescription>
                {result.success} imported, {result.failed} failed.
                <ScrollArea className="h-[100px] mt-2 w-full rounded-md border p-2 bg-background">
                  <ul className="text-xs list-disc pl-4 space-y-1">
                    {result.errors.map((err, idx) => (
                      <li key={idx}>
                        Row {err.row}: {err.error}
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={uploading}>
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={!file || uploading}>
            {uploading ? "Importing..." : "Import Expenses"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
