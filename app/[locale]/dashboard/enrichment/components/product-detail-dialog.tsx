"use client";

import { useState, useMemo, useEffect } from "react";
import { useEnrichmentStore } from "@/lib/stores/enrichment-store";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, ImageIcon, Save } from "lucide-react";
import {
  findImageColumn,
  findPriceColumn,
  findNameColumn,
  findCodeColumn,
  formatPrice,
  getProductCategory,
} from "@/lib/enrichment/category-utils";
import type { AIExtractionResult, FilteringProperty, TextProperty } from "@/lib/enrichment/types";

interface ProductDetailDialogProps {
  productRowIndex: number | null;
  onClose: () => void;
}

export function ProductDetailDialog({ productRowIndex, onClose }: ProductDetailDialogProps) {
  const { parsedData, enrichedData, updateProductParams } = useEnrichmentStore();

  const headers = parsedData?.headers || [];
  const imageCol = useMemo(() => findImageColumn(headers), [headers]);
  const priceCol = useMemo(() => findPriceColumn(headers), [headers]);
  const nameCol = useMemo(() => findNameColumn(headers), [headers]);
  const codeCol = useMemo(() => findCodeColumn(headers), [headers]);

  const product = useMemo(() => {
    if (productRowIndex === null) return null;
    return enrichedData.find((p) => p.rowIndex === productRowIndex) || null;
  }, [productRowIndex, enrichedData]);

  // Local state for editing
  const [filteringParams, setFilteringParams] = useState<FilteringProperty[]>([]);
  const [textParams, setTextParams] = useState<TextProperty[]>([]);

  // Initialize local state when product changes
  useEffect(() => {
    if (product?.aiResult) {
      setFilteringParams([...product.aiResult.filtering]);
      setTextParams([...product.aiResult.text]);
    } else {
      setFilteringParams([]);
      setTextParams([]);
    }
  }, [product]);

  if (!product) return null;

  const handleSave = () => {
    const newParams: AIExtractionResult = {
      filtering: filteringParams.filter((p) => p.name.trim() && p.value.trim()),
      text: textParams.filter((p) => p.key.trim() && p.value.trim()),
    };
    updateProductParams(product.rowIndex, newParams);
    onClose();
  };

  const addFilteringParam = () => {
    setFilteringParams([...filteringParams, { name: "", value: "" }]);
  };

  const removeFilteringParam = (index: number) => {
    setFilteringParams(filteringParams.filter((_, i) => i !== index));
  };

  const updateFilteringParam = (index: number, field: "name" | "value", value: string) => {
    const updated = [...filteringParams];
    updated[index] = { ...updated[index], [field]: value };
    setFilteringParams(updated);
  };

  const addTextParam = () => {
    setTextParams([...textParams, { key: "", value: "" }]);
  };

  const removeTextParam = (index: number) => {
    setTextParams(textParams.filter((_, i) => i !== index));
  };

  const updateTextParam = (index: number, field: "key" | "value", value: string) => {
    const updated = [...textParams];
    updated[index] = { ...updated[index], [field]: value };
    setTextParams(updated);
  };

  const category = getProductCategory(product);
  const productName = nameCol ? String(product[nameCol] || "") : "";
  const productCode = codeCol ? String(product[codeCol] || "") : "";
  const productPrice = priceCol ? product[priceCol] : undefined;
  const productImage = imageCol ? String(product[imageCol] || "") : "";

  return (
    <Dialog open={productRowIndex !== null} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Upravit produkt</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {/* Product info header */}
          <div className="flex gap-4 p-4 bg-muted/50 rounded-lg mb-4">
            {productImage ? (
              <img
                src={productImage}
                alt=""
                className="w-20 h-20 object-cover rounded"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <div className="w-20 h-20 bg-muted rounded flex items-center justify-center">
                <ImageIcon className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold truncate">{productName || "Bez názvu"}</h3>
              <div className="flex flex-wrap gap-2 mt-1">
                {productCode && (
                  <Badge variant="outline" className="font-mono text-xs">
                    {productCode}
                  </Badge>
                )}
                <Badge variant="secondary">{category}</Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {formatPrice(productPrice)}
              </p>
            </div>
          </div>

          {/* Description preview */}
          {product.shortDescription && (
            <div className="mb-4">
              <Label className="text-xs text-muted-foreground">Krátký popis</Label>
              <p className="text-sm mt-1 line-clamp-2">{product.shortDescription}</p>
            </div>
          )}

          {/* Parameters tabs */}
          <Tabs defaultValue="filtering" className="flex-1">
            <TabsList className="w-full">
              <TabsTrigger value="filtering" className="flex-1">
                Filtrační parametry ({filteringParams.length})
              </TabsTrigger>
              <TabsTrigger value="text" className="flex-1">
                Textové parametry ({textParams.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="filtering" className="mt-4">
              <ScrollArea className="h-[250px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Název</TableHead>
                      <TableHead>Hodnota</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteringParams.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground py-4">
                          Žádné filtrační parametry
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteringParams.map((param, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Input
                              value={param.name}
                              onChange={(e) => updateFilteringParam(index, "name", e.target.value)}
                              placeholder="Název"
                              className="h-8"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={param.value}
                              onChange={(e) => updateFilteringParam(index, "value", e.target.value)}
                              placeholder="Hodnota"
                              className="h-8"
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => removeFilteringParam(index)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 w-full"
                  onClick={addFilteringParam}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Přidat parametr
                </Button>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="text" className="mt-4">
              <ScrollArea className="h-[250px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Klíč</TableHead>
                      <TableHead>Hodnota</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {textParams.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground py-4">
                          Žádné textové parametry
                        </TableCell>
                      </TableRow>
                    ) : (
                      textParams.map((param, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Input
                              value={param.key}
                              onChange={(e) => updateTextParam(index, "key", e.target.value)}
                              placeholder="Klíč"
                              className="h-8"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={param.value}
                              onChange={(e) => updateTextParam(index, "value", e.target.value)}
                              placeholder="Hodnota"
                              className="h-8"
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => removeTextParam(index)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 w-full"
                  onClick={addTextParam}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Přidat parametr
                </Button>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Zrušit
          </Button>
          <Button onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            Uložit změny
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
