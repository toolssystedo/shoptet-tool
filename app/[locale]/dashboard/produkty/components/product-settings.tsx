'use client';

import { useState, useEffect } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ProductSettings as ProductSettingsType } from '@/lib/produkty/xlsx-processor';

interface ProductSettingsProps {
  settings: ProductSettingsType;
  onChange: (settings: ProductSettingsType) => void;
  disabled?: boolean;
}

export function ProductSettings({ settings, onChange, disabled }: ProductSettingsProps) {
  const [localSettings, setLocalSettings] = useState(settings);
  const t = useTranslations('produkty.settings');

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleCheckboxChange = (type: 'related' | 'alternative') => {
    const newSettings = {
      ...localSettings,
      [type]: {
        ...localSettings[type],
        enabled: !localSettings[type].enabled
      }
    };
    setLocalSettings(newSettings);
    onChange(newSettings);
  };

  const handleCountChange = (type: 'related' | 'alternative', value: string) => {
    const numValue = Math.min(10, Math.max(1, parseInt(value) || 1));
    const newSettings = {
      ...localSettings,
      [type]: {
        ...localSettings[type],
        count: numValue
      }
    };
    setLocalSettings(newSettings);
    onChange(newSettings);
  };

  const noneSelected = !localSettings.related.enabled && !localSettings.alternative.enabled;

  return (
    <div className="bg-muted rounded-xl p-4 mb-4">
      <h3 className="text-sm font-medium text-foreground mb-3">{t('title')}</h3>

      {/* Warning when none selected */}
      {noneSelected && (
        <div className="mb-3 p-3 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-lg flex items-center gap-2 text-amber-700 dark:text-amber-400 text-sm">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>{t('selectAtLeastOne')}</span>
        </div>
      )}

      <div className="space-y-4">
        {/* Related Products */}
        <div className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
          localSettings.related.enabled
            ? 'bg-card border-border'
            : 'bg-muted border-transparent'
        }`}>
          <label className="flex items-center gap-3 cursor-pointer flex-1">
            <Checkbox
              checked={localSettings.related.enabled}
              onCheckedChange={() => handleCheckboxChange('related')}
              disabled={disabled}
            />
            <div>
              <span className={`font-medium ${localSettings.related.enabled ? 'text-foreground' : 'text-muted-foreground'}`}>
                {t('relatedProducts')}
              </span>
              <p className={`text-xs ${localSettings.related.enabled ? 'text-muted-foreground' : 'text-muted-foreground/60'}`}>
                {t('relatedDescription')}
              </p>
            </div>
          </label>

          {localSettings.related.enabled && (
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground">{t('count')}:</label>
              <Input
                type="number"
                min={1}
                max={10}
                value={localSettings.related.count}
                onChange={(e) => handleCountChange('related', e.target.value)}
                disabled={disabled}
                className="w-16 text-center"
              />
            </div>
          )}
        </div>

        {/* Alternative Products */}
        <div className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
          localSettings.alternative.enabled
            ? 'bg-card border-border'
            : 'bg-muted border-transparent'
        }`}>
          <label className="flex items-center gap-3 cursor-pointer flex-1">
            <Checkbox
              checked={localSettings.alternative.enabled}
              onCheckedChange={() => handleCheckboxChange('alternative')}
              disabled={disabled}
            />
            <div>
              <span className={`font-medium ${localSettings.alternative.enabled ? 'text-foreground' : 'text-muted-foreground'}`}>
                {t('alternativeProducts')}
              </span>
              <p className={`text-xs ${localSettings.alternative.enabled ? 'text-muted-foreground' : 'text-muted-foreground/60'}`}>
                {t('alternativeDescription')}
              </p>
            </div>
          </label>

          {localSettings.alternative.enabled && (
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground">{t('count')}:</label>
              <Input
                type="number"
                min={1}
                max={10}
                value={localSettings.alternative.count}
                onChange={(e) => handleCountChange('alternative', e.target.value)}
                disabled={disabled}
                className="w-16 text-center"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
