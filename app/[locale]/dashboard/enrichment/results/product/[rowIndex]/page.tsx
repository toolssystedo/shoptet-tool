"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { useEnrichmentStore } from "@/lib/stores/enrichment-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowLeft,
  Save,
  Trash2,
  Plus,
  ImageIcon,
  Filter,
  FileText,
  Package,
} from "lucide-react";
import {
  findImageColumn,
  findPriceColumn,
  findNameColumn,
  findCodeColumn,
  formatPrice,
  getProductCategory,
  stripHtml,
} from "@/lib/enrichment/category-utils";
import type { FilteringProperty, TextProperty, AIExtractionResult } from "@/lib/enrichment/types";
import { toast } from "sonner";

export default function ProductEditPage() {
  const router = useRouter();
  const params = useParams();
  const rowIndex = parseInt(params.rowIndex as string, 10);

  const {
    enrichedData,
    parsedData,
    categoryGroups,
    selectedCategory,
    updateProductParams,
  } = useEnrichmentStore();

  // Find the product
  const product = useMemo(() => {
    return enrichedData.find((p) => p.rowIndex === rowIndex) || null;
  }, [enrichedData, rowIndex]);

  // Find category params for reference
  const categoryParams = useMemo(() => {
    if (!selectedCategory) return null;
    const group = categoryGroups.find((g) => g.categoryName === selectedCategory);
    return group?.commonParams || null;
  }, [categoryGroups, selectedCategory]);

  // Column mappings
  const headers = parsedData?.headers || [];
  const imageCol = useMemo(() => findImageColumn(headers), [headers]);
  const priceCol = useMemo(() => findPriceColumn(headers), [headers]);
  const nameCol = useMemo(() => findNameColumn(headers), [headers]);
  const codeCol = useMemo(() => findCodeColumn(headers), [headers]);

  // Edit state
  const [filteringParams, setFilteringParams] = useState<FilteringProperty[]>([]);
  const [textParams, setTextParams] = useState<TextProperty[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize edit state
  useEffect(() => {
    if (product?.aiResult) {
      setFilteringParams([...product.aiResult.filtering]);
      setTextParams([...product.aiResult.text]);
    } else {
      setFilteringParams([]);
      setTextParams([]);
    }
    setHasChanges(false);
  }, [product]);

  // Redirect if no product found
  useEffect(() => {
    if (!product && enrichedData.length > 0) {
      router.push("/dashboard/enrichment/results");
    }
  }, [product, enrichedData.length, router]);

  if (!product) {
    return null;
  }

  const productName = nameCol ? String(product[nameCol] || "") : "";
  const productCode = codeCol ? String(product[codeCol] || "") : "";
  const productImage = imageCol ? String(product[imageCol] || "") : "";
  const productPrice = priceCol ? product[priceCol] : undefined;
  const category = getProductCategory(product);

  const handleBack = () => {
    router.push("/dashboard/enrichment/results");
  };

  const handleSave = () => {
    const newParams: AIExtractionResult = {
      filtering: filteringParams.filter((p) => p.name.trim() && p.value.trim()),
      text: textParams.filter((p) => p.key.trim() && p.value.trim()),
    };
    updateProductParams(product.rowIndex, newParams);
    setHasChanges(false);
    toast.success("Změny uloženy");
  };

  // Filtering params handlers
  const addFilteringParam = () => {
    setFilteringParams([...filteringParams, { name: "", value: "" }]);
    setHasChanges(true);
  };

  const removeFilteringParam = (index: number) => {
    setFilteringParams(filteringParams.filter((_, i) => i !== index));
    setHasChanges(true);
  };

  const updateFilteringParam = (index: number, field: "name" | "value", value: string) => {
    const updated = [...filteringParams];
    updated[index] = { ...updated[index], [field]: value };
    setFilteringParams(updated);
    setHasChanges(true);
  };

  // Text params handlers
  const addTextParam = () => {
    setTextParams([...textParams, { key: "", value: "" }]);
    setHasChanges(true);
  };

  const removeTextParam = (index: number) => {
    setTextParams(textParams.filter((_, i) => i !== index));
    setHasChanges(true);
  };

  const updateTextParam = (index: number, field: "key" | "value", value: string) => {
    const updated = [...textParams];
    updated[index] = { ...updated[index], [field]: value };
    setTextParams(updated);
    setHasChanges(true);
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Top bar */}
      <div className="border-b px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Zpět do kategorie
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <h1 className="text-lg font-semibold truncate max-w-md">
            {productName || "Produkt"}
          </h1>
        </div>
        <Button onClick={handleSave} disabled={!hasChanges}>
          <Save className="h-4 w-4 mr-2" />
          Uložit změny
        </Button>
      </div>

      {/* Main content */}
      <ScrollArea className="flex-1">
        <div className="max-w-4xl mx-auto p-6 space-y-6">
          {/* Product info card */}
          <Card>
            <CardContent className="p-6">
              <div className="flex gap-6">
                {/* Image */}
                {productImage ? (
                  <img
                    src={productImage}
                    alt=""
                    className="w-32 h-32 object-cover rounded-lg shrink-0"
                  />
                ) : (
                  <div className="w-32 h-32 bg-muted rounded-lg flex items-center justify-center shrink-0">
                    <ImageIcon className="h-12 w-12 text-muted-foreground" />
                  </div>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0 space-y-3">
                  <div>
                    <h2 className="text-2xl font-semibold">{productName || "Bez názvu"}</h2>
                    <div className="flex items-center gap-3 mt-2">
                      {productCode && (
                        <Badge variant="outline" className="font-mono">
                          {productCode}
                        </Badge>
                      )}
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <Package className="h-3 w-3" />
                        {category}
                      </Badge>
                    </div>
                  </div>

                  {productPrice !== undefined && (
                    <p className="text-xl font-bold">{formatPrice(productPrice)}</p>
                  )}

                  {product.shortDescription && (
                    <p className="text-muted-foreground text-sm">
                      {stripHtml(product.shortDescription)}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Category params reference */}
          {categoryParams && (categoryParams.filtering.length > 0 || categoryParams.text.length > 0) && (
            <Card className="border-dashed">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Parametry používané v kategorii &quot;{selectedCategory}&quot;
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-wrap gap-2">
                  {categoryParams.filtering.map((p) => (
                    <Badge key={`f-${p}`} variant="secondary" className="text-xs">
                      <Filter className="h-2.5 w-2.5 mr-1" />
                      {p}
                    </Badge>
                  ))}
                  {categoryParams.text.map((p) => (
                    <Badge key={`t-${p}`} variant="outline" className="text-xs">
                      <FileText className="h-2.5 w-2.5 mr-1" />
                      {p}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Filtering parameters */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Filter className="h-5 w-5" />
                  Filtrační parametry
                </CardTitle>
                <Button variant="outline" size="sm" onClick={addFilteringParam}>
                  <Plus className="h-4 w-4 mr-1" />
                  Přidat
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {filteringParams.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  Žádné filtrační parametry
                </p>
              ) : (
                <div className="space-y-3">
                  {filteringParams.map((param, index) => (
                    <div key={index} className="flex gap-3 items-start">
                      <div className="flex-1">
                        <Label className="text-xs text-muted-foreground">Název</Label>
                        <Input
                          value={param.name}
                          onChange={(e) => updateFilteringParam(index, "name", e.target.value)}
                          placeholder="např. Barva"
                        />
                      </div>
                      <div className="flex-1">
                        <Label className="text-xs text-muted-foreground">Hodnota</Label>
                        <Input
                          value={param.value}
                          onChange={(e) => updateFilteringParam(index, "value", e.target.value)}
                          placeholder="např. červená"
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="mt-5 shrink-0"
                        onClick={() => removeFilteringParam(index)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Text parameters */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Textové parametry
                </CardTitle>
                <Button variant="outline" size="sm" onClick={addTextParam}>
                  <Plus className="h-4 w-4 mr-1" />
                  Přidat
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {textParams.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  Žádné textové parametry
                </p>
              ) : (
                <div className="space-y-3">
                  {textParams.map((param, index) => (
                    <div key={index} className="flex gap-3 items-start">
                      <div className="flex-1">
                        <Label className="text-xs text-muted-foreground">Klíč</Label>
                        <Input
                          value={param.key}
                          onChange={(e) => updateTextParam(index, "key", e.target.value)}
                          placeholder="např. Materiál"
                        />
                      </div>
                      <div className="flex-1">
                        <Label className="text-xs text-muted-foreground">Hodnota</Label>
                        <Input
                          value={param.value}
                          onChange={(e) => updateTextParam(index, "value", e.target.value)}
                          placeholder="např. 100% bavlna"
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="mt-5 shrink-0"
                        onClick={() => removeTextParam(index)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Bottom padding */}
          <div className="h-8" />
        </div>
      </ScrollArea>
    </div>
  );
}
