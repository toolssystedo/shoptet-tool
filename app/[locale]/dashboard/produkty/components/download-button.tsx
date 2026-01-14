'use client';

import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface DownloadButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

export function DownloadButton({ onClick, disabled }: DownloadButtonProps) {
  const t = useTranslations('produkty');

  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      className="w-full py-6 text-lg font-semibold"
      size="lg"
    >
      <Download className="w-6 h-6 mr-3" />
      {t('downloadButton')}
    </Button>
  );
}
