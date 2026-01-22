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
} from "lucide-react";
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
  type CategoryData,
  type ProductData,
} from "@/lib/content-audit/analyzer";

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
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
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
                    accept=".xlsx,.xls"
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
                    accept=".xlsx,.xls"
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
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
                <ScoreCard label={t("scores.overall")} score={report.scores.overall} isMain />
                <ScoreCard label={t("scores.completeness")} score={report.scores.completeness} />
                <ScoreCard label={t("scores.quality")} score={report.scores.quality} />
                <ScoreCard label={t("scores.uniqueness")} score={report.scores.uniqueness} />
                <ScoreCard label={t("scores.dataQuality")} score={report.scores.dataQuality} />
                <ScoreCard label={t("scores.stock")} score={report.scores.stock} />
                <ScoreCard label={t("scores.categories")} score={report.scores.categories} />
                <ScoreCard label={t("scores.business")} score={report.scores.business} />
              </div>
            </CardContent>
          </Card>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
            <Card>
              <CardContent className="pt-4 text-center">
                <div className="text-xl font-bold">{report.stats.withImages}</div>
                <div className="text-xs text-muted-foreground">{t("stats.withImages")}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <div className="text-xl font-bold">{report.stats.avgImageCount}</div>
                <div className="text-xs text-muted-foreground">{t("stats.avgImages")}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <div className="text-xl font-bold">{report.stats.withDescription}</div>
                <div className="text-xs text-muted-foreground">{t("stats.withDescription")}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <div className="text-xl font-bold">{report.stats.withEan}</div>
                <div className="text-xs text-muted-foreground">{t("stats.withEan")}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <div className="text-xl font-bold">{report.stats.withManufacturer}</div>
                <div className="text-xs text-muted-foreground">{t("stats.withManufacturer")}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <div className="text-xl font-bold">{report.stats.totalCategories}</div>
                <div className="text-xs text-muted-foreground">{t("stats.categories")}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <div className="text-xl font-bold">{report.stats.totalVariants}</div>
                <div className="text-xs text-muted-foreground">{t("stats.variants")}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <div className="text-xl font-bold text-destructive">{getTotalIssues(report)}</div>
                <div className="text-xs text-muted-foreground">{t("stats.issues")}</div>
              </CardContent>
            </Card>
          </div>

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
              <BusinessIssueList issues={getBusinessIssuesByCategory('price')} t={t} />
            </TabsContent>

            {/* Promo Tab (merged with availability) */}
            <TabsContent value="promo" className="space-y-4 mt-4">
              <BusinessIssueList
                issues={[
                  ...getBusinessIssuesByCategory('promo'),
                  ...getBusinessIssuesByCategory('availability'),
                ]}
                t={t}
              />
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}

// Helper components

function ScoreCard({ label, score, isMain = false }: { label: string; score: number; isMain?: boolean }) {
  return (
    <div className={`text-center p-4 rounded-lg ${getScoreBgColor(score)} ${isMain ? "col-span-2 md:col-span-1" : ""}`}>
      <div className={`text-3xl font-bold ${getScoreColor(score)}`}>{score}</div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </div>
  );
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

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-2">
          {issues.slice(0, 20).map((issue, idx) => (
            <div key={idx} className="flex flex-col gap-1 p-3 bg-muted rounded-lg text-sm">
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
                <p className="text-muted-foreground text-xs ml-16">{issue.details}</p>
              )}
            </div>
          ))}
          {issues.length > 20 && (
            <p className="text-center text-muted-foreground pt-2">
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
}: {
  issues: BusinessIssue[];
  t: ReturnType<typeof useTranslations<"contentAudit">>;
}) {
  if (issues.length === 0) {
    return <NoIssuesCard t={t} />;
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-2">
          {issues.slice(0, 20).map((issue, idx) => (
            <div key={idx} className="flex flex-col gap-1 p-3 bg-muted rounded-lg text-sm">
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
                <p className="text-muted-foreground text-xs ml-16">{issue.details}</p>
              )}
            </div>
          ))}
          {issues.length > 20 && (
            <p className="text-center text-muted-foreground pt-2">
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>
          {issues.filter(i => i.severity === 'error').length} chyb, {issues.filter(i => i.severity === 'warning').length} varování
        </CardDescription>
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
                  <span className="font-medium text-sm">{type.replace(/_/g, ' ')}</span>
                </div>
                <div className="space-y-1 pl-4 border-l-2 border-muted">
                  {typeIssues.slice(0, displayCount).map((issue, idx) => (
                    <div key={idx} className="flex flex-col p-2 bg-muted/50 rounded text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{issue.productCode}</span>
                        <span className="text-muted-foreground truncate">{issue.productName}</span>
                      </div>
                      {issue.details && (
                        <p className="text-muted-foreground text-[11px] mt-1">{issue.details}</p>
                      )}
                    </div>
                  ))}
                  {typeIssues.length > 5 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-7 px-2"
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
              {categoryIssues.slice(0, 20).map((issue, idx) => (
                <div key={idx} className="flex flex-col gap-1 p-3 bg-muted rounded-lg text-sm">
                  <div className="flex items-center gap-2">
                    {issue.severity === "error" ? (
                      <Badge variant="destructive">Error</Badge>
                    ) : (
                      <Badge variant="secondary">Warning</Badge>
                    )}
                    <span className="font-medium">{issue.categoryName}</span>
                    {issue.productCount !== undefined && (
                      <Badge variant="outline">{issue.productCount} produktů</Badge>
                    )}
                  </div>
                  <p className="text-muted-foreground text-xs ml-16">{issue.categoryPath}</p>
                  {issue.details && (
                    <p className="text-muted-foreground text-xs ml-16">{issue.details}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {productCategoryIssues.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Zařazení produktů</CardTitle>
            <CardDescription>
              {productCategoryIssues.filter(i => i.severity === 'error').length} chyb, {productCategoryIssues.filter(i => i.severity === 'warning').length} varování
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {productCategoryIssues.slice(0, 20).map((issue, idx) => (
                <div key={idx} className="flex flex-col gap-1 p-3 bg-muted rounded-lg text-sm">
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
                    <p className="text-muted-foreground text-xs ml-16">{issue.details}</p>
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
    report.productCategoryIssues.length
  );
}
