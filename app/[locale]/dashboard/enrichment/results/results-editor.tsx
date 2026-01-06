"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useEnrichmentStore } from "@/lib/stores/enrichment-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Download,
  ArrowLeft,
  Folder,
  FolderOpen,
  ChevronRight,
  Trash2,
  ImageIcon,
  Filter,
  FileText,
  Search,
} from "lucide-react";
import {
  groupByCategory,
  findImageColumn,
  findPriceColumn,
  findNameColumn,
  findCodeColumn,
  formatPrice,
  truncateText,
  countParams,
} from "@/lib/enrichment/category-utils";
import { generateOutputFile } from "../actions";
import type { EnrichedRow } from "@/lib/enrichment/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function ResultsEditor() {
  const router = useRouter();
  const {
    enrichedData,
    parsedData,
    config,
    categoryGroups,
    setCategoryGroups,
    selectedCategory,
    setSelectedCategory,
    bulkRemoveParam,
    setSelectedProductIndex,
  } = useEnrichmentStore();

  const [isDownloading, setIsDownloading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{
    type: "filtering" | "text";
    name: string;
  } | null>(null);

  // Column mappings
  const headers = parsedData?.headers || [];
  const imageCol = useMemo(() => findImageColumn(headers), [headers]);
  const priceCol = useMemo(() => findPriceColumn(headers), [headers]);
  const nameCol = useMemo(() => findNameColumn(headers), [headers]);
  const codeCol = useMemo(() => findCodeColumn(headers), [headers]);

  // Initialize category groups
  useEffect(() => {
    if (enrichedData.length > 0 && categoryGroups.length === 0) {
      const groups = groupByCategory(enrichedData);
      setCategoryGroups(groups);
    }
  }, [enrichedData, categoryGroups.length, setCategoryGroups]);

  // Get current category
  const currentGroup = useMemo(() => {
    if (!selectedCategory) return null;
    return categoryGroups.find((g) => g.categoryName === selectedCategory) || null;
  }, [categoryGroups, selectedCategory]);

  // Filter products in current category
  const filteredProducts = useMemo(() => {
    if (!currentGroup) return [];
    let products = currentGroup.products;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      products = products.filter((p) => {
        const name = nameCol ? String(p[nameCol] || "").toLowerCase() : "";
        const code = codeCol ? String(p[codeCol] || "").toLowerCase() : "";
        return name.includes(query) || code.includes(query);
      });
    }

    return products;
  }, [currentGroup, searchQuery, nameCol, codeCol]);

  const totalProducts = categoryGroups.reduce((sum, g) => sum + g.products.length, 0);

  const handleDownload = async () => {
    if (!parsedData) return;
    setIsDownloading(true);
    try {
      const result = await generateOutputFile(parsedData, enrichedData, config);
      const blob = new Blob(
        [Uint8Array.from(atob(result.base64), (c) => c.charCodeAt(0))],
        { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download error:", error);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleBack = () => {
    router.push("/dashboard/enrichment");
  };

  const handleDeleteParam = (type: "filtering" | "text", name: string) => {
    setPendingDelete({ type, name });
    setShowConfirmDialog(true);
  };

  const confirmDelete = () => {
    if (!pendingDelete || !selectedCategory) return;
    bulkRemoveParam(selectedCategory, pendingDelete.type, pendingDelete.name);
    setPendingDelete(null);
    setShowConfirmDialog(false);
  };

  const handleProductClick = (product: EnrichedRow) => {
    setSelectedProductIndex(product.rowIndex);
    router.push(`/dashboard/enrichment/results/product/${product.rowIndex}`);
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Top bar */}
      <div className="border-b px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Zpět na wizard
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <h1 className="text-lg font-semibold">Úprava výsledků</h1>
          <Badge variant="secondary">{totalProducts} produktů</Badge>
        </div>
        <Button onClick={handleDownload} disabled={isDownloading}>
          <Download className="h-4 w-4 mr-2" />
          {isDownloading ? "Stahování..." : "Stáhnout soubor"}
        </Button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left sidebar - Categories only */}
        <div className="w-72 border-r flex flex-col shrink-0 bg-muted/30">
          <div className="p-4 border-b bg-background">
            <h2 className="font-semibold">Kategorie</h2>
            <p className="text-xs text-muted-foreground mt-1">
              {categoryGroups.length} kategorií
            </p>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {categoryGroups.map((group) => {
                const isSelected = selectedCategory === group.categoryName;
                const Icon = isSelected ? FolderOpen : Folder;
                return (
                  <button
                    key={group.categoryName}
                    onClick={() => setSelectedCategory(group.categoryName)}
                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm transition-colors text-left ${
                      isSelected
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    }`}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{group.categoryName}</p>
                      <p className={`text-xs ${isSelected ? "opacity-80" : "text-muted-foreground"}`}>
                        {group.products.length} produktů
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 opacity-50" />
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        {/* Main content area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!selectedCategory ? (
            // No category selected
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Folder className="h-16 w-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg">Vyberte kategorii</p>
                <p className="text-sm mt-1">Klikněte na kategorii vlevo pro zobrazení produktů</p>
              </div>
            </div>
          ) : (
            <>
              {/* Category header */}
              <div className="p-4 border-b bg-background">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold">{selectedCategory}</h2>
                    <p className="text-sm text-muted-foreground">
                      {currentGroup?.products.length || 0} produktů v kategorii
                    </p>
                  </div>
                </div>
              </div>

              {/* Parameters section */}
              {currentGroup && (currentGroup.commonParams.filtering.length > 0 || currentGroup.commonParams.text.length > 0) && (
                <div className="p-4 border-b bg-muted/20">
                  <h3 className="text-sm font-medium mb-3">Parametry v kategorii</h3>
                  <div className="space-y-3">
                    {/* Filtering params */}
                    {currentGroup.commonParams.filtering.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mb-2">
                          <Filter className="h-3 w-3" /> Filtrační parametry
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {currentGroup.commonParams.filtering.map((param) => (
                            <Badge
                              key={param}
                              variant="secondary"
                              className="pl-3 pr-1 py-1 flex items-center gap-2"
                            >
                              {param}
                              <button
                                onClick={() => handleDeleteParam("filtering", param)}
                                className="hover:bg-destructive/20 rounded p-0.5"
                              >
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Text params */}
                    {currentGroup.commonParams.text.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mb-2">
                          <FileText className="h-3 w-3" /> Textové parametry
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {currentGroup.commonParams.text.map((param) => (
                            <Badge
                              key={param}
                              variant="outline"
                              className="pl-3 pr-1 py-1 flex items-center gap-2"
                            >
                              {param}
                              <button
                                onClick={() => handleDeleteParam("text", param)}
                                className="hover:bg-destructive/20 rounded p-0.5"
                              >
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Search */}
              <div className="p-4 border-b">
                <div className="relative max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Hledat v kategorii..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              {/* Products list */}
              <ScrollArea className="flex-1">
                <div className="p-4 space-y-2">
                  {filteredProducts.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Žádné produkty
                    </div>
                  ) : (
                    filteredProducts.map((product) => {
                      const params = countParams(product);
                      const productName = nameCol ? String(product[nameCol] || "") : "";
                      const productCode = codeCol ? String(product[codeCol] || "") : "";
                      const productImage = imageCol ? String(product[imageCol] || "") : "";

                      return (
                        <button
                          key={product.rowIndex}
                          onClick={() => handleProductClick(product)}
                          className="w-full flex items-center gap-4 p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors text-left"
                        >
                          {/* Image */}
                          {productImage ? (
                            <img
                              src={productImage}
                              alt=""
                              className="w-16 h-16 object-cover rounded"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = "none";
                              }}
                            />
                          ) : (
                            <div className="w-16 h-16 bg-muted rounded flex items-center justify-center">
                              <ImageIcon className="h-6 w-6 text-muted-foreground" />
                            </div>
                          )}

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">
                              {truncateText(productName, 60) || "Bez názvu"}
                            </p>
                            <div className="flex items-center gap-3 mt-1">
                              {productCode && (
                                <span className="text-xs text-muted-foreground font-mono">
                                  {productCode}
                                </span>
                              )}
                              {priceCol && product[priceCol] && (
                                <span className="text-sm font-medium">
                                  {formatPrice(product[priceCol])}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                              {product.shortDescription || "Bez popisu"}
                            </p>
                          </div>

                          {/* Params count */}
                          <div className="flex items-center gap-2 shrink-0">
                            {params.filtering > 0 && (
                              <Badge variant="secondary" className="text-xs">
                                F: {params.filtering}
                              </Badge>
                            )}
                            {params.text > 0 && (
                              <Badge variant="outline" className="text-xs">
                                T: {params.text}
                              </Badge>
                            )}
                            <ChevronRight className="h-5 w-5 text-muted-foreground" />
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </>
          )}
        </div>
      </div>

      {/* Confirmation dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Smazat parametr ze všech produktů?</AlertDialogTitle>
            <AlertDialogDescription>
              Parametr &quot;{pendingDelete?.name}&quot; bude smazán ze všech{" "}
              {currentGroup?.products.length} produktů v kategorii &quot;{selectedCategory}&quot;.
              <br /><br />
              Tato akce nelze vrátit.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrušit</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground">
              Smazat
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
