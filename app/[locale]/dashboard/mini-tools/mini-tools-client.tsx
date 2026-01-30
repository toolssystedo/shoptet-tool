"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Download,
  Eye,
  EyeOff,
  ArrowUpDown,
  Percent,
  Tag,
  CheckCircle2,
  Upload,
  FileSpreadsheet,
  Plus,
  Trash2,
  HelpCircle,
  Package,
  AlertTriangle,
} from "lucide-react";
import * as XLSX from "xlsx";

// Types
interface ProductData {
  code: string;
  pairCode?: string;
  name: string;
  stock: number;
  price: number;
  priceBeforeDiscount?: number;
  visible?: boolean;
  priority?: number;
  manufacturer?: string;
  categoryText?: string;
  isAction?: boolean;
  isNew?: boolean;
  isTip?: boolean;
  actionEndDate?: string;
  [key: string]: unknown;
}

interface DiscountLevel {
  id: string;
  name: string;
  discountPercent: number;
}

interface PromotionConfig {
  // Flag settings
  flagName: string;
  flagValidFrom: string;
  flagValidUntil: string;

  // Product filters
  priceFrom: string;
  priceTo: string;
  selectedBrands: string[];
  selectedCategories: string[];
  selectedBrandlessCodes: string[];

  // Price modification
  discountEnabled: boolean;
  discountType: "percent" | "fixed";
  discountValue: string;
  actionFrom: string;
  actionUntil: string;
}

interface CategoryNode {
  name: string;
  fullPath: string;
  children: CategoryNode[];
  productCount: number;
}

// Helper to find value by possible column names (case-insensitive)
function findValue(row: Record<string, unknown>, keys: string[]): unknown {
  // First try exact match
  for (const key of keys) {
    if (key in row) return row[key];
  }
  // Then try case-insensitive match
  const rowKeys = Object.keys(row);
  for (const key of keys) {
    const found = rowKeys.find(k => k.toLowerCase().trim() === key.toLowerCase());
    if (found) return row[found];
  }
  return undefined;
}

// Helper to parse number (handles string "0" correctly)
function parseStock(value: unknown): number {
  if (value === undefined || value === null || value === "") return 0;
  const num = Number(value);
  return isNaN(num) ? 0 : num;
}

// Helper to parse file
async function parseProductFile(file: File): Promise<ProductData[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);

        const products: ProductData[] = jsonData.map((row) => ({
          ...row, // Spread first so parsed fields override raw values
          code: String(findValue(row, ["code", "CODE", "Kód", "kod"]) || ""),
          pairCode: String(findValue(row, ["pairCode", "PAIRCODE", "PairCode", "pair_code"]) || ""),
          name: String(findValue(row, ["name", "NAME", "Název", "nazev"]) || ""),
          stock: parseStock(findValue(row, ["stock", "STOCK", "Sklad", "Skladem", "sklad", "amount", "Amount"])),
          price: parseStock(findValue(row, ["price", "PRICE", "Cena", "Cena s DPH", "cena"])),
          priceBeforeDiscount: parseStock(findValue(row, ["priceBeforeDiscount", "Cena před slevou"])) || undefined,
          visible: findValue(row, ["visible", "VISIBLE", "Viditelný"]) !== "0" && findValue(row, ["visible", "VISIBLE"]) !== 0,
          priority: parseStock(findValue(row, ["priority", "PRIORITY", "Pořadí", "poradi"])),
          manufacturer: String(findValue(row, ["manufacturer", "MANUFACTURER", "Výrobce", "vyrobce"]) || ""),
          categoryText: String(findValue(row, ["categoryText", "CATEGORY_TEXT", "Kategorie", "kategorie"]) || ""),
          isAction: findValue(row, ["isAction", "V akci"]) === "1" || findValue(row, ["isAction"]) === 1 || findValue(row, ["isAction"]) === true,
          isNew: findValue(row, ["isNew", "Novinka"]) === "1" || findValue(row, ["isNew"]) === 1 || findValue(row, ["isNew"]) === true,
          isTip: findValue(row, ["isTip", "Tip"]) === "1" || findValue(row, ["isTip", "Tip"]) === 1 || findValue(row, ["isTip", "Tip"]) === true,
          actionEndDate: String(findValue(row, ["actionEndDate", "Konec akce"]) || ""),
        }));

        resolve(products);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

// Helper to export file
function exportToXlsx(data: Record<string, unknown>[], filename: string) {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Data");
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

// Reusable File Upload Component
function FileUploadZone({
  fileName,
  productCount,
  onFileSelect,
  isDragging,
  setIsDragging,
  id,
}: {
  fileName: string | null;
  productCount: number;
  onFileSelect: (file: File) => void;
  isDragging: boolean;
  setIsDragging: (v: boolean) => void;
  id: string;
}) {
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv'))) {
      onFileSelect(file);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  };

  return (
    <div
      className={`border-2 border-dashed rounded-lg p-8 text-center transition-all ${
        isDragging
          ? "border-primary bg-primary/5"
          : fileName
          ? "border-green-500 bg-green-500/5"
          : "border-muted-foreground/25 hover:border-muted-foreground/50"
      }`}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      {fileName ? (
        <div className="flex flex-col items-center gap-3">
          <CheckCircle2 className="h-10 w-10 text-green-500" />
          <div>
            <p className="font-medium">{fileName}</p>
            <p className="text-sm text-muted-foreground">{productCount.toLocaleString()} produktů</p>
          </div>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            id={id}
            onChange={handleFileInput}
          />
          <Button asChild variant="outline" size="sm">
            <label htmlFor={id} className="cursor-pointer">Změnit soubor</label>
          </Button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <Upload className="h-10 w-10 text-muted-foreground" />
          <div>
            <p className="font-medium">Přetáhněte soubor sem</p>
            <p className="text-sm text-muted-foreground">nebo klikněte pro výběr</p>
          </div>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            id={id}
            onChange={handleFileInput}
          />
          <Button asChild variant="outline" size="sm">
            <label htmlFor={id} className="cursor-pointer">Vybrat soubor</label>
          </Button>
          <p className="text-xs text-muted-foreground">Podporované formáty: XLSX, XLS, CSV</p>
        </div>
      )}
    </div>
  );
}

// Stat Card Component
function StatCard({ label, value, icon: Icon, color = "default" }: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  color?: "default" | "green" | "yellow" | "red";
}) {
  const colorClasses = {
    default: "bg-muted",
    green: "bg-green-500/10 text-green-600",
    yellow: "bg-yellow-500/10 text-yellow-600",
    red: "bg-red-500/10 text-red-600",
  };

  return (
    <div className={`flex items-center gap-3 p-4 rounded-lg ${colorClasses[color]}`}>
      <Icon className="h-5 w-5" />
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

// ============= TOOL 1: Hide Sold-Out Products =============
function HideSoldOutTool() {
  const t = useTranslations("miniTools.hideSoldOut");
  const [products, setProducts] = useState<ProductData[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{ total: number; hidden: number } | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const handleFileSelect = async (file: File) => {
    setFileName(file.name);
    setResult(null);
    try {
      const parsed = await parseProductFile(file);
      setProducts(parsed);
    } catch (error) {
      console.error("Error parsing file:", error);
    }
  };

  const processProducts = () => {
    setProcessing(true);

    const soldOutProducts = products.filter(p => p.stock === 0);
    const changedProducts = soldOutProducts.map((p) => {
      const isVariant = p.pairCode && p.pairCode.trim() !== "";
      if (isVariant) {
        // Variant - set variantVisibility to 0
        return {
          code: p.code,
          pairCode: p.pairCode || "",
          variantVisibility: 0,
        };
      } else {
        // Main product - set productVisibility to hidden
        return {
          code: p.code,
          pairCode: p.pairCode || "",
          productVisibility: "hidden",
        };
      }
    });

    setResult({
      total: products.length,
      hidden: changedProducts.length,
    });

    if (changedProducts.length > 0) {
      exportToXlsx(changedProducts, "skryte-vyprodane-produkty");
    }

    setProcessing(false);
  };

  const soldOutProducts = products.filter(p => p.stock === 0);
  const soldOutCount = soldOutProducts.length;
  const inStockCount = products.filter(p => p.stock > 0).length;

  const filteredSoldOut = soldOutProducts.filter(p =>
    searchQuery === "" ||
    p.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Nahrát produkty
            </CardTitle>
            <CardDescription>Nahrajte XLSX export produktů ze Shoptetu</CardDescription>
          </CardHeader>
          <CardContent>
            <FileUploadZone
              fileName={fileName}
              productCount={products.length}
              onFileSelect={handleFileSelect}
              isDragging={isDragging}
              setIsDragging={setIsDragging}
              id="hide-soldout-file"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <EyeOff className="h-5 w-5" />
              {t("title")}
            </CardTitle>
            <CardDescription>{t("description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {products.length > 0 ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <StatCard label="Skladem" value={inStockCount} icon={CheckCircle2} color="green" />
                  <StatCard label="Vyprodáno" value={soldOutCount} icon={AlertTriangle} color="red" />
                </div>

                {soldOutCount > 0 && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Vyprodané produkty</span>
                      <span className="font-medium">{Math.round((soldOutCount / products.length) * 100)}%</span>
                    </div>
                    <Progress value={(soldOutCount / products.length) * 100} className="h-2" />
                  </div>
                )}

                <Separator />

                <div className="flex gap-2">
                  <Button
                    onClick={processProducts}
                    disabled={soldOutCount === 0 || processing}
                    className="flex-1"
                    size="lg"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Skrýt {soldOutCount} produktů a stáhnout
                  </Button>
                  {soldOutCount > 0 && (
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={() => setShowPreview(!showPreview)}
                    >
                      {showPreview ? (
                        <><EyeOff className="h-4 w-4 mr-2" />Skrýt</>
                      ) : (
                        <><Eye className="h-4 w-4 mr-2" />Náhled</>
                      )}
                    </Button>
                  )}
                </div>

                {result && (
                  <div className="flex items-center gap-3 p-4 bg-green-500/10 rounded-lg text-green-700">
                    <CheckCircle2 className="h-5 w-5" />
                    <div>
                      <p className="font-medium">Soubor byl stažen</p>
                      <p className="text-sm">Skryto {result.hidden} z {result.total} produktů</p>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FileSpreadsheet className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Nejprve nahrajte soubor s produkty</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Preview Section */}
      {showPreview && soldOutCount > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Náhled vyprodaných produktů</CardTitle>
                <CardDescription>
                  {filteredSoldOut.length} z {soldOutCount} produktů
                </CardDescription>
              </div>
              <Input
                placeholder="Hledat podle kódu nebo názvu..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64"
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="text-left p-3 font-medium">Kód</th>
                      <th className="text-left p-3 font-medium">Název</th>
                      <th className="text-right p-3 font-medium">Cena</th>
                      <th className="text-center p-3 font-medium">Sklad</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredSoldOut.slice(0, 100).map((product, idx) => (
                      <tr key={product.code || idx} className="hover:bg-muted/50">
                        <td className="p-3 font-mono text-xs">{product.code}</td>
                        <td className="p-3 truncate max-w-xs">{product.name}</td>
                        <td className="p-3 text-right">{product.price?.toLocaleString()} Kč</td>
                        <td className="p-3 text-center">
                          <Badge variant="destructive">0</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredSoldOut.length > 100 && (
                <div className="p-3 text-center text-sm text-muted-foreground bg-muted/50 border-t">
                  Zobrazeno prvních 100 z {filteredSoldOut.length} produktů
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============= TOOL 2: Auto Sorting =============
function AutoSortingTool() {
  const t = useTranslations("miniTools.autoSorting");
  const [products, setProducts] = useState<ProductData[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [lowStockThreshold, setLowStockThreshold] = useState(5);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{ sorted: number } | null>(null);

  const handleFileSelect = async (file: File) => {
    setFileName(file.name);
    setResult(null);
    try {
      const parsed = await parseProductFile(file);
      setProducts(parsed);
    } catch (error) {
      console.error("Error parsing file:", error);
    }
  };

  const processProducts = () => {
    setProcessing(true);

    // Group products by category
    const byCategory = new Map<string, ProductData[]>();
    products.forEach((product) => {
      const category = product.categoryText || "bez-kategorie";
      if (!byCategory.has(category)) {
        byCategory.set(category, []);
      }
      byCategory.get(category)!.push(product);
    });

    // Sort each category by stock (highest first) and assign priority
    const processed: { code: string; pairCode?: string; priority: number }[] = [];

    byCategory.forEach((categoryProducts) => {
      // Sort by stock descending (most stock first)
      const sorted = [...categoryProducts].sort((a, b) => b.stock - a.stock);

      // Assign priority within category (1, 2, 3, ...)
      sorted.forEach((product, index) => {
        const isVariant = product.pairCode && product.pairCode.trim() !== "";
        processed.push({
          code: product.code,
          ...(isVariant && { pairCode: product.pairCode }),
          priority: index + 1,
        });
      });
    });

    setResult({ sorted: processed.length });
    exportToXlsx(processed, "serazene-produkty");
    setProcessing(false);
  };

  const inStockCount = products.filter(p => p.stock > lowStockThreshold).length;
  const lowStockCount = products.filter(p => p.stock > 0 && p.stock <= lowStockThreshold).length;
  const soldOutCount = products.filter(p => p.stock === 0).length;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Nahrát produkty
          </CardTitle>
          <CardDescription>Nahrajte XLSX export produktů ze Shoptetu</CardDescription>
        </CardHeader>
        <CardContent>
          <FileUploadZone
            fileName={fileName}
            productCount={products.length}
            onFileSelect={handleFileSelect}
            isDragging={isDragging}
            setIsDragging={setIsDragging}
            id="auto-sort-file"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowUpDown className="h-5 w-5" />
            {t("title")}
          </CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {products.length > 0 ? (
            <>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Label htmlFor="threshold">{t("lowStockThreshold")}</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <HelpCircle className="h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">{t("lowStockInfo")}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Input
                  id="threshold"
                  type="number"
                  value={lowStockThreshold}
                  onChange={(e) => setLowStockThreshold(Number(e.target.value))}
                  min={1}
                  max={100}
                  className="w-24"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 bg-green-500/10 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">{inStockCount}</p>
                  <p className="text-xs text-muted-foreground">Skladem</p>
                  <Badge variant="outline" className="mt-1 text-[10px]">priority: 1</Badge>
                </div>
                <div className="text-center p-3 bg-yellow-500/10 rounded-lg">
                  <p className="text-2xl font-bold text-yellow-600">{lowStockCount}</p>
                  <p className="text-xs text-muted-foreground">Málo kusů</p>
                  <Badge variant="outline" className="mt-1 text-[10px]">priority: 5000</Badge>
                </div>
                <div className="text-center p-3 bg-red-500/10 rounded-lg">
                  <p className="text-2xl font-bold text-red-600">{soldOutCount}</p>
                  <p className="text-xs text-muted-foreground">Vyprodáno</p>
                  <Badge variant="outline" className="mt-1 text-[10px]">priority: 9999</Badge>
                </div>
              </div>

              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Badge variant="secondary">1. Skladem</Badge>
                <span>→</span>
                <Badge variant="secondary">2. Málo kusů</Badge>
                <span>→</span>
                <Badge variant="secondary">3. Vyprodáno</Badge>
              </div>

              <Separator />

              <Button
                onClick={processProducts}
                disabled={processing}
                className="w-full"
                size="lg"
              >
                <Download className="h-4 w-4 mr-2" />
                Seřadit a stáhnout
              </Button>

              {result && (
                <div className="flex items-center gap-3 p-4 bg-green-500/10 rounded-lg text-green-700">
                  <CheckCircle2 className="h-5 w-5" />
                  <div>
                    <p className="font-medium">Soubor byl stažen</p>
                    <p className="text-sm">Seřazeno {result.sorted} produktů</p>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <FileSpreadsheet className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nejprve nahrajte soubor s produkty</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============= TOOL 3: Wholesale Price Lists =============
function WholesalePriceTool() {
  const t = useTranslations("miniTools.wholesale");
  const [products, setProducts] = useState<ProductData[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [discountLevels, setDiscountLevels] = useState<DiscountLevel[]>([
    { id: "1", name: "Úroveň 1", discountPercent: 10 },
    { id: "2", name: "Úroveň 2", discountPercent: 20 },
    { id: "3", name: "Úroveň 3", discountPercent: 30 },
  ]);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{ count: number } | null>(null);

  const handleFileSelect = async (file: File) => {
    setFileName(file.name);
    setResult(null);
    try {
      const parsed = await parseProductFile(file);
      setProducts(parsed);
    } catch (error) {
      console.error("Error parsing file:", error);
    }
  };

  const addDiscountLevel = () => {
    setDiscountLevels([
      ...discountLevels,
      { id: String(Date.now()), name: `Úroveň ${discountLevels.length + 1}`, discountPercent: 5 },
    ]);
  };

  const removeDiscountLevel = (id: string) => {
    setDiscountLevels(discountLevels.filter((l) => l.id !== id));
  };

  const updateDiscountLevel = (id: string, field: keyof DiscountLevel, value: string | number) => {
    setDiscountLevels(discountLevels.map((l) => (l.id === id ? { ...l, [field]: value } : l)));
  };

  const generatePriceLists = () => {
    setProcessing(true);

    discountLevels.forEach((level) => {
      const priceListData = products.map((product) => ({
        code: product.code,
        name: product.name,
        originalPrice: product.price,
        discountPercent: level.discountPercent,
        wholesalePrice: Math.round(product.price * (1 - level.discountPercent / 100) * 100) / 100,
      }));
      exportToXlsx(priceListData, `velkoobchodni-cenik-${level.name.replace(/\s+/g, "-")}`);
    });

    setResult({ count: discountLevels.length });
    setProcessing(false);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Nahrát produkty
          </CardTitle>
          <CardDescription>Nahrajte XLSX export produktů ze Shoptetu</CardDescription>
        </CardHeader>
        <CardContent>
          <FileUploadZone
            fileName={fileName}
            productCount={products.length}
            onFileSelect={handleFileSelect}
            isDragging={isDragging}
            setIsDragging={setIsDragging}
            id="wholesale-file"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Percent className="h-5 w-5" />
            {t("title")}
          </CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">{t("discountLevels")}</Label>
              <Button variant="outline" size="sm" onClick={addDiscountLevel}>
                <Plus className="h-4 w-4 mr-1" />
                {t("addLevel")}
              </Button>
            </div>

            <div className="space-y-2">
              {discountLevels.map((level) => (
                <div key={level.id} className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                  <Input
                    value={level.name}
                    onChange={(e) => updateDiscountLevel(level.id, "name", e.target.value)}
                    className="flex-1"
                    placeholder={t("levelName")}
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">-</span>
                    <Input
                      type="number"
                      value={level.discountPercent}
                      onChange={(e) => updateDiscountLevel(level.id, "discountPercent", Number(e.target.value))}
                      className="w-20"
                      min={0}
                      max={100}
                    />
                    <span className="text-sm font-medium">%</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeDiscountLevel(level.id)}
                    disabled={discountLevels.length <= 1}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          <Button
            onClick={generatePriceLists}
            disabled={products.length === 0 || processing || discountLevels.length === 0}
            className="w-full"
            size="lg"
          >
            <Download className="h-4 w-4 mr-2" />
            {t("generate", { count: discountLevels.length })}
          </Button>

          {result && (
            <div className="flex items-center gap-3 p-4 bg-green-500/10 rounded-lg text-green-700">
              <CheckCircle2 className="h-5 w-5" />
              <div>
                <p className="font-medium">Ceníky byly staženy</p>
                <p className="text-sm">Vygenerováno {result.count} ceníků</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Helper: build category tree from product categoryText values
function buildCategoryTree(products: ProductData[]): CategoryNode[] {
  const pathCounts = new Map<string, number>();

  products.forEach((p) => {
    const cat = p.categoryText?.trim();
    if (!cat) return;
    // categoryText can be "Parent | Child | SubChild"
    const segments = cat.split("|").map((s) => s.trim());
    // Count each level path
    let path = "";
    for (const seg of segments) {
      path = path ? `${path} | ${seg}` : seg;
      pathCounts.set(path, (pathCounts.get(path) || 0) + 1);
    }
  });

  // Build tree from flat paths
  const rootNodes: CategoryNode[] = [];
  const nodeMap = new Map<string, CategoryNode>();

  const sortedPaths = [...pathCounts.keys()].sort();
  for (const fullPath of sortedPaths) {
    const segments = fullPath.split(" | ");
    const name = segments[segments.length - 1];
    const node: CategoryNode = {
      name,
      fullPath,
      children: [],
      productCount: pathCounts.get(fullPath) || 0,
    };
    nodeMap.set(fullPath, node);

    if (segments.length === 1) {
      rootNodes.push(node);
    } else {
      const parentPath = segments.slice(0, -1).join(" | ");
      const parent = nodeMap.get(parentPath);
      if (parent) {
        parent.children.push(node);
      } else {
        rootNodes.push(node);
      }
    }
  }

  return rootNodes;
}

// Category tree item component
function CategoryTreeItem({
  node,
  selectedCategories,
  onToggle,
  level = 0,
}: {
  node: CategoryNode;
  selectedCategories: string[];
  onToggle: (path: string, includeChildren: boolean) => void;
  level?: number;
}) {
  const [expanded, setExpanded] = useState(level < 1);
  const isSelected = selectedCategories.includes(node.fullPath);
  const hasChildren = node.children.length > 0;

  // Check if all children are selected
  const getAllPaths = (n: CategoryNode): string[] => {
    const paths = [n.fullPath];
    n.children.forEach((c) => paths.push(...getAllPaths(c)));
    return paths;
  };

  return (
    <div>
      <div
        className="flex items-center gap-2 py-1 px-2 rounded hover:bg-muted/50"
        style={{ paddingLeft: `${level * 20 + 8}px` }}
      >
        {hasChildren ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-4 h-4 flex items-center justify-center text-muted-foreground shrink-0"
          >
            <span className={`text-xs transition-transform ${expanded ? "rotate-90" : ""}`}>&#9654;</span>
          </button>
        ) : (
          <span className="w-4" />
        )}
        <Checkbox
          id={`cat-${node.fullPath}`}
          checked={isSelected}
          onCheckedChange={() => onToggle(node.fullPath, hasChildren)}
        />
        <label
          htmlFor={`cat-${node.fullPath}`}
          className="text-sm cursor-pointer flex-1 truncate"
        >
          {node.name}
        </label>
        <span className="text-xs text-muted-foreground shrink-0">{node.productCount}</span>
      </div>
      {expanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <CategoryTreeItem
              key={child.fullPath}
              node={child}
              selectedCategories={selectedCategories}
              onToggle={onToggle}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============= TOOL 4: Promotion Management =============
function PromotionManagementTool() {
  const [products, setProducts] = useState<ProductData[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{ affected: number; total: number } | null>(null);
  const [brandSearch, setBrandSearch] = useState("");

  const [config, setConfig] = useState<PromotionConfig>({
    flagName: "",
    flagValidFrom: "",
    flagValidUntil: "",
    priceFrom: "",
    priceTo: "",
    selectedBrands: [],
    selectedCategories: [],
    selectedBrandlessCodes: [],
    discountEnabled: false,
    discountType: "percent",
    discountValue: "",
    actionFrom: "",
    actionUntil: "",
  });

  const handleFileSelect = async (file: File) => {
    setFileName(file.name);
    setResult(null);
    try {
      const parsed = await parseProductFile(file);
      setProducts(parsed);
      // Reset selections when new file is loaded
      setConfig((prev) => ({
        ...prev,
        flagName: "",
        selectedBrands: [],
        selectedCategories: [],
        selectedBrandlessCodes: [],
      }));
    } catch (error) {
      console.error("Error parsing file:", error);
    }
  };

  const updateConfig = (field: keyof PromotionConfig, value: unknown) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
  };

  // flagName is already the slug from column name (e.g. "action" from "actionFlagActive")
  const flagSlug = config.flagName;

  // Extract available flags from column names (pattern: *FlagActive)
  const availableFlags: { slug: string; label: string }[] = (() => {
    if (products.length === 0) return [];
    const keys = Object.keys(products[0]);
    const flags: { slug: string; label: string }[] = [];
    for (const key of keys) {
      const match = key.match(/^(.+)FlagActive$/);
      if (match) {
        flags.push({ slug: match[1], label: key });
      }
    }
    return flags;
  })();

  // Extract unique brands from products
  const allBrands = [...new Set(
    products
      .map((p) => p.manufacturer?.trim())
      .filter((m): m is string => !!m && m !== "")
  )].sort();

  const brandlessProducts = products.filter(
    (p) => !p.manufacturer || p.manufacturer.trim() === ""
  );

  // Build category tree
  const categoryTree = buildCategoryTree(products);

  // Get all child paths for a category node
  const getAllChildPaths = (nodes: CategoryNode[], targetPath: string): string[] => {
    const paths: string[] = [];
    const findAndCollect = (nodeList: CategoryNode[]): boolean => {
      for (const node of nodeList) {
        if (node.fullPath === targetPath) {
          const collect = (n: CategoryNode) => {
            n.children.forEach((c) => {
              paths.push(c.fullPath);
              collect(c);
            });
          };
          collect(node);
          return true;
        }
        if (findAndCollect(node.children)) return true;
      }
      return false;
    };
    findAndCollect(nodes);
    return paths;
  };

  // Toggle brand selection
  const toggleBrand = (brand: string) => {
    setConfig((prev) => {
      const brands = prev.selectedBrands.includes(brand)
        ? prev.selectedBrands.filter((b) => b !== brand)
        : [...prev.selectedBrands, brand];
      return { ...prev, selectedBrands: brands };
    });
  };

  // Toggle category selection (with children)
  const toggleCategory = (path: string, includeChildren: boolean) => {
    setConfig((prev) => {
      const isSelected = prev.selectedCategories.includes(path);
      let updated: string[];

      if (isSelected) {
        // Deselect this + children
        const childPaths = includeChildren ? getAllChildPaths(categoryTree, path) : [];
        const toRemove = new Set([path, ...childPaths]);
        updated = prev.selectedCategories.filter((c) => !toRemove.has(c));
      } else {
        // Select this + children
        const childPaths = includeChildren ? getAllChildPaths(categoryTree, path) : [];
        updated = [...new Set([...prev.selectedCategories, path, ...childPaths])];
      }

      return { ...prev, selectedCategories: updated };
    });
  };

  // Filter products based on criteria
  const getFilteredProducts = (): ProductData[] => {
    let filtered = [...products];

    // Filter by price range
    if (config.priceFrom) {
      filtered = filtered.filter((p) => p.price >= Number(config.priceFrom));
    }
    if (config.priceTo) {
      filtered = filtered.filter((p) => p.price <= Number(config.priceTo));
    }

    // Filter by brands + individually selected brandless products
    const hasBrandFilter = config.selectedBrands.length > 0 || config.selectedBrandlessCodes.length > 0;
    if (hasBrandFilter) {
      filtered = filtered.filter((p) => {
        const brand = p.manufacturer?.trim() || "";
        if (brand === "" && config.selectedBrandlessCodes.includes(p.code)) return true;
        if (brand !== "" && config.selectedBrands.includes(brand)) return true;
        return false;
      });
    }

    // Filter by categories
    if (config.selectedCategories.length > 0) {
      filtered = filtered.filter((p) => {
        const cat = p.categoryText?.trim() || "";
        if (!cat) return false;
        return config.selectedCategories.some(
          (sel) => cat === sel || cat.startsWith(sel + " | ")
        );
      });
    }

    return filtered;
  };

  const filteredCount = products.length > 0 ? getFilteredProducts().length : 0;

  // Filtered brands for search
  const filteredBrands = brandSearch
    ? allBrands.filter((b) => b.toLowerCase().includes(brandSearch.toLowerCase()))
    : allBrands;

  const processProducts = () => {
    if (!config.flagName.trim()) return;

    setProcessing(true);

    const filtered = getFilteredProducts();
    const slug = flagSlug;

    const exportData = filtered.map((p) => {
      const row: Record<string, unknown> = {
        code: p.code,
        pairCode: p.pairCode || "",
      };

      // Flag columns
      row[`${slug}FlagActive`] = 1;

      if (config.flagValidFrom) {
        row[`${slug}FlagValidFrom`] = config.flagValidFrom;
      }
      if (config.flagValidUntil) {
        row[`${slug}FlagValidUntil`] = config.flagValidUntil;
      }

      // Price modification -> actionPrice, actionFrom, actionUntil
      if (config.discountEnabled && config.discountValue) {
        const val = Number(config.discountValue);
        let actionPrice: number;

        if (config.discountType === "percent") {
          actionPrice = Math.round(p.price * (1 - val / 100) * 100) / 100;
        } else {
          actionPrice = Math.round((p.price - val) * 100) / 100;
          if (actionPrice < 0) actionPrice = 0;
        }

        row.actionPrice = actionPrice;

        if (config.actionFrom) {
          row.actionFrom = config.actionFrom;
        }
        if (config.actionUntil) {
          row.actionUntil = config.actionUntil;
        }
      }

      return row;
    });

    setResult({ affected: exportData.length, total: products.length });

    if (exportData.length > 0) {
      const filename = `akce-${slug}-${new Date().toISOString().slice(0, 10)}`;
      exportToXlsx(exportData, filename);
    }

    setProcessing(false);
  };

  return (
    <div className="space-y-6">
      {/* Row 1: File upload + Flag name */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Nahrát produkty
            </CardTitle>
            <CardDescription>Nahrajte XLSX export produktů ze Shoptetu</CardDescription>
          </CardHeader>
          <CardContent>
            <FileUploadZone
              fileName={fileName}
              productCount={products.length}
              onFileSelect={handleFileSelect}
              isDragging={isDragging}
              setIsDragging={setIsDragging}
              id="promo-file"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              Příznak (Flag)
            </CardTitle>
            <CardDescription>
              {products.length > 0
                ? "Vyberte příznak z dostupných ve vašem souboru"
                : "Nahrajte soubor pro zobrazení dostupných příznaků"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {products.length > 0 && availableFlags.length > 0 ? (
              <>
                <div>
                  <Label>Vyberte příznak</Label>
                  <div className="mt-2 space-y-1">
                    {availableFlags.map((flag) => (
                      <div
                        key={flag.slug}
                        onClick={() => updateConfig("flagName", flag.slug)}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          config.flagName === flag.slug
                            ? "border-primary bg-primary/5"
                            : "border-muted hover:border-muted-foreground/30"
                        }`}
                      >
                        <input
                          type="radio"
                          name="flagSelect"
                          checked={config.flagName === flag.slug}
                          onChange={() => updateConfig("flagName", flag.slug)}
                          className="accent-primary"
                        />
                        <div className="flex-1">
                          <p className="text-sm font-medium">{flag.slug}</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            <Badge variant="outline" className="text-[10px]">{flag.slug}FlagActive</Badge>
                            <Badge variant="outline" className="text-[10px]">{flag.slug}FlagValidFrom</Badge>
                            <Badge variant="outline" className="text-[10px]">{flag.slug}FlagValidUntil</Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {flagSlug && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="flag-from">Platnost od</Label>
                      <Input
                        id="flag-from"
                        type="date"
                        value={config.flagValidFrom}
                        onChange={(e) => updateConfig("flagValidFrom", e.target.value)}
                        className="mt-2"
                      />
                    </div>
                    <div>
                      <Label htmlFor="flag-until">Platnost do</Label>
                      <Input
                        id="flag-until"
                        type="date"
                        value={config.flagValidUntil}
                        onChange={(e) => updateConfig("flagValidUntil", e.target.value)}
                        className="mt-2"
                      />
                    </div>
                  </div>
                )}
              </>
            ) : products.length > 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">V souboru nebyly nalezeny žádné příznaky</p>
                <p className="text-xs mt-1">(hledány sloupce *FlagActive)</p>
              </div>
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                <FileSpreadsheet className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nejprve nahrajte soubor</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Filters */}
      {products.length > 0 && (
        <>
          {/* Price filter */}
          <Card>
            <CardHeader>
              <CardTitle>Filtr ceny</CardTitle>
              <CardDescription>Omezení podle cenového rozsahu</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 max-w-md">
                <div>
                  <Label htmlFor="price-from">Cena od (Kč)</Label>
                  <Input
                    id="price-from"
                    type="number"
                    placeholder="0"
                    value={config.priceFrom}
                    onChange={(e) => updateConfig("priceFrom", e.target.value)}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="price-to">Cena do (Kč)</Label>
                  <Input
                    id="price-to"
                    type="number"
                    placeholder="bez limitu"
                    value={config.priceTo}
                    onChange={(e) => updateConfig("priceTo", e.target.value)}
                    className="mt-2"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Brand multiselect */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Značky (manufacturer)</CardTitle>
                  <CardDescription>
                    {config.selectedBrands.length > 0
                      ? `Vybráno ${config.selectedBrands.length} z ${allBrands.length} značek`
                      : "Vyberte značky pro zahrnutí do akce"}
                  </CardDescription>
                </div>
                {config.selectedBrands.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => updateConfig("selectedBrands", [])}
                  >
                    Zrušit výběr
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {allBrands.length > 10 && (
                <Input
                  placeholder="Hledat značku..."
                  value={brandSearch}
                  onChange={(e) => setBrandSearch(e.target.value)}
                />
              )}

              <div className="border rounded-lg max-h-48 overflow-y-auto p-2 space-y-1">
                {filteredBrands.map((brand) => (
                  <div key={brand} className="flex items-center gap-2 py-1 px-2 rounded hover:bg-muted/50">
                    <Checkbox
                      id={`brand-${brand}`}
                      checked={config.selectedBrands.includes(brand)}
                      onCheckedChange={() => toggleBrand(brand)}
                    />
                    <label htmlFor={`brand-${brand}`} className="text-sm cursor-pointer flex-1">
                      {brand}
                    </label>
                    <span className="text-xs text-muted-foreground">
                      {products.filter((p) => p.manufacturer?.trim() === brand).length}
                    </span>
                  </div>
                ))}
                {filteredBrands.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    Žádné značky nenalezeny
                  </p>
                )}
              </div>

              {/* Brandless products list */}
              {brandlessProducts.length > 0 && (
                <div className="border border-yellow-500/30 bg-yellow-500/5 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-600" />
                      <span className="text-sm font-medium text-yellow-700">
                        {brandlessProducts.length} produktů bez značky
                      </span>
                    </div>
                    <div className="flex gap-2">
                      {config.selectedBrandlessCodes.length > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateConfig("selectedBrandlessCodes", [])}
                          className="h-7 text-xs"
                        >
                          Zrušit ({config.selectedBrandlessCodes.length})
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          updateConfig(
                            "selectedBrandlessCodes",
                            config.selectedBrandlessCodes.length === brandlessProducts.length
                              ? []
                              : brandlessProducts.map((p) => p.code)
                          )
                        }
                        className="h-7 text-xs"
                      >
                        {config.selectedBrandlessCodes.length === brandlessProducts.length
                          ? "Odznačit vše"
                          : "Vybrat vše"}
                      </Button>
                    </div>
                  </div>
                  <div className="border border-yellow-500/20 rounded max-h-48 overflow-y-auto bg-background">
                    {brandlessProducts.map((p) => (
                      <div
                        key={p.code}
                        className="flex items-center gap-2 py-1.5 px-3 hover:bg-muted/50 border-b border-yellow-500/10 last:border-b-0"
                      >
                        <Checkbox
                          id={`bl-${p.code}`}
                          checked={config.selectedBrandlessCodes.includes(p.code)}
                          onCheckedChange={() => {
                            const codes = config.selectedBrandlessCodes.includes(p.code)
                              ? config.selectedBrandlessCodes.filter((c) => c !== p.code)
                              : [...config.selectedBrandlessCodes, p.code];
                            updateConfig("selectedBrandlessCodes", codes);
                          }}
                        />
                        <label htmlFor={`bl-${p.code}`} className="text-xs font-mono cursor-pointer shrink-0">
                          {p.code}
                        </label>
                        <label htmlFor={`bl-${p.code}`} className="text-sm cursor-pointer flex-1 truncate">
                          {p.name}
                        </label>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {p.price?.toLocaleString()} Kč
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Category tree */}
          {categoryTree.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Kategorie</CardTitle>
                    <CardDescription>
                      {config.selectedCategories.length > 0
                        ? `Vybráno ${config.selectedCategories.length} kategorií`
                        : "Vyberte kategorie. Výběr rodičovské kategorie zahrne i její podkategorie."}
                    </CardDescription>
                  </div>
                  {config.selectedCategories.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateConfig("selectedCategories", [])}
                    >
                      Zrušit výběr
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg max-h-64 overflow-y-auto p-2">
                  {categoryTree.map((node) => (
                    <CategoryTreeItem
                      key={node.fullPath}
                      node={node}
                      selectedCategories={config.selectedCategories}
                      onToggle={toggleCategory}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Row 3: Price modification */}
      <Card>
        <CardHeader>
          <CardTitle>Akční cena (volitelné)</CardTitle>
          <CardDescription>Nastavte slevu a období platnosti akční ceny</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="discount-enabled"
              checked={config.discountEnabled}
              onCheckedChange={(checked) => updateConfig("discountEnabled", !!checked)}
            />
            <label htmlFor="discount-enabled" className="text-sm font-medium cursor-pointer">
              Nastavit akční cenu
            </label>
          </div>

          {config.discountEnabled && (
            <div className="space-y-4 pl-6">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    id="discount-percent"
                    name="discountType"
                    checked={config.discountType === "percent"}
                    onChange={() => updateConfig("discountType", "percent")}
                    className="accent-primary"
                  />
                  <label htmlFor="discount-percent" className="text-sm cursor-pointer">Sleva v %</label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    id="discount-fixed"
                    name="discountType"
                    checked={config.discountType === "fixed"}
                    onChange={() => updateConfig("discountType", "fixed")}
                    className="accent-primary"
                  />
                  <label htmlFor="discount-fixed" className="text-sm cursor-pointer">Fixní sleva (Kč)</label>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <Label htmlFor="discount-value">
                    {config.discountType === "percent" ? "Sleva (%)" : "Sleva (Kč)"}
                  </Label>
                  <Input
                    id="discount-value"
                    type="number"
                    placeholder={config.discountType === "percent" ? "10" : "100"}
                    min={0}
                    max={config.discountType === "percent" ? 100 : undefined}
                    value={config.discountValue}
                    onChange={(e) => updateConfig("discountValue", e.target.value)}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="action-from">actionFrom</Label>
                  <Input
                    id="action-from"
                    type="date"
                    value={config.actionFrom}
                    onChange={(e) => updateConfig("actionFrom", e.target.value)}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="action-until">actionUntil</Label>
                  <Input
                    id="action-until"
                    type="date"
                    value={config.actionUntil}
                    onChange={(e) => updateConfig("actionUntil", e.target.value)}
                    className="mt-2"
                  />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary + Action */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Připraveno ke zpracování</p>
              <p className="text-sm text-muted-foreground">
                {!config.flagName
                  ? "Zadejte název příznaku"
                  : products.length === 0
                  ? "Nahrajte soubor s produkty"
                  : `${filteredCount} produktů k úpravě`}
              </p>
            </div>
            <Button
              onClick={processProducts}
              disabled={products.length === 0 || !config.flagName.trim() || filteredCount === 0 || processing}
              size="lg"
            >
              <Download className="h-4 w-4 mr-2" />
              Zpracovat a stáhnout
            </Button>
          </div>

          {result && (
            <div className="flex items-center gap-3 p-4 mt-4 bg-green-500/10 rounded-lg text-green-700">
              <CheckCircle2 className="h-5 w-5" />
              <div>
                <p className="font-medium">Soubor byl stažen</p>
                <p className="text-sm">Upraveno {result.affected} z {result.total} produktů</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============= MAIN COMPONENT =============
export function MiniToolsClient() {
  const t = useTranslations("miniTools");

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t("pageTitle")}</h1>
        <p className="text-muted-foreground mt-1">{t("pageDescription")}</p>
      </div>

      <Tabs defaultValue="hide-sold-out" className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-auto p-1">
          <TabsTrigger value="hide-sold-out" className="flex items-center gap-2 py-3">
            <EyeOff className="h-4 w-4" />
            <span className="hidden md:inline">{t("tabs.hideSoldOut")}</span>
          </TabsTrigger>
          <TabsTrigger value="wholesale" className="flex items-center gap-2 py-3">
            <Percent className="h-4 w-4" />
            <span className="hidden md:inline">{t("tabs.wholesale")}</span>
          </TabsTrigger>
          <TabsTrigger value="promotions" className="flex items-center gap-2 py-3">
            <Tag className="h-4 w-4" />
            <span className="hidden md:inline">{t("tabs.promotions")}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="hide-sold-out" className="mt-6">
          <HideSoldOutTool />
        </TabsContent>

        <TabsContent value="wholesale" className="mt-6">
          <WholesalePriceTool />
        </TabsContent>

        <TabsContent value="promotions" className="mt-6">
          <PromotionManagementTool />
        </TabsContent>
      </Tabs>
    </div>
  );
}
