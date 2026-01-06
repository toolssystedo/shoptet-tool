"use client";

import { useMemo, useState } from "react";
import { useEnrichmentStore } from "@/lib/stores/enrichment-store";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Edit, Search, ChevronLeft, ChevronRight, ImageIcon } from "lucide-react";
import {
  findImageColumn,
  findPriceColumn,
  findNameColumn,
  findCodeColumn,
  formatPrice,
  truncateText,
  countParams,
  getProductCategory,
} from "@/lib/enrichment/category-utils";
import type { EnrichedRow } from "@/lib/enrichment/types";

interface ProductTableProps {
  onEditProduct: (rowIndex: number) => void;
}

const ITEMS_PER_PAGE = 20;

export function ProductTable({ onEditProduct }: ProductTableProps) {
  const { parsedData, categoryGroups, selectedCategory, enrichedData } = useEnrichmentStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Determine column mappings
  const headers = parsedData?.headers || [];
  const imageCol = useMemo(() => findImageColumn(headers), [headers]);
  const priceCol = useMemo(() => findPriceColumn(headers), [headers]);
  const nameCol = useMemo(() => findNameColumn(headers), [headers]);
  const codeCol = useMemo(() => findCodeColumn(headers), [headers]);

  // Get filtered products
  const filteredProducts = useMemo(() => {
    let products: EnrichedRow[] = [];

    if (selectedCategory === null) {
      // All products
      products = enrichedData;
    } else {
      // Products from selected category
      const group = categoryGroups.find((g) => g.categoryName === selectedCategory);
      products = group?.products || [];
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      products = products.filter((p) => {
        const name = nameCol ? String(p[nameCol] || "").toLowerCase() : "";
        const code = codeCol ? String(p[codeCol] || "").toLowerCase() : "";
        const desc = String(p.shortDescription || "").toLowerCase();
        return name.includes(query) || code.includes(query) || desc.includes(query);
      });
    }

    return products;
  }, [selectedCategory, categoryGroups, enrichedData, searchQuery, nameCol, codeCol]);

  // Pagination
  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredProducts.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredProducts, currentPage]);

  // Reset page when filter changes
  useMemo(() => {
    setCurrentPage(1);
  }, [selectedCategory, searchQuery]);

  return (
    <div className="h-full flex flex-col">
      {/* Search bar */}
      <div className="p-3 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Hledat produkty..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {filteredProducts.length} produktů
          {selectedCategory && ` v kategorii "${selectedCategory}"`}
        </p>
      </div>

      {/* Table */}
      <ScrollArea className="flex-1">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60px]">Foto</TableHead>
              <TableHead>Název</TableHead>
              {codeCol && <TableHead className="w-[100px]">Kód</TableHead>}
              {priceCol && <TableHead className="w-[100px] text-right">Cena</TableHead>}
              <TableHead className="w-[150px]">Kategorie</TableHead>
              <TableHead className="w-[100px] text-center">Parametry</TableHead>
              <TableHead className="w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  Žádné produkty k zobrazení
                </TableCell>
              </TableRow>
            ) : (
              paginatedProducts.map((product) => {
                const params = countParams(product);
                const category = getProductCategory(product);

                return (
                  <TableRow key={product.rowIndex} className="cursor-pointer hover:bg-muted/50">
                    <TableCell>
                      {imageCol && product[imageCol] ? (
                        <img
                          src={String(product[imageCol])}
                          alt=""
                          className="w-10 h-10 object-cover rounded"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                      ) : (
                        <div className="w-10 h-10 bg-muted rounded flex items-center justify-center">
                          <ImageIcon className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[300px]">
                        <p className="font-medium truncate">
                          {nameCol ? truncateText(String(product[nameCol] || ""), 40) : "-"}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {truncateText(product.shortDescription, 60)}
                        </p>
                      </div>
                    </TableCell>
                    {codeCol && (
                      <TableCell className="font-mono text-xs">
                        {product[codeCol] ? String(product[codeCol]) : "-"}
                      </TableCell>
                    )}
                    {priceCol && (
                      <TableCell className="text-right">
                        {formatPrice(product[priceCol])}
                      </TableCell>
                    )}
                    <TableCell>
                      <span className="text-xs truncate block max-w-[130px]">{category}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        {params.filtering > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            F:{params.filtering}
                          </Badge>
                        )}
                        {params.text > 0 && (
                          <Badge variant="outline" className="text-xs">
                            T:{params.text}
                          </Badge>
                        )}
                        {params.total === 0 && (
                          <span className="text-muted-foreground text-xs">-</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onEditProduct(product.rowIndex)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </ScrollArea>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="p-3 border-t flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Strana {currentPage} z {totalPages}
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
  );
}
