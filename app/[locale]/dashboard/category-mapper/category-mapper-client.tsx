"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import * as XLSX from "xlsx";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Upload,
  Download,
  Loader2,
  CheckCircle2,
  XCircle,
  FolderTree,
  Sparkles,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import type { ProductForMapping, MappedProduct, Platform } from "@/lib/category-mapper/types";

type PlatformConfig = {
  id: Platform;
  name: string;
  color: string;
  field: string;
};

const PLATFORMS: PlatformConfig[] = [
  { id: "heureka", name: "Heureka", color: "bg-orange-500", field: "heurekaCategoryId" },
  { id: "zbozi", name: "Zboží.cz", color: "bg-blue-500", field: "zboziCategoryId" },
  { id: "google", name: "Google Shopping", color: "bg-red-500", field: "googleCategoryId" },
  { id: "glami", name: "Glami", color: "bg-pink-500", field: "glamiCategoryId" },
];

export function CategoryMapperClient() {
  const t = useTranslations("categoryMapper");
  const tCommon = useTranslations("common");

  // State
  const [file, setFile] = useState<File | null>(null);
  const [products, setProducts] = useState<ProductForMapping[]>([]);
  const [mappedProducts, setMappedProducts] = useState<MappedProduct[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>(["heureka", "zbozi", "google"]);
  const [useAI, setUseAI] = useState(true);
  const [overwriteExisting, setOverwriteExisting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Editing
  const [editingCell, setEditingCell] = useState<{ productCode: string; platform: Platform } | null>(null);
  const [editValue, setEditValue] = useState("");

  // Parse uploaded file
  const parseFile = useCallback(async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

      const products: ProductForMapping[] = data.map((row) => ({
        code: String(row.code || row.Code || row.CODE || ""),
        name: String(row.name || row.Name || row.NAME || ""),
        categoryText: row.categoryText ? String(row.categoryText) : undefined,
        defaultCategory: row.defaultCategory ? String(row.defaultCategory) : undefined,
        description: row.description ? String(row.description) : undefined,
        shortDescription: row.shortDescription ? String(row.shortDescription) : undefined,
        googleCategoryId: row.googleCategoryId ? String(row.googleCategoryId) : undefined,
        googleCategoryIdInFeed: row.googleCategoryIdInFeed ? String(row.googleCategoryIdInFeed) : undefined,
        heurekaCategoryId: row.heurekaCategoryId ? String(row.heurekaCategoryId) : undefined,
        zboziCategoryId: row.zboziCategoryId ? String(row.zboziCategoryId) : undefined,
        glamiCategoryId: row.glamiCategoryId ? String(row.glamiCategoryId) : undefined,
      }));

      setProducts(products);
      setFile(file);
      setError(null);
    } catch (err) {
      setError(t("errors.parseError"));
      console.error("Parse error:", err);
    }
  }, [t]);

  // Handle file drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.name.endsWith(".xlsx") || droppedFile.name.endsWith(".xls"))) {
      parseFile(droppedFile);
    } else {
      setError(t("errors.invalidFile"));
    }
  }, [parseFile, t]);

  // Handle file input
  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      parseFile(selectedFile);
    }
  }, [parseFile]);

  // Toggle platform selection
  const togglePlatform = (platform: Platform) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform]
    );
  };

  // Start editing a cell
  const startEditing = (productCode: string, platform: Platform, currentValue: string | number | undefined) => {
    setEditingCell({ productCode, platform });
    setEditValue(currentValue?.toString() || "");
  };

  // Save edited value
  const saveEdit = () => {
    if (!editingCell) return;

    setMappedProducts((prev) =>
      prev.map((product) => {
        if (product.code === editingCell.productCode) {
          const newMappedCategories = { ...product.mappedCategories };
          if (editValue.trim()) {
            newMappedCategories[editingCell.platform] = {
              id: editValue.trim(),
              name: "Manual",
              fullPath: "Manual entry",
              confidence: 100,
            };
          } else {
            delete newMappedCategories[editingCell.platform];
          }
          return { ...product, mappedCategories: newMappedCategories };
        }
        return product;
      })
    );

    setEditingCell(null);
    setEditValue("");
  };

  // Cancel editing
  const cancelEdit = () => {
    setEditingCell(null);
    setEditValue("");
  };

  // Pagination helpers
  const totalPages = Math.ceil(mappedProducts.length / itemsPerPage);
  const paginatedProducts = mappedProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Start mapping process
  const startMapping = async () => {
    if (products.length === 0 || selectedPlatforms.length === 0) return;

    setIsProcessing(true);
    setProgress(0);
    setError(null);

    try {
      const response = await fetch("/api/category-mapper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          products,
          platforms: selectedPlatforms,
          useAI,
          overwriteExisting,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      setMappedProducts(result.products);
      setProgress(100);
    } catch (err) {
      setError(t("errors.mappingError"));
      console.error("Mapping error:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Export results to XLSX
  const exportResults = () => {
    if (mappedProducts.length === 0) return;

    // Convert mapped products back to original format with new category IDs
    const exportData = mappedProducts.map((product) => {
      const row: Record<string, unknown> = {
        code: product.code,
        name: product.name,
        categoryText: product.categoryText,
        defaultCategory: product.defaultCategory,
      };

      // Add mapped category IDs
      if (product.mappedCategories.heureka) {
        row.heurekaCategoryId = product.mappedCategories.heureka.id;
      } else if (product.heurekaCategoryId) {
        row.heurekaCategoryId = product.heurekaCategoryId;
      }

      if (product.mappedCategories.zbozi) {
        row.zboziCategoryId = product.mappedCategories.zbozi.id;
      } else if (product.zboziCategoryId) {
        row.zboziCategoryId = product.zboziCategoryId;
      }

      if (product.mappedCategories.google) {
        row.googleCategoryId = product.mappedCategories.google.id;
        row.googleCategoryIdInFeed = product.mappedCategories.google.id;
      } else if (product.googleCategoryId) {
        row.googleCategoryId = product.googleCategoryId;
        row.googleCategoryIdInFeed = product.googleCategoryIdInFeed;
      }

      if (product.mappedCategories.glami) {
        row.glamiCategoryId = product.mappedCategories.glami.id;
      } else if (product.glamiCategoryId) {
        row.glamiCategoryId = product.glamiCategoryId;
      }

      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Products");

    const fileName = file?.name.replace(/\.(xlsx|xls)$/i, "_mapped.xlsx") || "products_mapped.xlsx";
    XLSX.writeFile(workbook, fileName);
  };

  // Calculate stats
  const stats = {
    total: products.length,
    mapped: mappedProducts.length,
    byPlatform: PLATFORMS.reduce((acc, p) => {
      acc[p.id] = mappedProducts.filter((m) => m.mappedCategories[p.id]).length;
      return acc;
    }, {} as Record<Platform, number>),
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">{t("pageTitle")}</h1>
        <p className="text-muted-foreground mt-2">{t("pageDescription")}</p>
      </div>

      {/* Platform Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderTree className="h-5 w-5" />
            {t("platforms.title")}
          </CardTitle>
          <CardDescription>{t("platforms.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {PLATFORMS.map((platform) => (
              <div
                key={platform.id}
                className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedPlatforms.includes(platform.id)
                    ? "border-primary bg-primary/5"
                    : "border-muted hover:border-muted-foreground/50"
                }`}
                onClick={() => togglePlatform(platform.id)}
              >
                <Checkbox
                  checked={selectedPlatforms.includes(platform.id)}
                  onCheckedChange={() => togglePlatform(platform.id)}
                />
                <div>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${platform.color}`} />
                    <span className="font-medium">{platform.name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{platform.field}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Options */}
          <div className="flex flex-wrap gap-6 mt-6 pt-6 border-t">
            <div className="flex items-center space-x-2">
              <Switch
                id="use-ai"
                checked={useAI}
                onCheckedChange={setUseAI}
              />
              <Label htmlFor="use-ai" className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                {t("options.useAI")}
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="overwrite"
                checked={overwriteExisting}
                onCheckedChange={setOverwriteExisting}
              />
              <Label htmlFor="overwrite">{t("options.overwrite")}</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* File Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            {t("upload.title")}
          </CardTitle>
          <CardDescription>{t("upload.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging
                ? "border-primary bg-primary/5"
                : file
                ? "border-green-500 bg-green-500/5"
                : "border-muted-foreground/25"
            }`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            {file ? (
              <div className="flex flex-col items-center gap-2">
                <CheckCircle2 className="h-10 w-10 text-green-500" />
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {products.length} {t("upload.productsFound")}
                </p>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  id="file-input"
                  onChange={handleFileInput}
                />
                <Button asChild variant="outline" size="sm">
                  <label htmlFor="file-input" className="cursor-pointer">
                    {t("upload.changeFile")}
                  </label>
                </Button>
              </div>
            ) : (
              <>
                <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium">{t("upload.dragDrop")}</p>
                <p className="text-sm text-muted-foreground mb-4">{t("upload.orClick")}</p>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  id="file-input"
                  onChange={handleFileInput}
                />
                <Button asChild variant="outline">
                  <label htmlFor="file-input" className="cursor-pointer">
                    {t("upload.selectFile")}
                  </label>
                </Button>
                <p className="text-xs text-muted-foreground mt-4">{t("upload.formats")}</p>
              </>
            )}
          </div>
        </CardContent>
      </Card>

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

      {/* Process Button */}
      {products.length > 0 && selectedPlatforms.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">
                  {t("process.ready", { count: products.length })}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("process.platforms")}: {selectedPlatforms.map((p) => PLATFORMS.find((pl) => pl.id === p)?.name).join(", ")}
                </p>
              </div>

              <Button
                onClick={startMapping}
                disabled={isProcessing}
                size="lg"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("process.processing")}
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    {t("process.start")}
                  </>
                )}
              </Button>
            </div>

            {isProcessing && (
              <div className="mt-4">
                <Progress value={progress} className="h-2" />
                <p className="text-sm text-muted-foreground mt-2 text-center">
                  {t("process.progress", { percent: progress })}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {mappedProducts.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{t("results.title")}</CardTitle>
                <CardDescription>
                  {t("results.description", { count: stats.mapped })}
                </CardDescription>
              </div>
              <Button onClick={exportResults}>
                <Download className="mr-2 h-4 w-4" />
                {t("results.export")}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {PLATFORMS.filter((p) => selectedPlatforms.includes(p.id)).map((platform) => (
                <div key={platform.id} className="p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-2 h-2 rounded-full ${platform.color}`} />
                    <span className="font-medium">{platform.name}</span>
                  </div>
                  <p className="text-2xl font-bold">
                    {stats.byPlatform[platform.id]}/{stats.total}
                  </p>
                </div>
              ))}
            </div>

            {/* Results Table */}
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("results.table.code")}</TableHead>
                    <TableHead>{t("results.table.name")}</TableHead>
                    <TableHead>{t("results.table.category")}</TableHead>
                    {PLATFORMS.filter((p) => selectedPlatforms.includes(p.id)).map((platform) => (
                      <TableHead key={platform.id}>{platform.name}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedProducts.map((product) => (
                    <TableRow key={product.code}>
                      <TableCell className="font-mono text-sm">{product.code}</TableCell>
                      <TableCell className="max-w-[200px] truncate" title={product.name}>
                        {product.name}
                      </TableCell>
                      <TableCell className="max-w-[150px] truncate text-muted-foreground" title={product.categoryText || product.defaultCategory || "-"}>
                        {product.categoryText || product.defaultCategory || "-"}
                      </TableCell>
                      {PLATFORMS.filter((p) => selectedPlatforms.includes(p.id)).map((platform) => {
                        const mapped = product.mappedCategories[platform.id];
                        const isEditing = editingCell?.productCode === product.code && editingCell?.platform === platform.id;

                        return (
                          <TableCell key={platform.id} className="min-w-[120px]">
                            {isEditing ? (
                              <div className="flex items-center gap-1">
                                <Input
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  className="h-7 w-20 text-xs font-mono"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") saveEdit();
                                    if (e.key === "Escape") cancelEdit();
                                  }}
                                />
                                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={saveEdit}>
                                  <Check className="h-3 w-3 text-green-500" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={cancelEdit}>
                                  <X className="h-3 w-3 text-red-500" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 group">
                                {mapped ? (
                                  <Badge
                                    variant="outline"
                                    className="font-mono cursor-pointer hover:bg-muted"
                                    title={mapped.fullPath}
                                    onClick={() => startEditing(product.code, platform.id, mapped.id)}
                                  >
                                    {mapped.id}
                                  </Badge>
                                ) : (
                                  <span
                                    className="text-muted-foreground cursor-pointer hover:text-foreground"
                                    onClick={() => startEditing(product.code, platform.id, undefined)}
                                  >
                                    -
                                  </span>
                                )}
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={() => startEditing(product.code, platform.id, mapped?.id)}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between p-3 border-t">
                  <p className="text-sm text-muted-foreground">
                    {t("results.table.showing", {
                      shown: `${(currentPage - 1) * itemsPerPage + 1}-${Math.min(currentPage * itemsPerPage, mappedProducts.length)}`,
                      total: mappedProducts.length,
                    })}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm">
                      {currentPage} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
