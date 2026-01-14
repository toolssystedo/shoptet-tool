'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart3, CheckCircle, AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { DetailedStats } from '@/lib/produkty/xlsx-processor';

interface DataQualityStatsProps {
  detailedStats: DetailedStats;
}

export function DataQualityStats({ detailedStats }: DataQualityStatsProps) {
  const t = useTranslations('produkty.stats');

  if (!detailedStats) return null;

  const {
    totalProducts,
    avgRelatedProducts,
    avgAlternativeProducts,
    fullRelatedPercent,
    lowRelatedCount,
    lowAlternativeCount,
    categoryAnalysis,
    smallCategories,
    productsWithoutCategoryText,
    singleProductSubcategories,
  } = detailedStats;

  // Helper function for status icon
  const getStatusIcon = (avg: number) => {
    if (avg >= 7) {
      return <CheckCircle className="w-4 h-4 text-green-600" />;
    } else if (avg < 5) {
      return <AlertTriangle className="w-4 h-4 text-amber-500" />;
    }
    return <span className="text-muted-foreground">–</span>;
  };

  // Has problem areas?
  const hasProblems = smallCategories.length > 0 ||
                      productsWithoutCategoryText > 0 ||
                      singleProductSubcategories.length > 0;

  return (
    <Card>
      {/* Header */}
      <CardHeader className="pb-4 border-b">
        <CardTitle className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center bg-accent">
            <BarChart3 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">{t('title')}</h3>
            <p className="text-sm text-muted-foreground font-normal">{t('subtitle')}</p>
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6 pt-6">
        {/* 1. BASIC METRICS */}
        <div>
          <h4 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-3">{t('basicMetrics')}</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-muted rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-primary">{totalProducts}</p>
              <p className="text-xs text-muted-foreground mt-1">{t('processedProducts')}</p>
            </div>
            <div className="bg-muted rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-primary">{avgRelatedProducts}</p>
              <p className="text-xs text-muted-foreground mt-1">{t('avgRelated')}</p>
            </div>
            <div className="bg-muted rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-primary">{avgAlternativeProducts}</p>
              <p className="text-xs text-muted-foreground mt-1">{t('avgAlternative')}</p>
            </div>
            <div className="bg-muted rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-primary">{fullRelatedPercent}%</p>
              <p className="text-xs text-muted-foreground mt-1">{t('withFullCount')}</p>
            </div>
          </div>

          {/* Warnings */}
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className={`rounded-xl p-3 flex items-center gap-3 ${lowRelatedCount > 0 ? 'bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800' : 'bg-green-50 dark:bg-green-950/50 border border-green-200 dark:border-green-800'}`}>
              <span className="text-lg">
                {lowRelatedCount > 0 ? <AlertTriangle className="w-5 h-5 text-amber-500" /> : <CheckCircle className="w-5 h-5 text-green-600" />}
              </span>
              <div>
                <p className={`text-sm font-medium ${lowRelatedCount > 0 ? 'text-amber-800 dark:text-amber-400' : 'text-green-800 dark:text-green-400'}`}>
                  {lowRelatedCount > 0 ? t('productsWithLowRelated', { count: lowRelatedCount }) : t('allProductsOk')}
                </p>
                <p className={`text-xs ${lowRelatedCount > 0 ? 'text-amber-600 dark:text-amber-500' : 'text-green-600 dark:text-green-500'}`}>
                  {lowRelatedCount > 0 ? t('lessThan3Related') : t('have3PlusRelated')}
                </p>
              </div>
            </div>
            <div className={`rounded-xl p-3 flex items-center gap-3 ${lowAlternativeCount > 0 ? 'bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800' : 'bg-green-50 dark:bg-green-950/50 border border-green-200 dark:border-green-800'}`}>
              <span className="text-lg">
                {lowAlternativeCount > 0 ? <AlertTriangle className="w-5 h-5 text-amber-500" /> : <CheckCircle className="w-5 h-5 text-green-600" />}
              </span>
              <div>
                <p className={`text-sm font-medium ${lowAlternativeCount > 0 ? 'text-amber-800 dark:text-amber-400' : 'text-green-800 dark:text-green-400'}`}>
                  {lowAlternativeCount > 0 ? t('productsWithLowAlternative', { count: lowAlternativeCount }) : t('allProductsOk')}
                </p>
                <p className={`text-xs ${lowAlternativeCount > 0 ? 'text-amber-600 dark:text-amber-500' : 'text-green-600 dark:text-green-500'}`}>
                  {lowAlternativeCount > 0 ? t('lessThan3Alternative') : t('have3PlusAlternative')}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 2. CATEGORY ANALYSIS */}
        {categoryAnalysis.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-3">{t('categoryAnalysis')}</h4>
            <div className="overflow-hidden rounded-xl border">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">{t('category')}</th>
                    <th className="text-center py-2 px-3 font-medium text-muted-foreground">{t('productsCount')}</th>
                    <th className="text-center py-2 px-3 font-medium text-muted-foreground">{t('avgRelatedShort')}</th>
                    <th className="text-center py-2 px-3 font-medium text-muted-foreground w-12">{t('status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryAnalysis.map((cat, index) => (
                    <tr key={index} className={index % 2 === 0 ? 'bg-card' : 'bg-muted/50'}>
                      <td className="py-2 px-3 text-foreground font-medium truncate max-w-[200px]" title={cat.name}>
                        {cat.name}
                      </td>
                      <td className="py-2 px-3 text-center text-muted-foreground">{cat.productCount}</td>
                      <td className="py-2 px-3 text-center text-muted-foreground">{cat.avgRelated}</td>
                      <td className="py-2 px-3 text-center">{getStatusIcon(cat.avgRelated)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 3. PROBLEM AREAS */}
        {hasProblems && (
          <div>
            <h4 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-3">{t('problemAreas')}</h4>
            <div className="space-y-3">
              {/* Small categories */}
              {smallCategories.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium text-amber-800 dark:text-amber-400">{t('smallCategories')}</p>
                      <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">{t('smallCategoriesHint')}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {smallCategories.map((cat, i) => (
                          <Badge key={i} variant="secondary" className="bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-400">
                            {cat.name} ({cat.productCount})
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Products without categoryText */}
              {productsWithoutCategoryText > 0 && (
                <div className="bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-amber-800 dark:text-amber-400">{t('productsWithoutCategoryText', { count: productsWithoutCategoryText })}</p>
                      <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">{t('noAlternativeAssigned')}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Subcategories with 1 product */}
              {singleProductSubcategories.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium text-amber-800 dark:text-amber-400">{t('singleProductSubcategories')}</p>
                      <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">{t('cannotAssignSimilar')}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {singleProductSubcategories.map((sub, i) => (
                          <Badge key={i} variant="secondary" className="bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-400 truncate max-w-[250px]" title={sub}>
                            {sub}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
