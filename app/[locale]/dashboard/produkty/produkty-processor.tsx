'use client';

import { useState, useCallback } from 'react';
import { FileUpload } from './components/file-upload';
import { ProcessingStatus } from './components/processing-status';
import { DownloadButton } from './components/download-button';
import { History } from './components/history';
import { InfoCard } from './components/info-card';
import { DataQualityStats } from './components/data-quality-stats';
import { ProductSettings } from './components/product-settings';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { BarChart3, FileText } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  readXlsxFile,
  processData,
  downloadXlsx,
  validateData,
  getStats,
  getDetailedStats,
  type ProductSettings as ProductSettingsType,
  type ProcessedProduct,
  type Stats,
  type DetailedStats,
} from '@/lib/produkty/xlsx-processor';
import { exportStatsToPDF } from '@/lib/produkty/pdf-export';

interface HistoryItem {
  fileName: string;
  date: string;
  productCount: number;
}

export function ProduktyProcessor() {
  const t = useTranslations('produkty');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [stats, setStats] = useState<Stats | null>(null);
  const [processedData, setProcessedData] = useState<ProcessedProduct[] | null>(null);
  const [originalColumns, setOriginalColumns] = useState<string[]>([]);
  const [detailedStats, setDetailedStats] = useState<DetailedStats | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [history, setHistory] = useLocalStorage<HistoryItem[]>('xlsx-processor-history', []);
  const [productSettings, setProductSettings] = useState<ProductSettingsType>({
    related: { enabled: true, count: 10 },
    alternative: { enabled: true, count: 10 }
  });

  const handleFileSelect = useCallback(async (file: File) => {
    // Validate settings
    if (!productSettings.related.enabled && !productSettings.alternative.enabled) {
      setError(t('errors.selectAtLeastOne'));
      return;
    }

    setIsProcessing(true);
    setIsComplete(false);
    setError(null);
    setFileName(file.name);
    setProcessedData(null);
    setOriginalColumns([]);
    setStats(null);
    setDetailedStats(null);
    setShowStats(false);

    try {
      // Load file
      const { data, originalColumns: columns } = await readXlsxFile(file);

      // Validate data
      const validation = validateData(data, columns);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // Process data
      const processed = processData(data, columns, productSettings);

      // Get statistics
      const statistics = getStats(processed);

      // Get detailed statistics
      const detailed = getDetailedStats(processed);

      setProcessedData(processed);
      setOriginalColumns(columns);
      setStats(statistics);
      setDetailedStats(detailed);
      setIsComplete(true);

      // Add to history
      const historyItem: HistoryItem = {
        fileName: file.name,
        date: new Date().toISOString(),
        productCount: statistics.totalProducts
      };
      setHistory(prev => [historyItem, ...prev.slice(0, 4)]);

    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsProcessing(false);
    }
  }, [productSettings, setHistory, t]);

  const handleDownload = useCallback(() => {
    if (processedData) {
      const outputFileName = fileName.replace(/\.xlsx?$/i, '_processed.xlsx');
      downloadXlsx(processedData, outputFileName, originalColumns, productSettings);
    }
  }, [processedData, fileName, originalColumns, productSettings]);

  const handleExportPDF = useCallback(() => {
    if (detailedStats) {
      exportStatsToPDF(detailedStats, fileName);
    }
  }, [detailedStats, fileName]);

  const handleClearHistory = useCallback(() => {
    setHistory([]);
  }, [setHistory]);

  const handleReset = useCallback(() => {
    setIsProcessing(false);
    setIsComplete(false);
    setError(null);
    setFileName('');
    setStats(null);
    setProcessedData(null);
    setOriginalColumns([]);
    setDetailedStats(null);
    setShowStats(false);
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Info Card */}
      <InfoCard />

      {/* Upload Area */}
      <Card>
        <CardContent className="p-6">
          <FileUpload
            onFileSelect={handleFileSelect}
            isProcessing={isProcessing}
          />

          {/* Product Settings - before processing */}
          {!isProcessing && !isComplete && !error && (
            <div className="mt-6">
              <ProductSettings
                settings={productSettings}
                onChange={setProductSettings}
                disabled={isProcessing}
              />
            </div>
          )}

          {/* Processing Status */}
          {(isProcessing || isComplete || error) && (
            <div className="mt-6">
              <ProcessingStatus
                fileName={fileName}
                stats={stats}
                isProcessing={isProcessing}
                isComplete={isComplete}
                error={error}
              />
            </div>
          )}

          {/* Data Quality Stats Toggle & Content */}
          {isComplete && !error && detailedStats && (
            <div className="mt-6 space-y-4">
              {!showStats ? (
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => setShowStats(true)}
                >
                  <BarChart3 className="w-5 h-5 mr-2" />
                  {t('showStats')}
                </Button>
              ) : (
                <>
                  <DataQualityStats detailedStats={detailedStats} />
                  <Button
                    variant="ghost"
                    className="w-full text-muted-foreground"
                    onClick={() => setShowStats(false)}
                  >
                    {t('hideStats')}
                  </Button>
                </>
              )}
            </div>
          )}

          {/* Download Buttons */}
          {isComplete && !error && (
            <div className="mt-6 space-y-3">
              {/* PDF Export Button */}
              {detailedStats && (
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={handleExportPDF}
                >
                  <FileText className="w-5 h-5 mr-2" />
                  {t('downloadPDF')}
                </Button>
              )}

              <DownloadButton
                onClick={handleDownload}
                disabled={!processedData}
              />
              <Button
                variant="secondary"
                className="w-full"
                onClick={handleReset}
              >
                {t('processAnother')}
              </Button>
            </div>
          )}

          {/* Error Reset Button */}
          {error && (
            <div className="mt-6">
              <Button
                variant="secondary"
                className="w-full"
                onClick={handleReset}
              >
                {t('tryAgain')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* History */}
      <History items={history} onClear={handleClearHistory} />
    </div>
  );
}
