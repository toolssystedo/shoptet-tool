'use client';

import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Info, AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';

export function InfoCard() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isPathModalOpen, setIsPathModalOpen] = useState(false);
  const t = useTranslations('produkty.info');

  return (
    <>
      <div className="bg-muted/50 border rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Info className="w-5 h-5 text-primary" />
          {t('title')}
        </h3>

        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full text-primary-foreground flex items-center justify-center flex-shrink-0 text-sm font-bold bg-primary">
              1
            </div>
            <div>
              <p className="font-medium text-foreground">{t('step1Title')}</p>
              <p className="text-sm text-muted-foreground">{t('step1Description')}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {t('showExportPath')}{' '}
                <button
                  onClick={() => setIsPathModalOpen(true)}
                  className="font-medium underline hover:no-underline cursor-pointer text-primary"
                >
                  {t('clickHere')}
                </button>
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {t('showExportTemplate')}{' '}
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="font-medium underline hover:no-underline cursor-pointer text-primary"
                >
                  {t('clickHere')}
                </button>
                . {t('keepItSimple')}
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full text-primary-foreground flex items-center justify-center flex-shrink-0 text-sm font-bold bg-primary">
              2
            </div>
            <div>
              <p className="font-medium text-foreground">{t('step2Title')}</p>
              <p className="text-sm text-muted-foreground">{t('step2Description')}</p>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full text-primary-foreground flex items-center justify-center flex-shrink-0 text-sm font-bold bg-primary">
              3
            </div>
            <div>
              <p className="font-medium text-foreground">{t('step3Title')}</p>
              <p className="text-sm text-muted-foreground">{t('step3Description')}</p>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full text-primary-foreground flex items-center justify-center flex-shrink-0 text-sm font-bold bg-primary">
              4
            </div>
            <div>
              <p className="font-medium text-foreground">{t('step4Title')}</p>
              <p className="text-sm text-muted-foreground">{t('step4Desc1')}</p>
              <p className="text-sm text-muted-foreground">
                {t('step4Desc2')}{' '}
                <button
                  onClick={() => setIsImportModalOpen(true)}
                  className="font-medium underline hover:no-underline cursor-pointer text-primary"
                >
                  {t('accordingToGuide')}
                </button>
              </p>
              <p className="text-sm text-muted-foreground">{t('step4Desc3')}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {t('showImportGuide')}{' '}
                <button
                  onClick={() => setIsImportModalOpen(true)}
                  className="font-medium underline hover:no-underline cursor-pointer text-primary"
                >
                  {t('clickHere')}
                </button>
              </p>
              {/* Warning about overwriting */}
              <div className="mt-3 ml-0 p-3 bg-amber-50 dark:bg-amber-950/50 border-l-4 border-amber-400 rounded-r-lg">
                <p className="text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span><strong>{t('warning')}:</strong> {t('warningText')}</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="font-medium text-primary">{t('relatedProducts')}</p>
              <p className="text-muted-foreground">{t('relatedDescription')}</p>
            </div>
            <div>
              <p className="font-medium text-primary">{t('alternativeProducts')}</p>
              <p className="text-muted-foreground">{t('alternativeDescription')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Modal for export template image */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          <img
            src="/sablona-exportu.jpg"
            alt={t('exportTemplateAlt')}
            className="w-full h-auto"
          />
        </DialogContent>
      </Dialog>

      {/* Modal for export path image */}
      <Dialog open={isPathModalOpen} onOpenChange={setIsPathModalOpen}>
        <DialogContent className="max-w-5xl p-0 overflow-hidden">
          <img
            src="/cesta-k-exportu.jpg"
            alt={t('exportPathAlt')}
            className="w-full h-auto"
          />
        </DialogContent>
      </Dialog>

      {/* Modal for import guide image */}
      <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          <img
            src="/import-produktu.jpg"
            alt={t('importGuideAlt')}
            className="w-full h-auto"
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
