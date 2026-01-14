'use client';

import { useState, useCallback } from 'react';
import { Upload, FileSpreadsheet } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  isProcessing: boolean;
}

export function FileUpload({ onFileSelect, isProcessing }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const t = useTranslations('produkty.upload');

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        onFileSelect(file);
      } else {
        alert(t('invalidFileType'));
      }
    }
  }, [onFileSelect, t]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  }, [onFileSelect]);

  return (
    <div
      className={`
        relative border-2 border-dashed rounded-2xl p-12 transition-all duration-300 cursor-pointer
        ${isProcessing ? 'pointer-events-none opacity-60' : ''}
        ${isDragging
          ? 'border-primary bg-accent scale-[1.02]'
          : 'border-border hover:border-primary/50 hover:bg-muted/50'}
      `}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={() => document.getElementById('file-input')?.click()}
    >
      <input
        id="file-input"
        type="file"
        accept=".xlsx,.xls"
        onChange={handleFileInput}
        className="hidden"
        disabled={isProcessing}
      />

      <div className="flex flex-col items-center gap-4">
        {/* Upload Icon */}
        <div
          className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300
            ${isDragging ? 'bg-primary' : 'bg-gradient-to-br from-primary/90 to-primary'}`}
        >
          <Upload className="w-10 h-10 text-primary-foreground" />
        </div>

        {/* Text */}
        <div className="text-center">
          <p className="text-xl font-semibold text-foreground mb-1">
            {isDragging ? t('dropHere') : t('dragDrop')}
          </p>
          <p className="text-muted-foreground">
            {t('orClick')} <span className="font-medium text-primary hover:underline">{t('clickToSelect')}</span>
          </p>
        </div>

        {/* Supported formats */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <FileSpreadsheet className="w-4 h-4" />
          <span>{t('supportedFormats')}</span>
        </div>
      </div>
    </div>
  );
}
