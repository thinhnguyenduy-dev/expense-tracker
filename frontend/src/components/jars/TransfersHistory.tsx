'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { vi, enUS } from 'date-fns/locale';
import { ArrowRight, History } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import { jarsApi, Transfer } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const formatCurrency = (value: number, locale: string) => {
  return new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-US', {
    style: 'currency',
    currency: locale === 'vi' ? 'VND' : 'USD',
  }).format(value);
};

export function TransfersHistory() {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const t = useTranslations('Jars');
  const tCommon = useTranslations('Common');
  const locale = useLocale();

  useEffect(() => {
    const fetchTransfers = async () => {
      try {
        const response = await jarsApi.getTransfers();
        setTransfers(response.data);
      } catch (error) {
        console.error('Failed to fetch transfers', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTransfers();
  }, []);

  if (loading) return null;
  if (transfers.length === 0) return null;

  return (
    <Card className="bg-card border-border mt-6">
      <CardHeader>
        <CardTitle className="text-foreground flex items-center gap-2">
            <History className="h-5 w-5 text-muted-foreground" />
            {t('transferHistory')}
        </CardTitle>
        <CardDescription className="text-muted-foreground">{t('transferHistoryDesc')}</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-muted">
              <TableHead className="text-muted-foreground">{tCommon('date')}</TableHead>
              <TableHead className="text-muted-foreground">{t('from')}</TableHead>
              <TableHead className="text-muted-foreground"></TableHead>
              <TableHead className="text-muted-foreground">{t('to')}</TableHead>
              <TableHead className="text-muted-foreground text-right">{tCommon('amount')}</TableHead>
              <TableHead className="text-muted-foreground">{t('note')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transfers.map((transfer) => (
              <TableRow key={transfer.id} className="border-border hover:bg-muted/50">
                <TableCell className="text-foreground">
                  {format(new Date(transfer.date), 'MMM dd, yyyy', { locale: locale === 'vi' ? vi : enUS })}
                </TableCell>
                <TableCell className="text-foreground font-medium">
                  {transfer.from_jar_name}
                </TableCell>
                <TableCell>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </TableCell>
                <TableCell className="text-foreground font-medium">
                  {transfer.to_jar_name}
                </TableCell>
                <TableCell className="text-right font-medium text-emerald-500">
                  {formatCurrency(Number(transfer.amount), locale)}
                </TableCell>
                <TableCell className="text-muted-foreground max-w-xs truncate">
                  {transfer.note || '-'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
