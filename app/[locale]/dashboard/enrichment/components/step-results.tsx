"use client";

import { useState, useEffect } from "react";
import { useEnrichmentStore } from "@/lib/stores/enrichment-store";
import { Button } from "@/components/ui/button";
import { Download, ArrowLeft, CheckCircle, AlertCircle } from "lucide-react";
import { CategoryTree } from "./category-tree";
import { ProductTable } from "./product-table";
import { ProductDetailDialog } from "./product-detail-dialog";
import { CategoryBulkActions } from "./category-bulk-actions";
import { groupByCategory } from "@/lib/enrichment/category-utils";
import { generateOutputFile } from "../actions";

export function StepResults() {
  const {
    enrichedData,
    parsedData,
    config,
    categoryGroups,
    setCategoryGroups,
    selectedCategory,
    prevStep,
  } = useEnrichmentStore();

  const [editingProductIndex, setEditingProductIndex] = useState<number | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // Group products by category on mount
  useEffect(() => {
    if (enrichedData.length > 0 && categoryGroups.length === 0) {
      const groups = groupByCategory(enrichedData);
      setCategoryGroups(groups);
    }
  }, [enrichedData, categoryGroups.length, setCategoryGroups]);

  const handleDownload = async () => {
    if (!parsedData) return;

    setIsDownloading(true);
    setDownloadError(null);

    try {
      const result = await generateOutputFile(parsedData, enrichedData, config);

      // Create download link
      const blob = new Blob(
        [Uint8Array.from(atob(result.base64), (c) => c.charCodeAt(0))],
        {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }
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
      setDownloadError(error instanceof Error ? error.message : "Chyba při stahování");
    } finally {
      setIsDownloading(false);
    }
  };

  const successCount = enrichedData.filter((r) => r.aiResult && !r.error).length;
  const errorCount = enrichedData.filter((r) => r.error).length;

  return (
    <div className="space-y-4">
      {/* Header with stats and download */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Upravit výsledky</h2>
          <div className="flex items-center gap-4 mt-1 text-sm">
            <span className="flex items-center gap-1 text-green-600">
              <CheckCircle className="h-4 w-4" />
              {successCount} úspěšně
            </span>
            {errorCount > 0 && (
              <span className="flex items-center gap-1 text-destructive">
                <AlertCircle className="h-4 w-4" />
                {errorCount} chyb
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={prevStep}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Zpět
          </Button>
          <Button onClick={handleDownload} disabled={isDownloading}>
            <Download className="h-4 w-4 mr-2" />
            {isDownloading ? "Stahování..." : "Stáhnout soubor"}
          </Button>
        </div>
      </div>

      {downloadError && (
        <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
          {downloadError}
        </div>
      )}

      {/* Main content - two column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4 h-[600px]">
        {/* Left sidebar - Categories + Bulk actions */}
        <div className="border rounded-lg overflow-hidden flex flex-col">
          <div className="flex-1 min-h-0">
            <CategoryTree />
          </div>
          {selectedCategory && (
            <div className="border-t">
              <CategoryBulkActions />
            </div>
          )}
        </div>

        {/* Right side - Product table */}
        <div className="border rounded-lg overflow-hidden">
          <ProductTable onEditProduct={setEditingProductIndex} />
        </div>
      </div>

      {/* Product detail dialog */}
      <ProductDetailDialog
        productRowIndex={editingProductIndex}
        onClose={() => setEditingProductIndex(null)}
      />
    </div>
  );
}
