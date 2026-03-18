"use client";

import { useState, useEffect } from "react";
import { jarsApi, Jar } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { getApiErrorMessage } from "@/lib/utils";

interface JarCustomizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingJars: Jar[];
}

export function JarCustomizationModal({ isOpen, onClose, existingJars }: JarCustomizationModalProps) {
  const [jars, setJars] = useState<Array<{ id?: number; name: string; percentage: number; balance: number }>>([]);
  const [isPending, setIsPending] = useState(false);
  const t = useTranslations('Jars');
  
  useEffect(() => {
    if (isOpen) {
      if (existingJars && existingJars.length > 0) {
        setJars(existingJars.map(j => ({ ...j })));
      } else {
        setJars([]);
      }
    }
  }, [isOpen, existingJars]);

  const totalPercentage = jars.reduce((sum, jar) => sum + (jar.percentage || 0), 0);
  const isTotalValid = Math.abs(totalPercentage - 100) < 0.01;
  const hasEmptyNames = jars.some(j => !j.name.trim());

  const addJar = () => {
    setJars([...jars, { name: "", percentage: 0, balance: 0 }]);
  };

  const removeJar = (index: number) => {
    const jarToRemove = jars[index];
    if (jarToRemove.balance > 0) {
      toast.error(t('cannotRemoveBalance', { name: jarToRemove.name, balance: jarToRemove.balance }));
      return;
    }
    const newJars = [...jars];
    newJars.splice(index, 1);
    setJars(newJars);
  };

  const updateJar = (index: number, field: "name" | "percentage", value: string | number) => {
    const newJars = [...jars];
    newJars[index] = { ...newJars[index], [field]: value };
    setJars(newJars);
  };

  const handleSave = async () => {
    if (!isTotalValid) {
      toast.error(t('totalMustEqual100'));
      return;
    }
    if (hasEmptyNames) {
      toast.error(t('namesRequired'));
      return;
    }
    
    setIsPending(true);
    try {
      const payload = {
          jars: jars.map(j => ({
              id: j.id,
              name: j.name,
              percentage: Number(j.percentage)
          }))
      };
      await jarsApi.bulkUpdate(payload);
      toast.success(t('successUpdate'));
      onClose();
    } catch (error: any) {
      toast.error(getApiErrorMessage(error, t('failedUpdate')));
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('customizeTitle')}</DialogTitle>
          <DialogDescription>
            {t('customizeDesc')}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="flex justify-between items-center bg-muted/50 p-3 rounded-lg border">
            <span className="font-medium text-sm">{t('totalAllocation')}</span>
            <span className={`font-bold ${isTotalValid ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {totalPercentage.toFixed(1)}% / 100%
            </span>
          </div>

          <div className="space-y-3">
            {jars.map((jar, index) => (
              <div key={index} className="flex gap-2 items-start">
                <div className="grid gap-2 flex-1">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Label className="sr-only">{t('jarName')}</Label>
                      <Input
                        value={jar.name}
                        onChange={(e) => updateJar(index, "name", e.target.value)}
                        placeholder={t('jarName')}
                      />
                    </div>
                    <div className="w-24">
                      <Label className="sr-only">{t('percentage')}</Label>
                      <div className="relative">
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={jar.percentage}
                          onChange={(e) => updateJar(index, "percentage", parseFloat(e.target.value) || 0)}
                          className="pr-6"
                        />
                        <span className="absolute right-2 top-2.5 text-sm text-muted-foreground">%</span>
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      size="icon" 
                      onClick={() => removeJar(index)}
                      className="shrink-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                      disabled={jar.balance > 0}
                      title={jar.balance > 0 ? t('cannotDeleteWarning') : t('deleteJar')}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  {jar.balance > 0 && (
                    <span className="text-xs text-muted-foreground ml-1">
                      {t('balanceCannotBeDeleted', { balance: jar.balance })}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <Button 
            type="button" 
            variant="outline" 
            size="sm" 
            onClick={addJar}
            className="w-full mt-2"
          >
            <Plus className="h-4 w-4 mr-2" /> {t('addJar')}
          </Button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            {t('cancel')}
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={isPending || !isTotalValid || hasEmptyNames}
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('saveChanges')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
