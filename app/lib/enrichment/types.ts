import { z } from "zod";

// Platform types
export type Platform = "shoptet" | "upgates";

// Available source columns for AI extraction
export type SourceColumn =
  | "name"
  | "shortDescription"
  | "description"
  | "weight"
  | "warranty"
  | "manufacturer"
  | "supplier";

// Generation mode for AI
export type GenerationMode = "strict" | "expand";

// Existing attributes for category schema injection
export interface ExistingAttributes {
  filtering: string[]; // List of existing filtering parameter names in category
  text: string[]; // List of existing text parameter keys in category
}

// Enrichment configuration
export interface EnrichmentConfig {
  platform: Platform;
  generateFiltering: boolean;
  generateTextProperties: boolean;
  filteringInstructions: string;
  textPropertyInstructions: string;
  productContext: string; // Custom context about the products (e.g. "auto parts for Škoda")
  generationMode: GenerationMode; // "strict" = only specified params, "expand" = AI can add more
  sourceColumns: SourceColumn[];
  maxFilteringParams: number;
  maxTextParams: number;
  clearExistingProperties: boolean;
  // Category schema injection for parameter unification
  categoryName?: string;
  existingAttributes?: ExistingAttributes;
}

// Parsed file data
export interface ParsedFileData {
  headers: string[];
  rows: ProductRow[];
  totalRows: number;
  fileName: string;
}

// AI extraction result for a single row
export interface AIExtractionResult {
  filtering: FilteringProperty[];
  text: TextProperty[];
}

export interface FilteringProperty {
  name: string;
  value: string;
}

export interface TextProperty {
  key: string;
  value: string;
}

// Single product row - base data from file
export interface ProductRow {
  rowIndex: number;
  shortDescription?: string;
  description?: string;
  textProperty?: string;
  [key: string]: string | number | undefined;
}

// Enriched row with AI results - separate interface to avoid index signature conflicts
export interface EnrichedRow {
  rowIndex: number;
  shortDescription?: string;
  description?: string;
  textProperty?: string;
  aiResult?: AIExtractionResult;
  error?: string;
  [key: string]: string | number | AIExtractionResult | undefined;
}

// Preview result
export interface PreviewResult {
  originalRows: ProductRow[];
  enrichedRows: EnrichedRow[];
  success: boolean;
  errors?: string[];
}

// Processing status
export type ProcessingStatus = "idle" | "processing" | "completed" | "error";

// Progress update
export interface ProgressUpdate {
  processed: number;
  total: number;
  currentRow?: number;
  status: ProcessingStatus;
  error?: string;
}

// File validation result
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  headers?: string[];
  rowCount?: number;
}

// Zod schemas for validation
export const filteringPropertySchema = z.object({
  name: z.string().min(1),
  value: z.string(),
});

export const textPropertySchema = z.object({
  key: z.string().min(1),
  value: z.string(),
});

export const aiExtractionResultSchema = z.object({
  filtering: z.array(filteringPropertySchema),
  text: z.array(textPropertySchema),
});

export const enrichmentConfigSchema = z.object({
  platform: z.enum(["shoptet", "upgates"]),
  generateFiltering: z.boolean(),
  generateTextProperties: z.boolean(),
  filteringInstructions: z.string(),
  textPropertyInstructions: z.string(),
  sourceColumns: z
    .array(
      z.enum([
        "name",
        "shortDescription",
        "description",
        "weight",
        "warranty",
        "manufacturer",
        "supplier",
      ])
    )
    .min(1),
  maxFilteringParams: z.number().min(1).max(20),
  maxTextParams: z.number().min(1).max(20),
  clearExistingProperties: z.boolean(),
});

// Category group for product organization
export interface CategoryGroup {
  categoryName: string;
  categoryPath: string[]; // полный путь категории
  products: EnrichedRow[];
  commonParams: {
    filtering: string[]; // общие filtering параметры (названия)
    text: string[]; // общие text параметры (ключи)
  };
}

// Shoptet specific constants
// Required headers that MUST be in the export file (minimum for AI extraction to work)
export const SHOPTET_REQUIRED_HEADERS = [
  "code",
  "name",
  "shortDescription",
  "description",
] as const;

export const SHOPTET_FILTERING_PREFIX = "filteringProperty:";
export const SHOPTET_TEXT_PROPERTY_PREFIX = "textProperty";

// Shoptet category columns
export const SHOPTET_CATEGORY_COLUMNS = [
  "defaultCategory",
  "categoryText",
  "categoryText2",
  "categoryText3",
  "categoryText4",
  "categoryText5",
] as const;

// All allowed Shoptet columns (for validation)
// Note: metaTitle removed - doesn't exist in standard Shoptet exports
// Note: image* and categoryText* columns are validated via regex in shoptet-adapter.ts
export const SHOPTET_ALLOWED_COLUMNS = [
  // Required
  "code",
  "name",
  "shortDescription",
  "description",
  "adult",
  "metaDescription",
  // Category columns (base - others handled by regex: categoryText, categoryText2, etc.)
  "defaultCategory",
  // Image columns (base - others handled by regex: image, image2, ... image57)
  "defaultImage",
  // Optional - used by AI for analysis
  "weight",
  "warranty",
  "manufacturer",
  "supplier",
  // Optional - preserved in output
  "ean",
  "price",
  "priceBefore",
  "currency",
  "vat",
  "stock",
  "minStock",
  "unit",
  "visibility",
  // Other allowed columns
  "pairCode",
  "__EMPTY",
] as const;

// Columns that should be selected in Shoptet export
// Note: metaTitle was removed - it doesn't exist in standard Shoptet exports
export const SHOPTET_EXPORT_RECOMMENDED_COLUMNS = [
  { name: "code", required: true, description: "Kód produktu" },
  { name: "name", required: true, description: "Název produktu" },
  { name: "shortDescription", required: true, description: "Krátký popis" },
  { name: "description", required: true, description: "Popis" },
  { name: "categoryText", required: false, description: "Kategorie" },
  { name: "adult", required: false, description: "Pro dospělé" },
  { name: "metaDescription", required: false, description: "Meta popis" },
  { name: "manufacturer", required: false, description: "Výrobce (pro AI analýzu)" },
  { name: "weight", required: false, description: "Hmotnost (pro AI analýzu)" },
] as const;
