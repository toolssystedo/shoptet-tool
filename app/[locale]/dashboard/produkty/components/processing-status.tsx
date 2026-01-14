'use client';

import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useTranslations } from 'next-intl';
import type { Stats } from '@/lib/produkty/xlsx-processor';

interface ProcessingStatusProps {
  fileName: string;
  stats: Stats | null;
  isProcessing: boolean;
  isComplete: boolean;
  error: string | null;
}

export function ProcessingStatus({ fileName, stats, isProcessing, isComplete, error }: ProcessingStatusProps) {
  const t = useTranslations('produkty.status');

  if (error) {
    return (
      <Alert variant="destructive">
        <XCircle className="h-5 w-5" />
        <AlertTitle>{t('errorTitle')}</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (isProcessing) {
    return (
      <div className="rounded-xl p-6 bg-accent border border-primary/20">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-primary/20">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
          <div>
            <p className="font-semibold text-primary">{t('processing')}</p>
            <p className="text-sm text-primary/80">{fileName}</p>
          </div>
        </div>
      </div>
    );
  }

  if (isComplete && stats) {
    return (
      <div className="rounded-xl p-6 bg-accent border border-primary/20">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-primary/20">
            <CheckCircle className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="font-semibold mb-2 text-primary">{t('complete')}</p>
            <p className="text-sm mb-3 text-primary/80">{fileName}</p>

            <div className="grid grid-cols-3 gap-4">
              <div className="bg-card rounded-lg p-3 text-center shadow-sm">
                <p className="text-2xl font-bold text-foreground">{stats.totalProducts}</p>
                <p className="text-xs text-muted-foreground">{t('products')}</p>
              </div>
              <div className="bg-card rounded-lg p-3 text-center shadow-sm">
                <p className="text-2xl font-bold text-foreground">{stats.mainCategories}</p>
                <p className="text-xs text-muted-foreground">{t('mainCategories')}</p>
              </div>
              <div className="bg-card rounded-lg p-3 text-center shadow-sm">
                <p className="text-2xl font-bold text-foreground">{stats.uniqueCategoryTexts}</p>
                <p className="text-xs text-muted-foreground">{t('uniquePaths')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
