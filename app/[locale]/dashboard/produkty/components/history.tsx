'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, FileSpreadsheet } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface HistoryItem {
  fileName: string;
  date: string;
  productCount: number;
}

interface HistoryProps {
  items: HistoryItem[];
  onClear: () => void;
}

export function History({ items, onClear }: HistoryProps) {
  const t = useTranslations('produkty.history');

  if (!items || items.length === 0) {
    return null;
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('cs-CZ', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            {t('title')}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="text-muted-foreground hover:text-destructive"
          >
            {t('clear')}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item, index) => (
          <div
            key={index}
            className="flex items-center gap-3 p-3 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
          >
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-primary/10">
              <FileSpreadsheet className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{item.fileName}</p>
              <p className="text-xs text-muted-foreground">{formatDate(item.date)}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-sm font-semibold text-foreground">{item.productCount}</p>
              <p className="text-xs text-muted-foreground">{t('products')}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
