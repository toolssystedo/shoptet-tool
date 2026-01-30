"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Upload,
  FileText,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Copy,
  Languages,
  FileWarning,
  TrendingUp,
  Loader2,
  DollarSign,
  Package,
  Tag,
  ImageIcon,
  Database,
  GitBranch,
  Boxes,
  FolderTree,
  HelpCircle,
  ChevronDown,
  Lightbulb,
  Download,
  Sparkles,
  Info,
  ClipboardCopy,
  FileSearch,
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  parseProductFile,
  parseCategoryFile,
  analyzeProducts,
  type ContentAuditReport,
  type ContentIssue,
  type BusinessIssue,
  type DuplicateGroup,
  type CompletenessIssue,
  type DataQualityIssue,
  type VariantIssue,
  type StockIssue,
  type CategoryIssue,
  type ProductCategoryIssue,
  type SeoIssue,
  type CategoryData,
  type ProductData,
} from "@/lib/content-audit/analyzer";

// Export helper function
function exportProductCodes(codes: string[], filename: string) {
  const csvContent = "code\n" + codes.join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

// Score color helpers
function getScoreColor(score: number): string {
  if (score >= 90) return "text-green-500";
  if (score >= 70) return "text-yellow-500";
  if (score >= 50) return "text-orange-500";
  return "text-red-500";
}

function getScoreBgColor(score: number): string {
  if (score >= 90) return "bg-green-500/10";
  if (score >= 70) return "bg-yellow-500/10";
  if (score >= 50) return "bg-orange-500/10";
  return "bg-red-500/10";
}

export function ContentAuditClient() {
  const t = useTranslations("contentAudit");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [report, setReport] = useState<ContentAuditReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [productFileName, setProductFileName] = useState<string | null>(null);
  const [categoryFileName, setCategoryFileName] = useState<string | null>(null);
  const [language, setLanguage] = useState<"cs" | "en" | "de">("cs");
  const [minLength, setMinLength] = useState(100);
  const [isDraggingProduct, setIsDraggingProduct] = useState(false);
  const [isDraggingCategory, setIsDraggingCategory] = useState(false);
  const [products, setProducts] = useState<ProductData[] | null>(null);
  const [categories, setCategories] = useState<CategoryData[] | null>(null);

  // Run analysis when products change or when categories are added/updated
  const runAnalysis = useCallback((productData: ProductData[], categoryData: CategoryData[] | null) => {
    setIsAnalyzing(true);
    setError(null);

    try {
      if (productData.length === 0) {
        throw new Error(t("errors.noProducts"));
      }

      const result = analyzeProducts(productData, language, minLength, categoryData || undefined);
      setReport(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.unknown"));
    } finally {
      setIsAnalyzing(false);
    }
  }, [language, minLength, t]);

  const handleProductFile = useCallback(async (file: File) => {
    setError(null);
    setReport(null);
    setProductFileName(file.name);

    try {
      const buffer = await file.arrayBuffer();
      const parsedProducts = parseProductFile(buffer, file.name);

      if (parsedProducts.length === 0) {
        throw new Error(t("errors.noProducts"));
      }

      setProducts(parsedProducts);
      runAnalysis(parsedProducts, categories);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.unknown"));
    }
  }, [categories, runAnalysis, t]);

  const handleCategoryFile = useCallback(async (file: File) => {
    setError(null);
    setCategoryFileName(file.name);

    try {
      const buffer = await file.arrayBuffer();
      const parsedCategories = parseCategoryFile(buffer, file.name);

      setCategories(parsedCategories);

      // Re-run analysis if products are already loaded
      if (products && products.length > 0) {
        runAnalysis(products, parsedCategories);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.unknown"));
    }
  }, [products, runAnalysis, t]);

  const handleProductDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingProduct(false);

    const file = e.dataTransfer.files[0];
    const validExtensions = ['.xlsx', '.xls', '.csv'];
    if (file && validExtensions.some(ext => file.name.toLowerCase().endsWith(ext))) {
      handleProductFile(file);
    } else {
      setError(t("errors.invalidFile"));
    }
  }, [handleProductFile, t]);

  const handleCategoryDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingCategory(false);

    const file = e.dataTransfer.files[0];
    const validExtensions = ['.xlsx', '.xls', '.csv', '.xml'];
    if (file && validExtensions.some(ext => file.name.toLowerCase().endsWith(ext))) {
      handleCategoryFile(file);
    } else {
      setError(t("errors.invalidFile"));
    }
  }, [handleCategoryFile, t]);

  const handleProductFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleProductFile(file);
    }
  }, [handleProductFile]);

  const handleCategoryFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleCategoryFile(file);
    }
  }, [handleCategoryFile]);

  const getIssuesByType = (type: string) => {
    return report?.issues.filter(i => i.type === type) || [];
  };

  const getBusinessIssuesByCategory = (category: 'price' | 'availability' | 'promo') => {
    return report?.businessIssues.filter(i => i.category === category) || [];
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t("pageTitle")}</h1>
        <p className="text-muted-foreground mt-2">{t("pageDescription")}</p>
      </div>

      {/* Settings */}
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.title")}</CardTitle>
          <CardDescription>{t("settings.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("settings.language")}</Label>
              <Select value={language} onValueChange={(v) => setLanguage(v as "cs" | "en" | "de")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cs">Čeština</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="de">Deutsch</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("settings.minLength")}</Label>
              <Input
                type="number"
                value={minLength}
                onChange={(e) => setMinLength(parseInt(e.target.value) || 100)}
                min={0}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Feed Explanations */}
      <FeedExplanationsCard t={t} />

      {/* File Upload - Two columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Product Feed Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              {t("upload.productFeed")}
            </CardTitle>
            <CardDescription>{t("upload.productFeedDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                isDraggingProduct ? "border-primary bg-primary/5" : productFileName ? "border-green-500 bg-green-500/5" : "border-muted-foreground/25"
              }`}
              onDragOver={(e) => { e.preventDefault(); setIsDraggingProduct(true); }}
              onDragLeave={() => setIsDraggingProduct(false)}
              onDrop={handleProductDrop}
            >
              {productFileName ? (
                <div className="flex flex-col items-center gap-2">
                  <CheckCircle2 className="h-8 w-8 text-green-500" />
                  <p className="text-sm font-medium">{productFileName}</p>
                  <p className="text-xs text-muted-foreground">
                    {products?.length || 0} {t("stats.products")}
                  </p>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    id="product-file-input"
                    onChange={handleProductFileInput}
                  />
                  <Button asChild variant="outline" size="sm">
                    <label htmlFor="product-file-input" className="cursor-pointer">
                      {t("upload.changeFile")}
                    </label>
                  </Button>
                </div>
              ) : (
                <>
                  <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-sm font-medium">{t("upload.dragDrop")}</p>
                  <p className="text-xs text-muted-foreground mb-3">{t("upload.orClick")}</p>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    id="product-file-input"
                    onChange={handleProductFileInput}
                  />
                  <Button asChild variant="outline" size="sm">
                    <label htmlFor="product-file-input" className="cursor-pointer">
                      {t("upload.selectFile")}
                    </label>
                  </Button>
                  <p className="text-xs text-muted-foreground mt-3">
                    {t("upload.formats")}
                  </p>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Category Feed Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderTree className="h-5 w-5" />
              {t("upload.categoryFeed")}
            </CardTitle>
            <CardDescription>{t("upload.categoryFeedDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                isDraggingCategory ? "border-primary bg-primary/5" : categoryFileName ? "border-green-500 bg-green-500/5" : "border-muted-foreground/25"
              }`}
              onDragOver={(e) => { e.preventDefault(); setIsDraggingCategory(true); }}
              onDragLeave={() => setIsDraggingCategory(false)}
              onDrop={handleCategoryDrop}
            >
              {categoryFileName ? (
                <div className="flex flex-col items-center gap-2">
                  <CheckCircle2 className="h-8 w-8 text-green-500" />
                  <p className="text-sm font-medium">{categoryFileName}</p>
                  <p className="text-xs text-muted-foreground">
                    {categories?.length || 0} {t("upload.categories")}
                  </p>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv,.xml"
                    className="hidden"
                    id="category-file-input"
                    onChange={handleCategoryFileInput}
                  />
                  <Button asChild variant="outline" size="sm">
                    <label htmlFor="category-file-input" className="cursor-pointer">
                      {t("upload.changeFile")}
                    </label>
                  </Button>
                </div>
              ) : (
                <>
                  <FolderTree className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-sm font-medium">{t("upload.dragDrop")}</p>
                  <p className="text-xs text-muted-foreground mb-3">{t("upload.optional")}</p>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv,.xml"
                    className="hidden"
                    id="category-file-input"
                    onChange={handleCategoryFileInput}
                  />
                  <Button asChild variant="outline" size="sm">
                    <label htmlFor="category-file-input" className="cursor-pointer">
                      {t("upload.selectFile")}
                    </label>
                  </Button>
                  <p className="text-xs text-muted-foreground mt-3">
                    {t("upload.categoryFormats")}
                  </p>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Analysis in progress */}
      {isAnalyzing && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center gap-4">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p>{t("upload.analyzing")}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {report && (
        <div className="space-y-6">
          {/* Score Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                {t("scores.title")}
              </CardTitle>
              <CardDescription>
                {productFileName} • {report.totalProducts} {t("stats.products")}{categoryFileName && ` • ${t("upload.withCategoryFeed")}`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TooltipProvider delayDuration={200}>
                <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-9 gap-4">
                  <ScoreCard label={t("scores.overall")} score={report.scores.overall} isMain tooltipKey="overall" />
                  <ScoreCard label={t("scores.completeness")} score={report.scores.completeness} tooltipKey="completeness" />
                  <ScoreCard label={t("scores.quality")} score={report.scores.quality} tooltipKey="quality" />
                  <ScoreCard label={t("scores.uniqueness")} score={report.scores.uniqueness} tooltipKey="uniqueness" />
                  <ScoreCard label={t("scores.dataQuality")} score={report.scores.dataQuality} tooltipKey="dataQuality" />
                  <ScoreCard label={t("scores.stock")} score={report.scores.stock} tooltipKey="stock" />
                  <ScoreCard label={t("scores.categories")} score={report.scores.categories} tooltipKey="categories" />
                  <ScoreCard label={t("scores.business")} score={report.scores.business} tooltipKey="business" />
                  <ScoreCard label="SEO" score={report.scores.seo} tooltipKey="seo" />
                </div>
              </TooltipProvider>
            </CardContent>
          </Card>

          {/* AI Summary */}
          <AuditSummary report={report} t={t} />

          {/* Stats */}
          <TooltipProvider delayDuration={200}>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
              <StatCard value={report.stats.withImages} label={t("stats.withImages")} tooltipKey="withImages" />
              <StatCard value={report.stats.avgImageCount} label={t("stats.avgImages")} tooltipKey="avgImages" />
              <StatCard value={report.stats.withDescription} label={t("stats.withDescription")} tooltipKey="withDescription" />
              <StatCard value={report.stats.withEan} label={t("stats.withEan")} tooltipKey="withEan" />
              <StatCard value={report.stats.withManufacturer} label={t("stats.withManufacturer")} tooltipKey="withManufacturer" />
              <StatCard value={report.stats.totalCategories} label={t("stats.categories")} tooltipKey="categories" />
              <StatCard value={report.stats.totalVariants} label={t("stats.variants")} tooltipKey="variants" />
              <StatCard value={getTotalIssues(report)} label={t("stats.issues")} tooltipKey="issues" isError />
            </div>
          </TooltipProvider>

          {/* Detailed Results */}
          <Tabs defaultValue="completeness" className="w-full">
            <TabsList className="flex flex-wrap h-auto gap-1 p-1">
              <TabsTrigger value="completeness" className="flex items-center gap-1 text-xs">
                <ImageIcon className="h-3.5 w-3.5" />
                <span className="hidden md:inline">{t("tabs.completeness")}</span>
                <Badge variant="secondary" className="text-[10px] px-1">{report.completenessIssues.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="dataQuality" className="flex items-center gap-1 text-xs">
                <Database className="h-3.5 w-3.5" />
                <span className="hidden md:inline">{t("tabs.dataQuality")}</span>
                <Badge variant="secondary" className="text-[10px] px-1">{report.dataQualityIssues.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="variants" className="flex items-center gap-1 text-xs">
                <GitBranch className="h-3.5 w-3.5" />
                <span className="hidden md:inline">{t("tabs.variants")}</span>
                <Badge variant="secondary" className="text-[10px] px-1">{report.variantIssues.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="stock" className="flex items-center gap-1 text-xs">
                <Boxes className="h-3.5 w-3.5" />
                <span className="hidden md:inline">{t("tabs.stock")}</span>
                <Badge variant="secondary" className="text-[10px] px-1">{report.stockIssues.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="categories" className="flex items-center gap-1 text-xs">
                <FolderTree className="h-3.5 w-3.5" />
                <span className="hidden md:inline">{t("tabs.categories")}</span>
                <Badge variant="secondary" className="text-[10px] px-1">{report.categoryIssues.length + report.productCategoryIssues.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="duplicates" className="flex items-center gap-1 text-xs">
                <Copy className="h-3.5 w-3.5" />
                <span className="hidden md:inline">{t("tabs.duplicates")}</span>
                <Badge variant="secondary" className="text-[10px] px-1">{report.duplicateGroups.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="content" className="flex items-center gap-1 text-xs">
                <FileText className="h-3.5 w-3.5" />
                <span className="hidden md:inline">{t("tabs.content")}</span>
                <Badge variant="secondary" className="text-[10px] px-1">
                  {getIssuesByType('no_description').length +
                   getIssuesByType('too_short').length +
                   getIssuesByType('same_short_long').length +
                   getIssuesByType('lorem_ipsum').length +
                   getIssuesByType('test_content').length +
                   getIssuesByType('html_in_description').length +
                   getIssuesByType('url_in_description').length +
                   getIssuesByType('emoji_spam').length +
                   getIssuesByType('wrong_language').length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="price" className="flex items-center gap-1 text-xs">
                <DollarSign className="h-3.5 w-3.5" />
                <span className="hidden md:inline">{t("tabs.price")}</span>
                <Badge variant="secondary" className="text-[10px] px-1">{getBusinessIssuesByCategory('price').length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="promo" className="flex items-center gap-1 text-xs">
                <Tag className="h-3.5 w-3.5" />
                <span className="hidden md:inline">{t("tabs.promo")}</span>
                <Badge variant="secondary" className="text-[10px] px-1">{getBusinessIssuesByCategory('promo').length + getBusinessIssuesByCategory('availability').length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="seo" className="flex items-center gap-1 text-xs">
                <FileSearch className="h-3.5 w-3.5" />
                <span className="hidden md:inline">SEO</span>
                <Badge variant="secondary" className="text-[10px] px-1">{report.seoIssues.length}</Badge>
              </TabsTrigger>
            </TabsList>

            {/* Completeness Tab - NEW */}
            <TabsContent value="completeness" className="space-y-4 mt-4">
              <GenericIssueList
                issues={report.completenessIssues}
                title={t("tabs.completeness")}
                t={t}
              />
            </TabsContent>

            {/* Data Quality Tab - NEW */}
            <TabsContent value="dataQuality" className="space-y-4 mt-4">
              <GenericIssueList
                issues={report.dataQualityIssues}
                title={t("tabs.dataQuality")}
                t={t}
              />
            </TabsContent>

            {/* Variants Tab - NEW */}
            <TabsContent value="variants" className="space-y-4 mt-4">
              <GenericIssueList
                issues={report.variantIssues}
                title={t("tabs.variants")}
                t={t}
              />
            </TabsContent>

            {/* Stock Tab - NEW */}
            <TabsContent value="stock" className="space-y-4 mt-4">
              <GenericIssueList
                issues={report.stockIssues}
                title={t("tabs.stock")}
                t={t}
              />
            </TabsContent>

            {/* Categories Tab - NEW */}
            <TabsContent value="categories" className="space-y-4 mt-4">
              <CategoryIssueList
                categoryIssues={report.categoryIssues}
                productCategoryIssues={report.productCategoryIssues}
                t={t}
              />
            </TabsContent>

            {/* Duplicates Tab */}
            <TabsContent value="duplicates" className="space-y-4 mt-4">
              {report.duplicateGroups.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const codes = [...new Set(report.duplicateGroups.flatMap(g => g.products.map(p => p.code)))];
                        exportProductCodes(codes, "duplicitni-produkty");
                      }}
                      className="flex items-center gap-2"
                    >
                      <Download className="h-4 w-4" />
                      Export kódů ({[...new Set(report.duplicateGroups.flatMap(g => g.products.map(p => p.code)))].length})
                    </Button>
                  </div>
                  {report.duplicateGroups.slice(0, 10).map((group, idx) => (
                    <DuplicateGroupCard key={idx} group={group} t={t} />
                  ))}
                  {report.duplicateGroups.length > 10 && (
                    <p className="text-center text-muted-foreground">
                      {t("showMore", { count: report.duplicateGroups.length - 10 })}
                    </p>
                  )}
                </div>
              ) : (
                <NoIssuesCard t={t} />
              )}
            </TabsContent>

            {/* Content Tab (merged quality, content, language) */}
            <TabsContent value="content" className="space-y-4 mt-4">
              <IssueList
                issues={[
                  ...getIssuesByType('no_description'),
                  ...getIssuesByType('too_short'),
                  ...getIssuesByType('same_short_long'),
                  ...getIssuesByType('lorem_ipsum'),
                  ...getIssuesByType('test_content'),
                  ...getIssuesByType('html_in_description'),
                  ...getIssuesByType('url_in_description'),
                  ...getIssuesByType('emoji_spam'),
                  ...getIssuesByType('wrong_language'),
                ]}
                t={t}
              />
            </TabsContent>

            {/* Price Tab */}
            <TabsContent value="price" className="space-y-4 mt-4">
              <BusinessIssueList issues={getBusinessIssuesByCategory('price')} t={t} title={t("tabs.price")} />
            </TabsContent>

            {/* Promo Tab (merged with availability) */}
            <TabsContent value="promo" className="space-y-4 mt-4">
              <BusinessIssueList
                issues={[
                  ...getBusinessIssuesByCategory('promo'),
                  ...getBusinessIssuesByCategory('availability'),
                ]}
                t={t}
                title={t("tabs.promo")}
              />
            </TabsContent>

            {/* SEO Tab - Meta Description vs Product Title */}
            <TabsContent value="seo" className="space-y-4 mt-4">
              <SeoIssueList
                issues={report.seoIssues}
                t={t}
              />
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}

// Score tooltips explaining what each score means
const SCORE_TOOLTIPS: Record<string, string> = {
  overall: "Vážený průměr všech kategorií. 90+ = výborně, 70-89 = dobře, 50-69 = průměrně, pod 50 = potřebuje zlepšení.",
  completeness: "Měří úplnost produktových dat - obrázky, popisy, ceny, EAN, výrobce, kategorie. Každý chybějící údaj snižuje skóre.",
  quality: "Hodnotí kvalitu obsahu - absence Lorem Ipsum, testovacího obsahu, emoji spamu a URL v popisech.",
  uniqueness: "Penalizuje duplicitní a velmi podobné popisy produktů. Čím více unikátního obsahu, tím vyšší skóre.",
  dataQuality: "Kontroluje integritu dat - duplicitní kódy, EAN, HTML chyby, inline styly v popisech.",
  stock: "Hodnotí správnost skladových údajů - konzistence dostupnosti, záporné stavy, dlouhodobě vyprodané produkty.",
  categories: "Analyzuje strukturu kategorií - prázdné kategorie, příliš hluboké zanoření, produkty bez kategorie.",
  business: "Business logika - cenové anomálie, prošlé akce, podezřelé slevy, konflikty dostupnosti.",
  seo: "SEO kvalita - meta popisy, délky titulků, duplicity. Správné meta popisy zlepšují viditelnost ve vyhledávačích.",
};

// Stats tooltips explaining what each stat means
const STAT_TOOLTIPS: Record<string, string> = {
  withImages: "Počet produktů, které mají alespoň jeden obrázek. Produkty bez obrázků výrazně snižují konverze.",
  avgImages: "Průměrný počet obrázků na produkt. Doporučeno 3+ obrázků pro lepší prezentaci produktu.",
  withDescription: "Počet produktů s vyplněným dlouhým popisem. Popis je klíčový pro SEO a konverze.",
  withEan: "Počet produktů s EAN/GTIN kódem. EAN je povinný pro Google Shopping a Heureka.",
  withManufacturer: "Počet produktů s uvedeným výrobcem/značkou. Důležité pro filtry a vyhledávání.",
  categories: "Celkový počet unikátních kategorií v produktovém feedu.",
  variants: "Počet produktových variant (produkty s rodičovským kódem).",
  issues: "Celkový počet nalezených problémů ve všech kategoriích auditu.",
};

// Helper components

function ScoreCard({ label, score, isMain = false, tooltipKey }: { label: string; score: number; isMain?: boolean; tooltipKey?: string }) {
  const content = (
    <div className={`text-center p-4 rounded-lg ${getScoreBgColor(score)} ${isMain ? "col-span-2 md:col-span-1" : ""} ${tooltipKey ? "cursor-help" : ""}`}>
      <div className={`${isMain ? "text-4xl" : "text-3xl"} font-bold ${getScoreColor(score)}`}>{score}</div>
      <div className="text-base text-muted-foreground flex items-center justify-center gap-1">
        {label}
        {tooltipKey && <Info className="h-3 w-3 opacity-50" />}
      </div>
    </div>
  );

  if (tooltipKey && SCORE_TOOLTIPS[tooltipKey]) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p>{SCORE_TOOLTIPS[tooltipKey]}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return content;
}

function StatCard({ value, label, tooltipKey, isError = false }: { value: number | string; label: string; tooltipKey?: string; isError?: boolean }) {
  const content = (
    <Card className={tooltipKey ? "cursor-help" : ""}>
      <CardContent className="pt-4 text-center">
        <div className={`text-2xl font-bold ${isError ? "text-destructive" : ""}`}>{value}</div>
        <div className="text-sm text-muted-foreground flex items-center justify-center gap-1">
          {label}
          {tooltipKey && <Info className="h-3 w-3 opacity-50" />}
        </div>
      </CardContent>
    </Card>
  );

  if (tooltipKey && STAT_TOOLTIPS[tooltipKey]) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p>{STAT_TOOLTIPS[tooltipKey]}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return content;
}

function NoIssuesCard({ t }: { t: ReturnType<typeof useTranslations<"contentAudit">> }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 text-green-500">
          <CheckCircle2 className="h-5 w-5" />
          <span>{t("results.noIssues")}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function DuplicateGroupCard({
  group,
  t,
}: {
  group: DuplicateGroup;
  t: ReturnType<typeof useTranslations<"contentAudit">>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Copy className="h-5 w-5" />
          {group.type === "exact" ? t("duplicates.exact") : t("duplicates.near")}
          <Badge variant={group.type === "exact" ? "destructive" : "secondary"}>
            {group.similarity}%
          </Badge>
          <Badge variant="outline">{group.products.length} {t("duplicates.products")}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4 p-3 bg-muted rounded">
          {group.text}
        </p>
        <div className="flex flex-wrap gap-2">
          {group.products.map((p, idx) => (
            <Badge key={idx} variant="outline">
              {p.code}: {p.name.substring(0, 30)}...
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function IssueList({
  issues,
  t,
}: {
  issues: ContentIssue[];
  t: ReturnType<typeof useTranslations<"contentAudit">>;
}) {
  if (issues.length === 0) {
    return <NoIssuesCard t={t} />;
  }

  const handleExport = () => {
    const codes = [...new Set(issues.map(i => i.productCode))];
    exportProductCodes(codes, "problematicke-produkty-obsah");
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{t("tabs.content")}</CardTitle>
          <Button variant="outline" size="sm" onClick={handleExport} className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Export kódů ({[...new Set(issues.map(i => i.productCode))].length})
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="space-y-2">
          {issues.slice(0, 20).map((issue, idx) => (
            <div key={idx} className="flex flex-col gap-1 p-3 bg-muted rounded-lg text-base">
              <div className="flex items-center gap-2">
                {issue.severity === "error" ? (
                  <Badge variant="destructive">Error</Badge>
                ) : (
                  <Badge variant="secondary">Warning</Badge>
                )}
                <span className="font-medium">{issue.productCode}</span>
                <span className="text-muted-foreground truncate">{issue.productName}</span>
              </div>
              {issue.details && (
                <p className="text-muted-foreground text-sm ml-16">{issue.details}</p>
              )}
            </div>
          ))}
          {issues.length > 20 && (
            <p className="text-center text-muted-foreground text-base pt-2">
              {t("showMore", { count: issues.length - 20 })}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function BusinessIssueList({
  issues,
  t,
  title,
}: {
  issues: BusinessIssue[];
  t: ReturnType<typeof useTranslations<"contentAudit">>;
  title?: string;
}) {
  if (issues.length === 0) {
    return <NoIssuesCard t={t} />;
  }

  const handleExport = () => {
    const codes = [...new Set(issues.map(i => i.productCode))];
    exportProductCodes(codes, `problematicke-produkty-${title?.toLowerCase().replace(/\s+/g, '-') || 'business'}`);
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{title || t("tabs.price")}</CardTitle>
          <Button variant="outline" size="sm" onClick={handleExport} className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Export kódů ({[...new Set(issues.map(i => i.productCode))].length})
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="space-y-2">
          {issues.slice(0, 20).map((issue, idx) => (
            <div key={idx} className="flex flex-col gap-1 p-3 bg-muted rounded-lg text-base">
              <div className="flex items-center gap-2">
                {issue.severity === "error" ? (
                  <Badge variant="destructive">Error</Badge>
                ) : (
                  <Badge variant="secondary">Warning</Badge>
                )}
                <span className="font-medium">{issue.productCode}</span>
                <span className="text-muted-foreground truncate">{issue.productName}</span>
              </div>
              {issue.details && (
                <p className="text-muted-foreground text-sm ml-16">{issue.details}</p>
              )}
            </div>
          ))}
          {issues.length > 20 && (
            <p className="text-center text-muted-foreground text-base pt-2">
              {t("showMore", { count: issues.length - 20 })}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Generic issue list for new issue types
interface GenericIssue {
  productCode: string;
  productName: string;
  severity: 'error' | 'warning';
  details?: string;
  type: string;
}

function GenericIssueList({
  issues,
  title,
  t,
}: {
  issues: GenericIssue[];
  title: string;
  t: ReturnType<typeof useTranslations<"contentAudit">>;
}) {
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set());

  if (issues.length === 0) {
    return <NoIssuesCard t={t} />;
  }

  // Group by type
  const grouped = issues.reduce((acc, issue) => {
    if (!acc[issue.type]) acc[issue.type] = [];
    acc[issue.type].push(issue);
    return acc;
  }, {} as Record<string, GenericIssue[]>);

  const toggleExpand = (type: string) => {
    setExpandedTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const handleExportAll = () => {
    const codes = [...new Set(issues.map(i => i.productCode))];
    exportProductCodes(codes, `problematicke-produkty-${title.toLowerCase().replace(/\s+/g, '-')}`);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">{title}</CardTitle>
            <CardDescription>
              {issues.filter(i => i.severity === 'error').length} chyb, {issues.filter(i => i.severity === 'warning').length} varování
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={handleExportAll} className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Export kódů ({[...new Set(issues.map(i => i.productCode))].length})
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {Object.entries(grouped).map(([type, typeIssues]) => {
            const isExpanded = expandedTypes.has(type);
            const displayCount = isExpanded ? typeIssues.length : 5;

            return (
              <div key={type} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant={typeIssues[0].severity === 'error' ? 'destructive' : 'secondary'}>
                    {typeIssues.length}
                  </Badge>
                  <span className="font-medium text-base">{type.replace(/_/g, ' ')}</span>
                </div>
                <div className="space-y-1 pl-4 border-l-2 border-muted">
                  {typeIssues.slice(0, displayCount).map((issue, idx) => (
                    <div key={idx} className="flex flex-col p-2 bg-muted/50 rounded text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{issue.productCode}</span>
                        <span className="text-muted-foreground truncate">{issue.productName}</span>
                      </div>
                      {issue.details && (
                        <p className="text-muted-foreground text-xs mt-1">{issue.details}</p>
                      )}
                    </div>
                  ))}
                  {typeIssues.length > 5 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-sm h-8 px-3"
                      onClick={() => toggleExpand(type)}
                    >
                      {isExpanded
                        ? "Skrýt"
                        : `Zobrazit všech ${typeIssues.length}`}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// Category issues list
function CategoryIssueList({
  categoryIssues,
  productCategoryIssues,
  t,
}: {
  categoryIssues: CategoryIssue[];
  productCategoryIssues: ProductCategoryIssue[];
  t: ReturnType<typeof useTranslations<"contentAudit">>;
}) {
  if (categoryIssues.length === 0 && productCategoryIssues.length === 0) {
    return <NoIssuesCard t={t} />;
  }

  const handleExportProductCodes = () => {
    const codes = [...new Set(productCategoryIssues.map(i => i.productCode))];
    exportProductCodes(codes, "problematicke-produkty-kategorie");
  };

  return (
    <div className="space-y-4">
      {categoryIssues.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Struktura kategorií</CardTitle>
            <CardDescription>
              {categoryIssues.filter(i => i.severity === 'error').length} chyb, {categoryIssues.filter(i => i.severity === 'warning').length} varování
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {categoryIssues.slice(0, 20).map((issue, idx) => {
                // Check if categoryName looks like a code (only numbers/short)
                const looksLikeCode = issue.categoryName && (
                  /^\d+$/.test(issue.categoryName) || // only numbers
                  issue.categoryName.length <= 5 // very short
                );
                // Prefer path if name looks like a code
                const displayName = looksLikeCode && issue.categoryPath
                  ? issue.categoryPath
                  : (issue.categoryName || issue.categoryPath || "Neznámá kategorie");
                // Show code in badge if we're showing path as name
                const showCodeBadge = looksLikeCode && issue.categoryName;
                return (
                  <div key={idx} className="flex flex-col gap-1 p-3 bg-muted rounded-lg text-base">
                    <div className="flex items-center gap-2">
                      {issue.severity === "error" ? (
                        <Badge variant="destructive">Error</Badge>
                      ) : (
                        <Badge variant="secondary">Warning</Badge>
                      )}
                      <span className="font-medium">{displayName}</span>
                      {showCodeBadge && (
                        <Badge variant="outline" className="text-[10px]">#{issue.categoryName}</Badge>
                      )}
                      {issue.productCount !== undefined && (
                        <Badge variant="outline">{issue.productCount} produktů</Badge>
                      )}
                    </div>
                    {issue.categoryPath && issue.categoryPath !== displayName && (
                      <p className="text-muted-foreground text-sm ml-16">{issue.categoryPath}</p>
                    )}
                    {issue.details && (
                      <p className="text-muted-foreground text-sm ml-16">{issue.details}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {productCategoryIssues.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Zařazení produktů</CardTitle>
                <CardDescription>
                  {productCategoryIssues.filter(i => i.severity === 'error').length} chyb, {productCategoryIssues.filter(i => i.severity === 'warning').length} varování
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={handleExportProductCodes} className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                Export kódů ({[...new Set(productCategoryIssues.map(i => i.productCode))].length})
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {productCategoryIssues.slice(0, 20).map((issue, idx) => (
                <div key={idx} className="flex flex-col gap-1 p-3 bg-muted rounded-lg text-base">
                  <div className="flex items-center gap-2">
                    {issue.severity === "error" ? (
                      <Badge variant="destructive">Error</Badge>
                    ) : (
                      <Badge variant="secondary">Warning</Badge>
                    )}
                    <span className="font-medium">{issue.productCode}</span>
                    <span className="text-muted-foreground truncate">{issue.productName}</span>
                  </div>
                  {issue.details && (
                    <p className="text-muted-foreground text-sm ml-16">{issue.details}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// SEO Issue types with explanations
const SEO_ISSUE_EXPLANATIONS: Record<string, { title: string; description: string; fix: string }> = {
  no_meta_description: {
    title: "Chybí meta popis",
    description: "Produkt nemá vyplněný meta popis (meta description). Google zobrazí automaticky vygenerovaný text z popisu produktu.",
    fix: "Přidejte jedinečný meta popis (70-160 znaků) popisující produkt a obsahující klíčová slova.",
  },
  meta_too_short: {
    title: "Meta popis příliš krátký",
    description: "Meta popis má méně než 70 znaků. Nevyužíváte plný potenciál pro zobrazení ve vyhledávači.",
    fix: "Rozšiřte meta popis na 70-160 znaků. Zahrňte hlavní výhody produktu a výzvu k akci.",
  },
  meta_too_long: {
    title: "Meta popis příliš dlouhý",
    description: "Meta popis přesahuje 160 znaků. Google ho ve výsledcích vyhledávání ořízne.",
    fix: "Zkraťte meta popis na max. 160 znaků. Nejdůležitější informace dejte na začátek.",
  },
  meta_same_as_title: {
    title: "Meta popis = název produktu",
    description: "Meta popis je identický s názvem produktu. To je ztráta příležitosti pro SEO.",
    fix: "Napište unikátní meta popis, který rozšíří informace z názvu o benefity a vlastnosti.",
  },
  meta_contains_title: {
    title: "Meta popis obsahuje jen název",
    description: "Meta popis je příliš podobný názvu produktu - neobsahuje dostatek přidané hodnoty.",
    fix: "Rozšiřte meta popis o další informace - výhody, použití, parametry produktu.",
  },
  meta_same_as_short_desc: {
    title: "Meta popis = krátký popis",
    description: "Meta popis je stejný jako krátký popis produktu. Zvažte optimalizaci pro vyhledávače.",
    fix: "Meta popis optimalizujte pro vyhledávače (klíčová slova, CTA), krátký popis pro zákazníky na webu.",
  },
  title_too_long: {
    title: "Název produktu příliš dlouhý",
    description: "Název produktu přesahuje 70 znaků. Ve výsledcích vyhledávání bude oříznut.",
    fix: "Zkraťte název nebo přesuňte méně důležité informace do parametrů/popisu.",
  },
  title_too_short: {
    title: "Název produktu příliš krátký",
    description: "Název produktu má méně než 10 znaků. Pravděpodobně není dostatečně popisný.",
    fix: "Rozšiřte název o specifikace - značku, model, hlavní parametr (velikost, barvu).",
  },
  duplicate_meta_description: {
    title: "Duplicitní meta popis",
    description: "Více produktů má stejný meta popis. Google může některé produkty považovat za duplicitní obsah.",
    fix: "Napište unikátní meta popis pro každý produkt. Použijte šablonu s proměnnými pokud je produktů mnoho.",
  },
};

function SeoIssueList({
  issues,
  t,
}: {
  issues: SeoIssue[];
  t: ReturnType<typeof useTranslations<"contentAudit">>;
}) {
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set());

  if (issues.length === 0) {
    return <NoIssuesCard t={t} />;
  }

  // Group by type
  const grouped = issues.reduce((acc, issue) => {
    if (!acc[issue.type]) acc[issue.type] = [];
    acc[issue.type].push(issue);
    return acc;
  }, {} as Record<string, SeoIssue[]>);

  const toggleExpand = (type: string) => {
    setExpandedTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const handleExportAll = () => {
    const codes = [...new Set(issues.map(i => i.productCode))];
    exportProductCodes(codes, 'seo-problemy');
  };

  const handleExportByType = (type: string, typeIssues: SeoIssue[]) => {
    const codes = [...new Set(typeIssues.map(i => i.productCode))];
    exportProductCodes(codes, `seo-${type.replace(/_/g, '-')}`);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileSearch className="h-5 w-5" />
              SEO analýza - Meta Description vs Title
            </CardTitle>
            <CardDescription>
              {issues.filter(i => i.severity === 'error').length} kritických, {issues.filter(i => i.severity === 'warning').length} doporučení
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={handleExportAll} className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Export kódů ({[...new Set(issues.map(i => i.productCode))].length})
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {Object.entries(grouped).map(([type, typeIssues]) => {
            const isExpanded = expandedTypes.has(type);
            const displayCount = isExpanded ? typeIssues.length : 3;
            const explanation = SEO_ISSUE_EXPLANATIONS[type];

            return (
              <div key={type} className="space-y-3">
                {/* Issue Type Header with Explanation */}
                <div className="p-4 bg-muted/30 rounded-lg border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge variant={typeIssues[0].severity === 'error' ? 'destructive' : 'secondary'} className="text-sm">
                        {typeIssues.length}
                      </Badge>
                      <span className="font-semibold text-base">{explanation?.title || type.replace(/_/g, ' ')}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleExportByType(type, typeIssues)}
                      className="text-xs"
                    >
                      <Download className="h-3 w-3 mr-1" />
                      Export
                    </Button>
                  </div>
                  {explanation && (
                    <div className="mt-3 space-y-2 text-sm">
                      <p className="text-muted-foreground">{explanation.description}</p>
                      <div className="flex items-start gap-2 p-2 bg-green-50 dark:bg-green-950/30 rounded border border-green-200 dark:border-green-900">
                        <Lightbulb className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                        <span className="text-green-700 dark:text-green-400">{explanation.fix}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Issue List */}
                <div className="space-y-1 pl-4 border-l-2 border-muted">
                  {typeIssues.slice(0, displayCount).map((issue, idx) => (
                    <div key={idx} className="flex flex-col p-3 bg-muted/50 rounded text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium text-primary">{issue.productCode}</span>
                        <span className="text-muted-foreground truncate">{issue.productName}</span>
                      </div>
                      {issue.details && (
                        <p className="text-muted-foreground text-xs mt-1">{issue.details}</p>
                      )}
                      {issue.metaDescription && (
                        <div className="mt-2 p-2 bg-background rounded border text-xs">
                          <span className="text-muted-foreground">Meta popis: </span>
                          <span className="italic">&quot;{issue.metaDescription}&quot;</span>
                        </div>
                      )}
                      {issue.relatedProducts && issue.relatedProducts.length > 0 && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          Stejný meta popis: {issue.relatedProducts.slice(0, 3).join(', ')}
                          {issue.relatedProducts.length > 3 && ` a ${issue.relatedProducts.length - 3} dalších`}
                        </div>
                      )}
                    </div>
                  ))}
                  {typeIssues.length > 3 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-sm h-8 px-3"
                      onClick={() => toggleExpand(type)}
                    >
                      {isExpanded
                        ? "Skrýt"
                        : `Zobrazit všech ${typeIssues.length}`}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// Helper function to get total issues count
function getTotalIssues(report: ContentAuditReport): number {
  return (
    report.issues.length +
    report.businessIssues.length +
    report.completenessIssues.length +
    report.dataQualityIssues.length +
    report.variantIssues.length +
    report.stockIssues.length +
    report.categoryIssues.length +
    report.productCategoryIssues.length +
    report.seoIssues.length
  );
}

// AI Summary component - generates a summary of the audit with recommendations
function AuditSummary({ report, t }: { report: ContentAuditReport; t: ReturnType<typeof useTranslations<"contentAudit">> }) {
  const [isOpen, setIsOpen] = useState(true);
  const [copied, setCopied] = useState(false);

  // Calculate severity levels
  const totalIssues = getTotalIssues(report);
  const errorCount =
    report.issues.filter(i => i.severity === 'error').length +
    report.businessIssues.filter(i => i.severity === 'error').length +
    report.completenessIssues.filter(i => i.severity === 'error').length +
    report.dataQualityIssues.filter(i => i.severity === 'error').length +
    report.variantIssues.filter(i => i.severity === 'error').length +
    report.stockIssues.filter(i => i.severity === 'error').length +
    report.categoryIssues.filter(i => i.severity === 'error').length +
    report.productCategoryIssues.filter(i => i.severity === 'error').length +
    report.seoIssues.filter(i => i.severity === 'error').length;

  const warningCount = totalIssues - errorCount;

  // Determine overall health
  const healthLevel = report.scores.overall >= 90 ? 'excellent' :
                     report.scores.overall >= 70 ? 'good' :
                     report.scores.overall >= 50 ? 'average' : 'critical';

  const healthColors = {
    excellent: 'text-green-600 bg-green-50 border-green-200',
    good: 'text-blue-600 bg-blue-50 border-blue-200',
    average: 'text-yellow-600 bg-yellow-50 border-yellow-200',
    critical: 'text-red-600 bg-red-50 border-red-200',
  };

  const healthEmoji = {
    excellent: '🎉',
    good: '👍',
    average: '⚠️',
    critical: '🚨',
  };

  const healthText = {
    excellent: 'Výborný stav',
    good: 'Dobrý stav',
    average: 'Průměrný stav',
    critical: 'Kritický stav',
  };

  // Generate priority recommendations based on worst scores
  const getPriorityRecommendations = () => {
    const scoreEntries = [
      { key: 'completeness', score: report.scores.completeness, label: 'Kompletnost dat', fix: 'Doplňte chybějící obrázky, popisy, EAN kódy a výrobce u produktů.' },
      { key: 'quality', score: report.scores.quality, label: 'Kvalita obsahu', fix: 'Odstraňte testovací obsah, Lorem Ipsum a URL z popisů produktů.' },
      { key: 'uniqueness', score: report.scores.uniqueness, label: 'Unikátnost', fix: 'Přepište duplicitní popisy produktů pro lepší SEO.' },
      { key: 'dataQuality', score: report.scores.dataQuality, label: 'Kvalita dat', fix: 'Opravte duplicitní kódy, EAN a HTML chyby v popisech.' },
      { key: 'stock', score: report.scores.stock, label: 'Skladové údaje', fix: 'Zkontrolujte konzistenci dostupnosti a opravte záporné stavy.' },
      { key: 'categories', score: report.scores.categories, label: 'Struktura kategorií', fix: 'Odstraňte prázdné kategorie a produkty bez kategorie.' },
      { key: 'business', score: report.scores.business, label: 'Business logika', fix: 'Opravte cenové anomálie a prošlé akce.' },
      { key: 'seo', score: report.scores.seo, label: 'SEO kvalita', fix: 'Vyplňte meta popisy, zkraťte příliš dlouhé názvy a odstraňte duplicity.' },
    ];

    return scoreEntries
      .filter(e => e.score < 80)
      .sort((a, b) => a.score - b.score)
      .slice(0, 5);
  };

  const priorities = getPriorityRecommendations();

  // Generate summary text for export
  const generateSummaryText = () => {
    const lines = [
      `AUDIT OBSAHU PRODUKTŮ`,
      `Datum: ${new Date(report.analyzedAt).toLocaleDateString('cs-CZ')}`,
      `Počet produktů: ${report.totalProducts}`,
      ``,
      `CELKOVÉ HODNOCENÍ: ${report.scores.overall}/100 (${healthText[healthLevel]})`,
      ``,
      `SKÓRE PO KATEGORIÍCH:`,
      `• Kompletnost: ${report.scores.completeness}/100`,
      `• Kvalita obsahu: ${report.scores.quality}/100`,
      `• Unikátnost: ${report.scores.uniqueness}/100`,
      `• Kvalita dat: ${report.scores.dataQuality}/100`,
      `• Skladové údaje: ${report.scores.stock}/100`,
      `• Kategorie: ${report.scores.categories}/100`,
      `• SEO: ${report.scores.seo}/100`,
      `• Business logika: ${report.scores.business}/100`,
      ``,
      `NALEZENÉ PROBLÉMY:`,
      `• Celkem problémů: ${totalIssues}`,
      `• Chyb (kritických): ${errorCount}`,
      `• Varování: ${warningCount}`,
      ``,
    ];

    if (priorities.length > 0) {
      lines.push(`PRIORITNÍ OBLASTI K ŘEŠENÍ:`);
      priorities.forEach((p, i) => {
        lines.push(`${i + 1}. ${p.label} (${p.score}/100)`);
        lines.push(`   → ${p.fix}`);
      });
    }

    return lines.join('\n');
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generateSummaryText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleDownload = () => {
    const text = generateSummaryText();
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `audit-summary-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  return (
    <Card className={`border-2 ${healthColors[healthLevel]}`}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CollapsibleTrigger asChild>
              <button className="flex items-center gap-3 text-left">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  <CardTitle className="text-lg">Shrnutí auditu</CardTitle>
                </div>
                <Badge className={healthColors[healthLevel]}>
                  {healthEmoji[healthLevel]} {healthText[healthLevel]}
                </Badge>
                <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </button>
            </CollapsibleTrigger>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleCopy}>
                <ClipboardCopy className="h-4 w-4 mr-1" />
                {copied ? "Zkopírováno!" : "Kopírovat"}
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="h-4 w-4 mr-1" />
                Export TXT
              </Button>
            </div>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-4">
            {/* Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-background rounded-lg border">
                <div className="text-4xl font-bold text-center">{report.totalProducts}</div>
                <div className="text-sm text-muted-foreground text-center">produktů analyzováno</div>
              </div>
              <div className="p-4 bg-background rounded-lg border">
                <div className="text-4xl font-bold text-center text-destructive">{errorCount}</div>
                <div className="text-sm text-muted-foreground text-center">kritických chyb</div>
              </div>
              <div className="p-4 bg-background rounded-lg border">
                <div className="text-4xl font-bold text-center text-yellow-600">{warningCount}</div>
                <div className="text-sm text-muted-foreground text-center">varování</div>
              </div>
            </div>

            {/* Priority Recommendations */}
            {priorities.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Prioritní oblasti k řešení (seřazeno dle závažnosti)
                </h4>
                <div className="space-y-2">
                  {priorities.map((p, i) => (
                    <div key={p.key} className="flex items-start gap-3 p-3 bg-background rounded-lg border">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        p.score < 50 ? 'bg-red-100 text-red-700' :
                        p.score < 70 ? 'bg-yellow-100 text-yellow-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {i + 1}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{p.label}</span>
                          <Badge variant="outline">{p.score}/100</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{p.fix}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick wins */}
            {report.scores.overall >= 70 && priorities.length === 0 && (
              <div className="p-4 bg-green-50 border-green-200 rounded-lg border">
                <div className="flex items-center gap-2 text-green-700">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-medium">Skvělá práce!</span>
                </div>
                <p className="text-sm text-green-600 mt-1">
                  Vaše produktová data jsou v dobrém stavu. Pro další zlepšení se zaměřte na drobné nedostatky v jednotlivých kategoriích.
                </p>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

// Supported fields for product feed
const SUPPORTED_PRODUCT_FIELDS = {
  required: [
    { name: 'code', czech: 'Kód', description: 'Unikátní identifikátor produktu' },
    { name: 'name', czech: 'Název', description: 'Název produktu' },
  ],
  content: [
    { name: 'shortDescription', czech: 'Krátký popis / perex', description: 'Krátký popis produktu' },
    { name: 'description', czech: 'Popis / Dlouhý popis', description: 'Hlavní popis produktu' },
    { name: 'metaDescription', czech: 'Meta popis / SEO popis', description: 'Meta description pro vyhledávače' },
    { name: 'metaTitle', czech: 'Meta titulek / SEO titulek', description: 'Meta title pro vyhledávače' },
  ],
  category: [
    { name: 'defaultCategory', czech: 'Kategorie / Výchozí kategorie', description: 'Hlavní kategorie produktu' },
    { name: 'categoryText', czech: 'Cesta kategorie', description: 'Plná cesta kategorie (např. Elektronika > Mobily)' },
  ],
  price: [
    { name: 'price', czech: 'Cena / Cena s DPH', description: 'Prodejní cena' },
    { name: 'priceBeforeDiscount', czech: 'Cena před slevou / Původní cena', description: 'Původní cena před slevou' },
    { name: 'purchasePrice', czech: 'Nákupní cena', description: 'Nákupní/vstupní cena' },
  ],
  availability: [
    { name: 'availability', czech: 'Dostupnost', description: 'Text dostupnosti' },
    { name: 'stock', czech: 'Skladem / Množství', description: 'Počet kusů na skladě' },
    { name: 'deliveryDays', czech: 'Dodací doba', description: 'Počet dnů dodání' },
  ],
  details: [
    { name: 'ean', czech: 'EAN / GTIN', description: 'Čárový kód produktu' },
    { name: 'manufacturer', czech: 'Výrobce', description: 'Název výrobce' },
    { name: 'brand', czech: 'Značka', description: 'Značka produktu' },
    { name: 'warranty', czech: 'Záruka', description: 'Délka záruky' },
    { name: 'weight', czech: 'Hmotnost', description: 'Hmotnost produktu' },
  ],
  images: [
    { name: 'image', czech: 'Obrázek / Hlavní obrázek', description: 'URL hlavního obrázku' },
    { name: 'imageCount', czech: 'Počet obrázků', description: 'Celkový počet obrázků' },
  ],
  flags: [
    { name: 'isAction', czech: 'Akce / V akci', description: 'Příznak akční nabídky' },
    { name: 'isNew', czech: 'Novinka', description: 'Příznak novinky' },
    { name: 'isVisible', czech: 'Viditelný / Aktivní', description: 'Příznak viditelnosti' },
    { name: 'actionEndDate', czech: 'Konec akce', description: 'Datum ukončení akce' },
  ],
  variants: [
    { name: 'parentCode', czech: 'Kód rodiče / Nadřazený produkt', description: 'Kód hlavního produktu pro varianty' },
  ],
};

// Feed explanations collapsible card
function FeedExplanationsCard({ t }: { t: ReturnType<typeof useTranslations<"contentAudit">> }) {
  const [isOpen, setIsOpen] = useState(false);
  const [showAllFields, setShowAllFields] = useState(false);

  return (
    <Card className="bg-blue-500/5 border-blue-500/20">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-3">
          <CollapsibleTrigger asChild>
            <button className="flex items-center justify-between w-full text-left">
              <div className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-blue-500" />
                <CardTitle className="text-base">{t("feedExplanations.title")}</CardTitle>
              </div>
              <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </button>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-4">
            {/* Product Feed */}
            <div className="p-4 bg-background rounded-lg border space-y-2">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" />
                <h4 className="font-medium text-base">{t("feedExplanations.productFeed.title")}</h4>
              </div>
              <p className="text-sm text-muted-foreground">{t("feedExplanations.productFeed.description")}</p>
              <div className="bg-muted p-3 rounded text-sm">
                <p className="font-medium mb-1">📁 {t("feedExplanations.productFeed.howToGet")}</p>
                <p className="text-muted-foreground text-xs mt-2">{t("feedExplanations.productFeed.requiredColumns")}</p>
              </div>
              <p className="text-xs text-muted-foreground italic">{t("feedExplanations.productFeed.note")}</p>
            </div>

            {/* Supported Fields - Detailed List */}
            <div className="p-4 bg-background rounded-lg border space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-primary" />
                  <h4 className="font-medium text-base">Podporované sloupce v produktovém feedu</h4>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAllFields(!showAllFields)}
                  className="text-xs"
                >
                  {showAllFields ? "Skrýt detaily" : "Zobrazit všechny sloupce"}
                </Button>
              </div>

              <p className="text-sm text-muted-foreground">
                Čím více sloupců zahrnete do exportu, tím podrobnější bude analýza. Níže je seznam všech podporovaných polí.
              </p>

              {/* Quick summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <div className="p-2 bg-red-50 dark:bg-red-950/30 rounded border border-red-200 dark:border-red-900">
                  <span className="font-medium text-red-700 dark:text-red-400">Povinné:</span>
                  <span className="ml-1">code, name</span>
                </div>
                <div className="p-2 bg-blue-50 dark:bg-blue-950/30 rounded border border-blue-200 dark:border-blue-900">
                  <span className="font-medium text-blue-700 dark:text-blue-400">SEO:</span>
                  <span className="ml-1">metaDescription, metaTitle</span>
                </div>
                <div className="p-2 bg-green-50 dark:bg-green-950/30 rounded border border-green-200 dark:border-green-900">
                  <span className="font-medium text-green-700 dark:text-green-400">Obsah:</span>
                  <span className="ml-1">description, shortDescription</span>
                </div>
                <div className="p-2 bg-yellow-50 dark:bg-yellow-950/30 rounded border border-yellow-200 dark:border-yellow-900">
                  <span className="font-medium text-yellow-700 dark:text-yellow-400">Business:</span>
                  <span className="ml-1">price, stock, ean</span>
                </div>
              </div>

              {/* Detailed fields list */}
              {showAllFields && (
                <div className="space-y-4 mt-4">
                  {/* Required */}
                  <div>
                    <h5 className="text-sm font-semibold text-red-600 dark:text-red-400 mb-2 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-red-500"></span>
                      Povinné sloupce
                    </h5>
                    <div className="grid gap-1">
                      {SUPPORTED_PRODUCT_FIELDS.required.map(field => (
                        <div key={field.name} className="flex items-center gap-2 text-xs p-1.5 bg-muted/50 rounded">
                          <code className="font-mono bg-background px-1.5 py-0.5 rounded border">{field.name}</code>
                          <span className="text-muted-foreground">nebo</span>
                          <code className="font-mono bg-background px-1.5 py-0.5 rounded border">{field.czech}</code>
                          <span className="text-muted-foreground ml-auto">{field.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Content */}
                  <div>
                    <h5 className="text-sm font-semibold text-blue-600 dark:text-blue-400 mb-2 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                      Obsah a SEO
                    </h5>
                    <div className="grid gap-1">
                      {SUPPORTED_PRODUCT_FIELDS.content.map(field => (
                        <div key={field.name} className="flex items-center gap-2 text-xs p-1.5 bg-muted/50 rounded">
                          <code className="font-mono bg-background px-1.5 py-0.5 rounded border">{field.name}</code>
                          <span className="text-muted-foreground">nebo</span>
                          <code className="font-mono bg-background px-1.5 py-0.5 rounded border">{field.czech}</code>
                          <span className="text-muted-foreground ml-auto">{field.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Category */}
                  <div>
                    <h5 className="text-sm font-semibold text-purple-600 dark:text-purple-400 mb-2 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                      Kategorie
                    </h5>
                    <div className="grid gap-1">
                      {SUPPORTED_PRODUCT_FIELDS.category.map(field => (
                        <div key={field.name} className="flex items-center gap-2 text-xs p-1.5 bg-muted/50 rounded">
                          <code className="font-mono bg-background px-1.5 py-0.5 rounded border">{field.name}</code>
                          <span className="text-muted-foreground">nebo</span>
                          <code className="font-mono bg-background px-1.5 py-0.5 rounded border">{field.czech}</code>
                          <span className="text-muted-foreground ml-auto">{field.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Price */}
                  <div>
                    <h5 className="text-sm font-semibold text-green-600 dark:text-green-400 mb-2 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-green-500"></span>
                      Ceny
                    </h5>
                    <div className="grid gap-1">
                      {SUPPORTED_PRODUCT_FIELDS.price.map(field => (
                        <div key={field.name} className="flex items-center gap-2 text-xs p-1.5 bg-muted/50 rounded">
                          <code className="font-mono bg-background px-1.5 py-0.5 rounded border">{field.name}</code>
                          <span className="text-muted-foreground">nebo</span>
                          <code className="font-mono bg-background px-1.5 py-0.5 rounded border">{field.czech}</code>
                          <span className="text-muted-foreground ml-auto">{field.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Availability */}
                  <div>
                    <h5 className="text-sm font-semibold text-orange-600 dark:text-orange-400 mb-2 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                      Dostupnost a sklad
                    </h5>
                    <div className="grid gap-1">
                      {SUPPORTED_PRODUCT_FIELDS.availability.map(field => (
                        <div key={field.name} className="flex items-center gap-2 text-xs p-1.5 bg-muted/50 rounded">
                          <code className="font-mono bg-background px-1.5 py-0.5 rounded border">{field.name}</code>
                          <span className="text-muted-foreground">nebo</span>
                          <code className="font-mono bg-background px-1.5 py-0.5 rounded border">{field.czech}</code>
                          <span className="text-muted-foreground ml-auto">{field.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Details */}
                  <div>
                    <h5 className="text-sm font-semibold text-cyan-600 dark:text-cyan-400 mb-2 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-cyan-500"></span>
                      Detaily produktu
                    </h5>
                    <div className="grid gap-1">
                      {SUPPORTED_PRODUCT_FIELDS.details.map(field => (
                        <div key={field.name} className="flex items-center gap-2 text-xs p-1.5 bg-muted/50 rounded">
                          <code className="font-mono bg-background px-1.5 py-0.5 rounded border">{field.name}</code>
                          <span className="text-muted-foreground">nebo</span>
                          <code className="font-mono bg-background px-1.5 py-0.5 rounded border">{field.czech}</code>
                          <span className="text-muted-foreground ml-auto">{field.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Images */}
                  <div>
                    <h5 className="text-sm font-semibold text-pink-600 dark:text-pink-400 mb-2 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-pink-500"></span>
                      Obrázky
                    </h5>
                    <div className="grid gap-1">
                      {SUPPORTED_PRODUCT_FIELDS.images.map(field => (
                        <div key={field.name} className="flex items-center gap-2 text-xs p-1.5 bg-muted/50 rounded">
                          <code className="font-mono bg-background px-1.5 py-0.5 rounded border">{field.name}</code>
                          <span className="text-muted-foreground">nebo</span>
                          <code className="font-mono bg-background px-1.5 py-0.5 rounded border">{field.czech}</code>
                          <span className="text-muted-foreground ml-auto">{field.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Flags */}
                  <div>
                    <h5 className="text-sm font-semibold text-amber-600 dark:text-amber-400 mb-2 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                      Příznaky a stavy
                    </h5>
                    <div className="grid gap-1">
                      {SUPPORTED_PRODUCT_FIELDS.flags.map(field => (
                        <div key={field.name} className="flex items-center gap-2 text-xs p-1.5 bg-muted/50 rounded">
                          <code className="font-mono bg-background px-1.5 py-0.5 rounded border">{field.name}</code>
                          <span className="text-muted-foreground">nebo</span>
                          <code className="font-mono bg-background px-1.5 py-0.5 rounded border">{field.czech}</code>
                          <span className="text-muted-foreground ml-auto">{field.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Variants */}
                  <div>
                    <h5 className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 mb-2 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                      Varianty
                    </h5>
                    <div className="grid gap-1">
                      {SUPPORTED_PRODUCT_FIELDS.variants.map(field => (
                        <div key={field.name} className="flex items-center gap-2 text-xs p-1.5 bg-muted/50 rounded">
                          <code className="font-mono bg-background px-1.5 py-0.5 rounded border">{field.name}</code>
                          <span className="text-muted-foreground">nebo</span>
                          <code className="font-mono bg-background px-1.5 py-0.5 rounded border">{field.czech}</code>
                          <span className="text-muted-foreground ml-auto">{field.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Note about column names */}
                  <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded border border-blue-200 dark:border-blue-900 text-xs">
                    <p className="font-medium text-blue-700 dark:text-blue-400 mb-1">💡 Tip k názvům sloupců</p>
                    <p className="text-blue-600 dark:text-blue-300">
                      Systém rozpozná sloupce jak v anglickém, tak v českém pojmenování. Můžete použít i verzálky (např. CODE, NAME).
                      Pokud váš export obsahuje jiné názvy sloupců, přejmenujte je před nahráním.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Category Feed */}
            <div className="p-4 bg-background rounded-lg border space-y-2">
              <div className="flex items-center gap-2">
                <FolderTree className="h-4 w-4 text-primary" />
                <h4 className="font-medium text-base">{t("feedExplanations.categoryFeed.title")}</h4>
                <Badge variant="outline" className="text-xs">Volitelné</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{t("feedExplanations.categoryFeed.description")}</p>
              <div className="bg-muted p-3 rounded text-sm">
                <p className="font-medium mb-1">📁 {t("feedExplanations.categoryFeed.howToGet")}</p>
                <p className="text-muted-foreground text-xs mt-2">{t("feedExplanations.categoryFeed.xmlNote")}</p>
              </div>
              <p className="text-xs text-muted-foreground">{t("feedExplanations.categoryFeed.columns")}</p>
              <p className="text-xs text-muted-foreground italic">{t("feedExplanations.categoryFeed.optional")}</p>
            </div>

            {/* Tips */}
            <div className="p-4 bg-yellow-500/5 border-yellow-500/20 rounded-lg border space-y-2">
              <div className="flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-yellow-600" />
                <h4 className="font-medium text-base">{t("feedExplanations.tips.title")}</h4>
              </div>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>{t("feedExplanations.tips.tip1")}</li>
                <li>{t("feedExplanations.tips.tip2")}</li>
                <li>{t("feedExplanations.tips.tip3")}</li>
              </ul>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
