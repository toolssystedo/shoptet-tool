import * as XLSX from 'xlsx';

// ============= TYPES =============

export interface CategoryData {
  code: string;
  name: string;
  parentCode?: string;
  path?: string; // Full path like "Kategorie > Podkategorie > Další"
  description?: string;
  image?: string;
  isActive?: boolean;
  productCount?: number;
  order?: number;
}

export interface ProductVariant {
  code: string;
  name: string;
  price?: number;
  priceBeforeDiscount?: number;
  stock?: number;
  availability?: string;
  parameters?: Record<string, string>;
  image?: string;
}

export interface ProductImage {
  url: string;
  alt?: string;
  width?: number;
  height?: number;
  size?: number; // in bytes
}

export interface ProductData {
  code: string;
  name: string;
  shortDescription?: string;
  description?: string;
  defaultCategory?: string;
  categoryText?: string; // Full category path
  additionalCategories?: string[];
  // Price fields
  price?: number;
  priceBeforeDiscount?: number;
  purchasePrice?: number;
  // Availability fields
  availability?: string;
  availabilityInStock?: string; // Text shown when product IS in stock
  availabilityOutOfStock?: string; // Text shown when product is NOT in stock
  deliveryDays?: number;
  stock?: number;
  stockLastUpdated?: Date;
  // Product details
  ean?: string;
  manufacturer?: string;
  brand?: string;
  warranty?: string;
  weight?: number;
  // Images
  image?: string;
  images?: ProductImage[];
  imageCount?: number;
  // Parameters/Attributes
  parameters?: Record<string, string>;
  filterParameters?: string[];
  // Flags & dates
  isAction?: boolean;
  isNew?: boolean;
  isVisible?: boolean;
  actionEndDate?: Date;
  createdAt?: Date;
  updatedAt?: Date;
  // Variants
  variants?: ProductVariant[];
  parentCode?: string; // For variant products
}

export interface DuplicateGroup {
  type: 'exact' | 'near';
  similarity: number;
  products: ProductData[];
  text: string;
}

export interface ContentIssue {
  type:
    | 'duplicate_description'
    | 'near_duplicate'
    | 'same_short_long'
    | 'too_short'
    | 'lorem_ipsum'
    | 'test_content'
    | 'wrong_language'
    | 'no_description'
    | 'html_in_description'
    | 'url_in_description'
    | 'emoji_spam';
  productCode: string;
  productName: string;
  severity: 'error' | 'warning';
  details?: string;
  relatedProducts?: string[];
}

// 2.1 Kompletnost produktů
export interface CompletenessIssue {
  type:
    | 'no_image'
    | 'single_image'
    | 'no_short_description'
    | 'no_long_description'
    | 'short_description_too_short'
    | 'no_price'
    | 'zero_price'
    | 'no_ean'
    | 'no_manufacturer'
    | 'no_category'
    | 'no_filter_parameters';
  productCode: string;
  productName: string;
  severity: 'error' | 'warning';
  details?: string;
}

// 2.2 Kvalita dat
export interface DataQualityIssue {
  type:
    | 'duplicate_name'
    | 'duplicate_code'
    | 'duplicate_ean'
    | 'html_errors'
    | 'inline_styles'
    | 'image_wrong_aspect'
    | 'image_low_resolution'
    | 'image_too_large'
    | 'image_no_alt'
    | 'image_generic_alt';
  productCode: string;
  productName: string;
  severity: 'error' | 'warning';
  details?: string;
  relatedProducts?: string[];
}

// 2.3 Varianty
export interface VariantIssue {
  type:
    | 'variant_no_diff_params'
    | 'variant_identical_names'
    | 'variant_no_image'
    | 'variant_inconsistent_naming'
    | 'orphan_variant';
  productCode: string;
  productName: string;
  severity: 'error' | 'warning';
  details?: string;
  relatedProducts?: string[];
}

// 2.4 Skladovost
export interface StockIssue {
  type:
    | 'in_stock_zero_quantity'
    | 'negative_stock'
    | 'variant_stock_inconsistent'
    | 'long_sold_out'
    | 'no_availability_in_stock'
    | 'no_availability_out_of_stock'
    | 'wrong_availability_in_stock'
    | 'wrong_availability_out_of_stock';
  productCode: string;
  productName: string;
  severity: 'error' | 'warning';
  details?: string;
}

// 3.1 Struktura kategorií
export interface CategoryIssue {
  type:
    | 'empty_category'
    | 'single_product_category'
    | 'too_deep_category'
    | 'orphan_category'
    | 'duplicate_category_name'
    | 'category_no_description';
  categoryPath: string;
  categoryName: string;
  severity: 'error' | 'warning';
  details?: string;
  productCount?: number;
}

// 3.2 Zařazení produktů
export interface ProductCategoryIssue {
  type:
    | 'multiple_main_categories'
    | 'no_default_category'
    | 'inactive_category'
    | 'inconsistent_categorization';
  productCode: string;
  productName: string;
  severity: 'error' | 'warning';
  details?: string;
  categories?: string[];
}

export interface BusinessIssue {
  type:
    // Price issues
    | 'discount_higher_than_price'
    | 'zero_price'
    | 'negative_price'
    | 'suspicious_round_price'
    | 'large_variant_price_diff'
    | 'larger_cheaper'
    // Availability issues
    | 'stock_delivery_conflict'
    | 'long_inquiry_product'
    | 'inconsistent_stock'
    // Promo issues
    | 'expired_action'
    | 'old_product_new_flag'
    | 'permanent_action'
    | 'suspicious_discount';
  productCode: string;
  productName: string;
  severity: 'error' | 'warning';
  details?: string;
  category: 'price' | 'availability' | 'promo';
}

export interface ContentAuditReport {
  totalProducts: number;
  analyzedAt: Date;

  // Content issues (original)
  issues: ContentIssue[];
  businessIssues: BusinessIssue[];
  duplicateGroups: DuplicateGroup[];

  // New issue categories
  completenessIssues: CompletenessIssue[];
  dataQualityIssues: DataQualityIssue[];
  variantIssues: VariantIssue[];
  stockIssues: StockIssue[];
  categoryIssues: CategoryIssue[];
  productCategoryIssues: ProductCategoryIssue[];

  stats: {
    withDescription: number;
    withShortDescription: number;
    avgDescriptionLength: number;
    avgShortDescriptionLength: number;
    withPrice: number;
    withStock: number;
    inAction: number;
    // New stats
    withImages: number;
    avgImageCount: number;
    withEan: number;
    withManufacturer: number;
    withCategory: number;
    withVariants: number;
    totalVariants: number;
    totalCategories: number;
  };

  scores: {
    uniqueness: number;
    quality: number;
    completeness: number;
    business: number;
    dataQuality: number;
    stock: number;
    categories: number;
    overall: number;
  };
}

// ============= FILE PARSING =============

function parseNumber(value: string | number | undefined): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const num = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.').replace(/\s/g, ''));
  return isNaN(num) ? undefined : num;
}

function parseDate(value: string | number | undefined): Date | undefined {
  if (value === undefined || value === null || value === '') return undefined;

  // Handle Excel serial dates
  if (typeof value === 'number') {
    const excelEpoch = new Date(1899, 11, 30);
    return new Date(excelEpoch.getTime() + value * 24 * 60 * 60 * 1000);
  }

  const date = new Date(value);
  return isNaN(date.getTime()) ? undefined : date;
}

function parseBoolean(value: string | number | undefined): boolean {
  if (value === undefined || value === null || value === '') return false;
  const str = String(value).toLowerCase();
  return str === 'true' || str === '1' || str === 'ano' || str === 'yes';
}

export function parseProductFile(file: ArrayBuffer, fileName: string): ProductData[] {
  const products: ProductData[] = [];

  try {
    const workbook = XLSX.read(file, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet);

    for (const row of data) {
      // Shoptet column names (support both Czech and English)
      const product: ProductData = {
        code: row['code'] || row['CODE'] || row['Kód'] || '',
        name: row['name'] || row['NAME'] || row['Název'] || '',
        shortDescription: row['shortDescription'] || row['SHORT_DESCRIPTION'] || row['Krátký popis'] || row['perex'] || '',
        description: row['description'] || row['DESCRIPTION'] || row['Popis'] || row['Dlouhý popis'] || '',
        defaultCategory: row['defaultCategory'] || row['DEFAULT_CATEGORY'] || row['Kategorie'] || row['Výchozí kategorie'] || '',
        categoryText: row['categoryText'] || row['CATEGORY_TEXT'] || row['Cesta kategorie'] || '',
        // Price fields
        price: parseNumber(row['price'] || row['PRICE'] || row['Cena'] || row['Cena s DPH']),
        priceBeforeDiscount: parseNumber(row['priceBeforeDiscount'] || row['PRICE_BEFORE_DISCOUNT'] || row['Cena před slevou'] || row['Původní cena']),
        purchasePrice: parseNumber(row['purchasePrice'] || row['PURCHASE_PRICE'] || row['Nákupní cena']),
        // Availability fields
        availability: row['availability'] || row['AVAILABILITY'] || row['Dostupnost'] || '',
        availabilityInStock: row['availabilityInStock'] || row['AVAILABILITY_IN_STOCK'] || row['Dostupnost skladem'] || row['Dostupnost při skladové zásobě'] || '',
        availabilityOutOfStock: row['availabilityOutOfStock'] || row['AVAILABILITY_OUT_OF_STOCK'] || row['Dostupnost vyprodáno'] || row['Dostupnost při vyprodání'] || '',
        deliveryDays: parseNumber(row['deliveryDays'] || row['DELIVERY_DAYS'] || row['Dodací doba'] || row['Doba dodání']),
        stock: parseNumber(row['stock'] || row['STOCK'] || row['Sklad'] || row['Skladem'] || row['Množství']),
        // Product details
        ean: row['ean'] || row['EAN'] || row['GTIN'] || row['gtin'] || '',
        manufacturer: row['manufacturer'] || row['MANUFACTURER'] || row['Výrobce'] || row['brand'] || row['BRAND'] || row['Značka'] || '',
        brand: row['brand'] || row['BRAND'] || row['Značka'] || '',
        warranty: row['warranty'] || row['WARRANTY'] || row['Záruka'] || '',
        weight: parseNumber(row['weight'] || row['WEIGHT'] || row['Váha'] || row['Hmotnost']),
        // Images
        image: row['image'] || row['IMAGE'] || row['Obrázek'] || row['Hlavní obrázek'] || '',
        imageCount: countImages(row),
        // Flags & dates
        isAction: parseBoolean(row['isAction'] || row['IS_ACTION'] || row['Akce'] || row['V akci']),
        isNew: parseBoolean(row['isNew'] || row['IS_NEW'] || row['Novinka']),
        isVisible: parseBoolean(row['visible'] || row['VISIBLE'] || row['Viditelný'] || row['Aktivní'] || 'true'),
        actionEndDate: parseDate(row['actionEndDate'] || row['ACTION_END_DATE'] || row['Konec akce']),
        createdAt: parseDate(row['createdAt'] || row['CREATED_AT'] || row['Vytvořeno'] || row['Datum vytvoření']),
        updatedAt: parseDate(row['updatedAt'] || row['UPDATED_AT'] || row['Upraveno'] || row['Datum úpravy']),
        // Variant info
        parentCode: row['parentCode'] || row['PARENT_CODE'] || row['Rodičovský kód'] || row['Kód rodiče'] || '',
      };

      // Parse filter parameters from multiple possible columns
      product.filterParameters = parseFilterParameters(row);

      if (product.code) {
        products.push(product);
      }
    }
  } catch (error) {
    console.error('Error parsing file:', error);
  }

  return products;
}

// Count images from multiple image columns
function countImages(row: Record<string, any>): number {
  let count = 0;
  // Main image
  if (row['image'] || row['IMAGE'] || row['Obrázek'] || row['Hlavní obrázek']) count++;
  // Additional images (image2, image3, ... or Obrázek 2, etc.)
  for (let i = 2; i <= 20; i++) {
    if (row[`image${i}`] || row[`IMAGE${i}`] || row[`Obrázek ${i}`] || row[`additionalImage${i}`]) {
      count++;
    }
  }
  // Or check additionalImages column (comma-separated)
  const additionalImages = row['additionalImages'] || row['ADDITIONAL_IMAGES'] || row['Další obrázky'] || '';
  if (additionalImages) {
    count += additionalImages.split(',').filter((s: string) => s.trim()).length;
  }
  return count;
}

// Parse filter parameters
function parseFilterParameters(row: Record<string, any>): string[] {
  const params: string[] = [];

  // Check for filterParams column
  const filterParamsStr = row['filterParams'] || row['FILTER_PARAMS'] || row['Parametry pro filtr'] || '';
  if (filterParamsStr) {
    params.push(...filterParamsStr.split(',').map((s: string) => s.trim()).filter(Boolean));
  }

  // Check for individual parameter columns (param1, param2, etc.)
  for (let i = 1; i <= 20; i++) {
    const paramName = row[`paramName${i}`] || row[`PARAM_NAME_${i}`] || row[`Parametr ${i} název`];
    const paramValue = row[`paramValue${i}`] || row[`PARAM_VALUE_${i}`] || row[`Parametr ${i} hodnota`];
    if (paramName && paramValue) {
      params.push(`${paramName}:${paramValue}`);
    }
  }

  return params;
}

// ============= CATEGORY FILE PARSING =============

export function parseCategoryFile(file: ArrayBuffer, fileName: string): CategoryData[] {
  const categories: CategoryData[] = [];

  try {
    const workbook = XLSX.read(file, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet);

    for (const row of data) {
      const category: CategoryData = {
        code: row['code'] || row['CODE'] || row['Kód'] || row['guid'] || row['GUID'] || '',
        name: row['name'] || row['NAME'] || row['Název'] || row['Jméno'] || '',
        parentCode: row['parentCode'] || row['PARENT_CODE'] || row['parentGuid'] || row['PARENT_GUID'] || row['Rodičovská kategorie'] || row['Kód rodiče'] || '',
        path: row['path'] || row['PATH'] || row['Cesta'] || row['categoryText'] || '',
        description: row['description'] || row['DESCRIPTION'] || row['Popis'] || '',
        image: row['image'] || row['IMAGE'] || row['Obrázek'] || '',
        isActive: parseBoolean(row['active'] || row['ACTIVE'] || row['Aktivní'] || row['visible'] || row['VISIBLE'] || 'true'),
        productCount: parseNumber(row['productCount'] || row['PRODUCT_COUNT'] || row['Počet produktů']),
        order: parseNumber(row['order'] || row['ORDER'] || row['Pořadí'] || row['priority'] || row['PRIORITY']),
      };

      if (category.code || category.name) {
        categories.push(category);
      }
    }
  } catch (error) {
    console.error('Error parsing category file:', error);
  }

  return categories;
}

// ============= TEXT ANALYSIS =============

// Remove HTML tags for analysis
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

// Calculate text similarity (Jaccard)
function calculateSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  const words2 = new Set(text2.toLowerCase().split(/\s+/).filter(w => w.length > 2));

  if (words1.size === 0 || words2.size === 0) return 0;

  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}

// Check for Lorem Ipsum
function hasLoremIpsum(text: string): boolean {
  const loremPatterns = [
    /lorem\s+ipsum/i,
    /dolor\s+sit\s+amet/i,
    /consectetur\s+adipiscing/i,
    /sed\s+do\s+eiusmod/i,
  ];
  return loremPatterns.some(pattern => pattern.test(text));
}

// Check for test content
function hasTestContent(text: string): boolean {
  const testPatterns = [
    /test\s*(popis|description|text)/i,
    /xxx+/i,
    /\[todo\]/i,
    /\[placeholder\]/i,
    /doplnit/i,
    /tbd/i,
    /asdf/i,
    /qwerty/i,
  ];
  return testPatterns.some(pattern => pattern.test(text));
}

// Detect language (simple heuristic)
function detectLanguage(text: string): 'cs' | 'en' | 'de' | 'unknown' {
  const stripped = stripHtml(text).toLowerCase();

  // Czech indicators
  const czechWords = ['a', 'v', 'na', 'je', 'se', 'do', 'pro', 'jsou', 'má', 'jeho', 'která', 'který', 'které', 'při', 'jako', 'nebo', 'také', 'jen', 'ale', 'pak', 'tak', 'již', 'být', 'více', 'pouze', 'všech', 'vám', 'jejich'];
  const czechChars = /[ěščřžýáíéůúďťň]/;

  // German indicators
  const germanWords = ['und', 'der', 'die', 'das', 'ist', 'für', 'mit', 'auf', 'des', 'den', 'von', 'sind', 'wird', 'bei', 'nach', 'aus', 'oder', 'wie', 'auch', 'kann'];
  const germanChars = /[äöüß]/;

  // English indicators
  const englishWords = ['the', 'and', 'is', 'for', 'with', 'on', 'of', 'are', 'will', 'at', 'from', 'or', 'as', 'can', 'be', 'this', 'that', 'have', 'has', 'an', 'by', 'it', 'not', 'you', 'we'];

  const words = stripped.split(/\s+/);

  let czechScore = 0;
  let germanScore = 0;
  let englishScore = 0;

  for (const word of words) {
    if (czechWords.includes(word)) czechScore += 2;
    if (germanWords.includes(word)) germanScore += 2;
    if (englishWords.includes(word)) englishScore += 2;
  }

  if (czechChars.test(stripped)) czechScore += 10;
  if (germanChars.test(stripped)) germanScore += 10;

  const maxScore = Math.max(czechScore, germanScore, englishScore);

  if (maxScore < 5) return 'unknown';
  if (czechScore === maxScore) return 'cs';
  if (germanScore === maxScore) return 'de';
  return 'en';
}

// Check for excessive HTML - only flag truly problematic cases
function hasExcessiveHtml(text: string): boolean {
  // Count deeply nested tags (more than 5 levels deep)
  let maxDepth = 0;
  let currentDepth = 0;
  const tagRegex = /<\/?[a-zA-Z][^>]*>/g;
  let match;

  while ((match = tagRegex.exec(text)) !== null) {
    if (match[0].startsWith('</')) {
      currentDepth--;
    } else if (!match[0].endsWith('/>')) {
      currentDepth++;
      maxDepth = Math.max(maxDepth, currentDepth);
    }
  }

  // Only flag if nesting is extremely deep (likely copy-paste from Word/other editor)
  if (maxDepth > 8) {
    return true;
  }

  // Check for problematic patterns: many empty divs/spans, repeated br tags
  const emptyTags = (text.match(/<(div|span)[^>]*>\s*<\/\1>/gi) || []).length;
  const brSequences = (text.match(/(<br\s*\/?>\s*){3,}/gi) || []).length;

  // Flag if there are many empty tags or excessive br sequences
  return emptyTags > 5 || brSequences > 3;
}

// Check for URLs in description
function hasUrls(text: string): boolean {
  return /https?:\/\/[^\s<]+/i.test(text);
}

// Check for emoji spam
function hasEmojiSpam(text: string): boolean {
  const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
  const emojis = text.match(emojiRegex) || [];
  return emojis.length > 5;
}

// ============= BUSINESS LOGIC ANALYSIS =============

function analyzeBusinessLogic(products: ProductData[]): BusinessIssue[] {
  const issues: BusinessIssue[] = [];
  const now = new Date();

  for (const product of products) {
    // ========== PRICE CHECKS ==========

    // Zero or negative price
    if (product.price !== undefined) {
      if (product.price === 0) {
        issues.push({
          type: 'zero_price',
          productCode: product.code,
          productName: product.name,
          severity: 'error',
          details: 'Produkt má nulovou cenu',
          category: 'price',
        });
      } else if (product.price < 0) {
        issues.push({
          type: 'negative_price',
          productCode: product.code,
          productName: product.name,
          severity: 'error',
          details: `Produkt má zápornou cenu: ${product.price} Kč`,
          category: 'price',
        });
      }
    }

    // Discount higher than original price
    if (product.price !== undefined && product.priceBeforeDiscount !== undefined) {
      if (product.price > product.priceBeforeDiscount) {
        issues.push({
          type: 'discount_higher_than_price',
          productCode: product.code,
          productName: product.name,
          severity: 'error',
          details: `Cena (${product.price} Kč) je vyšší než cena před slevou (${product.priceBeforeDiscount} Kč)`,
          category: 'price',
        });
      }

      // Suspicious discount > 50%
      const discountPercent = ((product.priceBeforeDiscount - product.price) / product.priceBeforeDiscount) * 100;
      if (discountPercent > 50) {
        issues.push({
          type: 'suspicious_discount',
          productCode: product.code,
          productName: product.name,
          severity: 'warning',
          details: `Sleva ${Math.round(discountPercent)}% - možná chyba nebo nelegální "falešná sleva"`,
          category: 'price',
        });
      }
    }

    // Suspicious round price (ends with ,- without haléře)
    if (product.price !== undefined && product.price > 0) {
      // Check if price ends with .00 or is a round number and seems suspiciously round
      const isExactRound = product.price % 1000 === 0 && product.price >= 1000;
      if (isExactRound) {
        issues.push({
          type: 'suspicious_round_price',
          productCode: product.code,
          productName: product.name,
          severity: 'warning',
          details: `Cena ${product.price} Kč je podezřele kulatá - zkontrolujte, zda je správná`,
          category: 'price',
        });
      }
    }

    // ========== AVAILABILITY CHECKS ==========

    // Stock/delivery conflict
    const availabilityLower = (product.availability || '').toLowerCase();
    const isInStock = availabilityLower.includes('skladem') ||
      availabilityLower.includes('stock') ||
      availabilityLower.includes('dostupn') ||
      (product.stock !== undefined && product.stock > 0);

    if (isInStock && product.deliveryDays !== undefined && product.deliveryDays > 3) {
      issues.push({
        type: 'stock_delivery_conflict',
        productCode: product.code,
        productName: product.name,
        severity: 'warning',
        details: `Produkt je "skladem", ale dodací doba je ${product.deliveryDays} dní`,
        category: 'availability',
      });
    }

    // Long "na dotaz" product
    const isOnInquiry = availabilityLower.includes('dotaz') ||
      availabilityLower.includes('inquiry') ||
      availabilityLower.includes('na objednávku');

    if (isOnInquiry && product.createdAt) {
      const monthsOld = (now.getTime() - product.createdAt.getTime()) / (1000 * 60 * 60 * 24 * 30);
      if (monthsOld > 3) {
        issues.push({
          type: 'long_inquiry_product',
          productCode: product.code,
          productName: product.name,
          severity: 'warning',
          details: `Produkt je "na dotaz" již ${Math.round(monthsOld)} měsíců`,
          category: 'availability',
        });
      }
    }

    // ========== PROMO/FLAG CHECKS ==========

    // Expired action
    if (product.isAction && product.actionEndDate) {
      if (product.actionEndDate < now) {
        issues.push({
          type: 'expired_action',
          productCode: product.code,
          productName: product.name,
          severity: 'error',
          details: `Akce skončila ${product.actionEndDate.toLocaleDateString('cs-CZ')}`,
          category: 'promo',
        });
      }
    }

    // "Novinka" flag on old product
    if (product.isNew && product.createdAt) {
      const daysOld = (now.getTime() - product.createdAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysOld > 90) {
        issues.push({
          type: 'old_product_new_flag',
          productCode: product.code,
          productName: product.name,
          severity: 'warning',
          details: `Produkt označen jako "novinka", ale je starý ${Math.round(daysOld)} dní`,
          category: 'promo',
        });
      }
    }

    // Permanent action (isAction but no end date, or end date far in future)
    if (product.isAction && product.priceBeforeDiscount !== undefined) {
      if (!product.actionEndDate) {
        issues.push({
          type: 'permanent_action',
          productCode: product.code,
          productName: product.name,
          severity: 'warning',
          details: 'Produkt je v akci bez nastaveného data konce',
          category: 'promo',
        });
      } else {
        const daysUntilEnd = (product.actionEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        if (daysUntilEnd > 30) {
          // Check if product was created more than 30 days ago (truly permanent)
          if (product.createdAt) {
            const daysOld = (now.getTime() - product.createdAt.getTime()) / (1000 * 60 * 60 * 24);
            if (daysOld > 30) {
              issues.push({
                type: 'permanent_action',
                productCode: product.code,
                productName: product.name,
                severity: 'warning',
                details: `Produkt je trvale v akci (více než 30 dní)`,
                category: 'promo',
              });
            }
          }
        }
      }
    }
  }

  return issues;
}

// ============= 2.1 COMPLETENESS ANALYSIS =============

function analyzeCompleteness(products: ProductData[]): CompletenessIssue[] {
  const issues: CompletenessIssue[] = [];

  for (const product of products) {
    // Skip variant products (they inherit from parent)
    if (product.parentCode) continue;

    // No image
    if (!product.image && (product.imageCount === undefined || product.imageCount === 0)) {
      issues.push({
        type: 'no_image',
        productCode: product.code,
        productName: product.name,
        severity: 'error',
        details: 'Produkt nemá žádný obrázek',
      });
    }
    // Single image (recommendation: min 3)
    else if ((product.imageCount || 1) === 1) {
      issues.push({
        type: 'single_image',
        productCode: product.code,
        productName: product.name,
        severity: 'warning',
        details: 'Produkt má pouze 1 obrázek (doporučeno min. 3)',
      });
    }

    // No short description
    if (!product.shortDescription || product.shortDescription.trim().length === 0) {
      issues.push({
        type: 'no_short_description',
        productCode: product.code,
        productName: product.name,
        severity: 'warning',
        details: 'Produkt nemá krátký popis (perex)',
      });
    }

    // No long description
    if (!product.description || product.description.trim().length === 0) {
      issues.push({
        type: 'no_long_description',
        productCode: product.code,
        productName: product.name,
        severity: 'error',
        details: 'Produkt nemá dlouhý popis',
      });
    }
    // Short description too short (< 100 chars after HTML strip)
    else {
      const stripped = stripHtml(product.description);
      if (stripped.length < 100) {
        issues.push({
          type: 'short_description_too_short',
          productCode: product.code,
          productName: product.name,
          severity: 'warning',
          details: `Popis má pouze ${stripped.length} znaků (doporučeno min. 100)`,
        });
      }
    }

    // No price
    if (product.price === undefined || product.price === null) {
      issues.push({
        type: 'no_price',
        productCode: product.code,
        productName: product.name,
        severity: 'error',
        details: 'Produkt nemá nastavenou cenu',
      });
    }
    // Zero price
    else if (product.price === 0) {
      issues.push({
        type: 'zero_price',
        productCode: product.code,
        productName: product.name,
        severity: 'error',
        details: 'Produkt má nulovou cenu',
      });
    }

    // No EAN/GTIN
    if (!product.ean || product.ean.trim().length === 0) {
      issues.push({
        type: 'no_ean',
        productCode: product.code,
        productName: product.name,
        severity: 'warning',
        details: 'Produkt nemá EAN/GTIN kód',
      });
    }

    // No manufacturer/brand
    if ((!product.manufacturer || product.manufacturer.trim().length === 0) &&
        (!product.brand || product.brand.trim().length === 0)) {
      issues.push({
        type: 'no_manufacturer',
        productCode: product.code,
        productName: product.name,
        severity: 'warning',
        details: 'Produkt nemá nastaveného výrobce/značku',
      });
    }

    // No category
    if ((!product.defaultCategory || product.defaultCategory.trim().length === 0) &&
        (!product.categoryText || product.categoryText.trim().length === 0)) {
      issues.push({
        type: 'no_category',
        productCode: product.code,
        productName: product.name,
        severity: 'error',
        details: 'Produkt není zařazen do žádné kategorie',
      });
    }

    // No filter parameters
    if (!product.filterParameters || product.filterParameters.length === 0) {
      issues.push({
        type: 'no_filter_parameters',
        productCode: product.code,
        productName: product.name,
        severity: 'warning',
        details: 'Produkt nemá parametry pro filtrování',
      });
    }
  }

  return issues;
}

// ============= 2.2 DATA QUALITY ANALYSIS =============

function analyzeDataQuality(products: ProductData[]): DataQualityIssue[] {
  const issues: DataQualityIssue[] = [];

  // Maps for duplicate detection
  const nameMap = new Map<string, ProductData[]>();
  const codeMap = new Map<string, ProductData[]>();
  const eanMap = new Map<string, ProductData[]>();

  for (const product of products) {
    // Collect for duplicate detection
    const normalizedName = product.name.toLowerCase().trim();
    if (normalizedName) {
      if (!nameMap.has(normalizedName)) nameMap.set(normalizedName, []);
      nameMap.get(normalizedName)!.push(product);
    }

    const normalizedCode = product.code.toLowerCase().trim();
    if (normalizedCode) {
      if (!codeMap.has(normalizedCode)) codeMap.set(normalizedCode, []);
      codeMap.get(normalizedCode)!.push(product);
    }

    if (product.ean && product.ean.trim()) {
      const normalizedEan = product.ean.trim();
      if (!eanMap.has(normalizedEan)) eanMap.set(normalizedEan, []);
      eanMap.get(normalizedEan)!.push(product);
    }

    // Check for HTML errors (unclosed tags)
    if (product.description) {
      const htmlErrors = checkHtmlErrors(product.description);
      if (htmlErrors) {
        issues.push({
          type: 'html_errors',
          productCode: product.code,
          productName: product.name,
          severity: 'warning',
          details: htmlErrors,
        });
      }

      // Check for inline styles
      if (hasInlineStyles(product.description)) {
        issues.push({
          type: 'inline_styles',
          productCode: product.code,
          productName: product.name,
          severity: 'warning',
          details: 'Popis obsahuje inline styly (style="...") místo CSS tříd',
        });
      }
    }
  }

  // Report duplicate names
  for (const [name, prods] of nameMap) {
    if (prods.length > 1) {
      for (const prod of prods) {
        issues.push({
          type: 'duplicate_name',
          productCode: prod.code,
          productName: prod.name,
          severity: 'warning',
          details: `Duplicitní název s ${prods.length - 1} dalšími produkty`,
          relatedProducts: prods.filter(p => p.code !== prod.code).map(p => p.code),
        });
      }
    }
  }

  // Report duplicate codes
  for (const [code, prods] of codeMap) {
    if (prods.length > 1) {
      for (const prod of prods) {
        issues.push({
          type: 'duplicate_code',
          productCode: prod.code,
          productName: prod.name,
          severity: 'error',
          details: `Duplicitní kód produktu (${prods.length}x)`,
          relatedProducts: prods.filter(p => p.code !== prod.code).map(p => p.code),
        });
      }
    }
  }

  // Report duplicate EANs
  for (const [ean, prods] of eanMap) {
    if (prods.length > 1) {
      for (const prod of prods) {
        issues.push({
          type: 'duplicate_ean',
          productCode: prod.code,
          productName: prod.name,
          severity: 'error',
          details: `Duplicitní EAN kód: ${ean} (${prods.length}x)`,
          relatedProducts: prods.filter(p => p.code !== prod.code).map(p => p.code),
        });
      }
    }
  }

  return issues;
}

// Check for unclosed HTML tags
function checkHtmlErrors(html: string): string | null {
  const openTags: string[] = [];
  const selfClosingTags = ['br', 'hr', 'img', 'input', 'meta', 'link', 'area', 'base', 'col', 'embed', 'source', 'track', 'wbr'];

  const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9]*)[^>]*\/?>/g;
  let match;

  while ((match = tagRegex.exec(html)) !== null) {
    const fullTag = match[0];
    const tagName = match[1].toLowerCase();

    if (selfClosingTags.includes(tagName) || fullTag.endsWith('/>')) {
      continue;
    }

    if (fullTag.startsWith('</')) {
      // Closing tag
      if (openTags.length === 0 || openTags[openTags.length - 1] !== tagName) {
        return `Nesprávně uzavřený tag </${tagName}>`;
      }
      openTags.pop();
    } else {
      // Opening tag
      openTags.push(tagName);
    }
  }

  if (openTags.length > 0) {
    return `Neuzavřené tagy: ${openTags.map(t => `<${t}>`).join(', ')}`;
  }

  return null;
}

// Check for inline styles
function hasInlineStyles(html: string): boolean {
  return /style\s*=\s*["'][^"']+["']/i.test(html);
}

// ============= 2.3 VARIANT ANALYSIS =============

function analyzeVariants(products: ProductData[]): VariantIssue[] {
  const issues: VariantIssue[] = [];

  // Group products by parent code
  const parentMap = new Map<string, ProductData[]>();
  const productsByCode = new Map<string, ProductData>();

  for (const product of products) {
    productsByCode.set(product.code, product);

    if (product.parentCode) {
      if (!parentMap.has(product.parentCode)) {
        parentMap.set(product.parentCode, []);
      }
      parentMap.get(product.parentCode)!.push(product);
    }
  }

  // Analyze each variant group
  for (const [parentCode, variants] of parentMap) {
    const parent = productsByCode.get(parentCode);

    // Check for orphan variants (parent doesn't exist)
    if (!parent) {
      for (const variant of variants) {
        issues.push({
          type: 'orphan_variant',
          productCode: variant.code,
          productName: variant.name,
          severity: 'error',
          details: `Varianta odkazuje na neexistující rodičovský produkt: ${parentCode}`,
        });
      }
      continue;
    }

    // Check variants for issues
    const variantNames = variants.map(v => v.name.toLowerCase().trim());
    const uniqueNames = new Set(variantNames);

    // Identical variant names
    if (uniqueNames.size < variants.length) {
      const duplicateNames = variantNames.filter((name, index) =>
        variantNames.indexOf(name) !== index
      );
      for (const variant of variants) {
        if (duplicateNames.includes(variant.name.toLowerCase().trim())) {
          issues.push({
            type: 'variant_identical_names',
            productCode: variant.code,
            productName: variant.name,
            severity: 'warning',
            details: 'Varianta má identický název s jinou variantou',
          });
        }
      }
    }

    // Variants without differentiating parameters
    for (const variant of variants) {
      if (!variant.parameters || Object.keys(variant.parameters).length === 0) {
        // Check if filter parameters exist
        if (!variant.filterParameters || variant.filterParameters.length === 0) {
          issues.push({
            type: 'variant_no_diff_params',
            productCode: variant.code,
            productName: variant.name,
            severity: 'warning',
            details: 'Varianta nemá rozdílové parametry',
          });
        }
      }
    }

    // Variants without own image
    for (const variant of variants) {
      if (!variant.image && (variant.imageCount === undefined || variant.imageCount === 0)) {
        issues.push({
          type: 'variant_no_image',
          productCode: variant.code,
          productName: variant.name,
          severity: 'warning',
          details: 'Varianta nemá vlastní obrázek',
        });
      }
    }

    // Inconsistent naming pattern
    if (variants.length >= 3) {
      const namingPatterns = analyzeNamingPattern(variants.map(v => v.name));
      if (!namingPatterns.isConsistent) {
        issues.push({
          type: 'variant_inconsistent_naming',
          productCode: parentCode,
          productName: parent.name,
          severity: 'warning',
          details: `Nekonzistentní pojmenování variant (${namingPatterns.pattern || 'různé vzory'})`,
          relatedProducts: variants.map(v => v.code),
        });
      }
    }
  }

  return issues;
}

// Analyze naming pattern consistency
function analyzeNamingPattern(names: string[]): { isConsistent: boolean; pattern?: string } {
  if (names.length < 2) return { isConsistent: true };

  // Check for common patterns: "Product - Size", "Product (Color)", "Product / Variant"
  const separators = [' - ', ' / ', ' | ', ' – ', '(', ','];
  let foundSeparator: string | null = null;

  for (const sep of separators) {
    const hasSep = names.filter(n => n.includes(sep)).length;
    if (hasSep === names.length) {
      foundSeparator = sep;
      break;
    } else if (hasSep > 0 && hasSep < names.length) {
      return { isConsistent: false, pattern: `pouze ${hasSep}/${names.length} má "${sep}"` };
    }
  }

  return { isConsistent: true, pattern: foundSeparator || 'žádný' };
}

// ============= 2.4 STOCK ANALYSIS =============

// Helper to check if availability text indicates "in stock"
function isInStockText(text: string): boolean {
  const lower = text.toLowerCase();
  return lower.includes('skladem') ||
    lower.includes('stock') ||
    lower.includes('ihned') ||
    lower.includes('dostupn') ||
    lower.includes('k dispozici');
}

// Helper to check if availability text indicates "out of stock"
function isOutOfStockText(text: string): boolean {
  const lower = text.toLowerCase();
  return lower.includes('vyprodán') ||
    lower.includes('sold out') ||
    lower.includes('nedostupn') ||
    lower.includes('není skladem') ||
    lower.includes('na objednávku');
}

function analyzeStock(products: ProductData[]): StockIssue[] {
  const issues: StockIssue[] = [];
  const now = new Date();

  for (const product of products) {
    const hasStock = product.stock !== undefined && product.stock > 0;
    const noStock = product.stock !== undefined && product.stock <= 0;

    // Check availabilityInStock - must be defined and indicate "in stock"
    if (!product.availabilityInStock || product.availabilityInStock.trim().length === 0) {
      issues.push({
        type: 'no_availability_in_stock',
        productCode: product.code,
        productName: product.name,
        severity: 'warning',
        details: 'Produkt nemá nastavenou dostupnost pro stav "skladem"',
      });
    } else if (!isInStockText(product.availabilityInStock)) {
      issues.push({
        type: 'wrong_availability_in_stock',
        productCode: product.code,
        productName: product.name,
        severity: 'warning',
        details: `Dostupnost "skladem" by měla indikovat dostupnost, ale je: "${product.availabilityInStock}"`,
      });
    }

    // Check availabilityOutOfStock - must be defined and indicate "out of stock"
    if (!product.availabilityOutOfStock || product.availabilityOutOfStock.trim().length === 0) {
      issues.push({
        type: 'no_availability_out_of_stock',
        productCode: product.code,
        productName: product.name,
        severity: 'warning',
        details: 'Produkt nemá nastavenou dostupnost pro stav "vyprodáno"',
      });
    } else if (!isOutOfStockText(product.availabilityOutOfStock)) {
      issues.push({
        type: 'wrong_availability_out_of_stock',
        productCode: product.code,
        productName: product.name,
        severity: 'warning',
        details: `Dostupnost "vyprodáno" by měla indikovat nedostupnost, ale je: "${product.availabilityOutOfStock}"`,
      });
    }

    // Check stock conflicts - if stock > 0, current availability should match availabilityInStock
    if (hasStock && product.availability && product.availabilityInStock) {
      if (product.availability !== product.availabilityInStock && !isInStockText(product.availability)) {
        issues.push({
          type: 'in_stock_zero_quantity',
          productCode: product.code,
          productName: product.name,
          severity: 'error',
          details: `Produkt má sklad ${product.stock}, ale dostupnost je "${product.availability}" místo "${product.availabilityInStock}"`,
        });
      }
    }

    // Check stock conflicts - if stock <= 0, current availability should match availabilityOutOfStock
    if (noStock && product.availability && product.availabilityOutOfStock) {
      if (product.availability !== product.availabilityOutOfStock && !isOutOfStockText(product.availability)) {
        issues.push({
          type: 'in_stock_zero_quantity',
          productCode: product.code,
          productName: product.name,
          severity: 'error',
          details: `Produkt má sklad ${product.stock}, ale dostupnost je "${product.availability}" místo "${product.availabilityOutOfStock}"`,
        });
      }
    }

    // Negative stock
    if (product.stock !== undefined && product.stock < 0) {
      issues.push({
        type: 'negative_stock',
        productCode: product.code,
        productName: product.name,
        severity: 'error',
        details: `Produkt má záporný sklad: ${product.stock}`,
      });
    }

    // Long-term sold out (check updatedAt if available)
    if (noStock && product.updatedAt) {
      const daysSoldOut = (now.getTime() - product.updatedAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSoldOut > 30) {
        issues.push({
          type: 'long_sold_out',
          productCode: product.code,
          productName: product.name,
          severity: 'warning',
          details: `Produkt je vyprodaný více než ${Math.round(daysSoldOut)} dní`,
        });
      }
    }
  }

  // Check variant stock consistency
  const parentMap = new Map<string, ProductData[]>();
  for (const product of products) {
    if (product.parentCode) {
      if (!parentMap.has(product.parentCode)) {
        parentMap.set(product.parentCode, []);
      }
      parentMap.get(product.parentCode)!.push(product);
    }
  }

  for (const [parentCode, variants] of parentMap) {
    const stockStatuses = variants.map(v => {
      const avail = (v.availability || '').toLowerCase();
      if (avail.includes('skladem') || (v.stock !== undefined && v.stock > 0)) return 'in_stock';
      if (avail.includes('vyprodán') || (v.stock !== undefined && v.stock <= 0)) return 'sold_out';
      return 'unknown';
    });

    const uniqueStatuses = new Set(stockStatuses.filter(s => s !== 'unknown'));
    if (uniqueStatuses.size > 1) {
      issues.push({
        type: 'variant_stock_inconsistent',
        productCode: parentCode,
        productName: variants[0]?.name || parentCode,
        severity: 'warning',
        details: `Varianty mají nekonzistentní stav skladu`,
      });
    }
  }

  return issues;
}

// ============= 3.1 CATEGORY STRUCTURE ANALYSIS =============

function analyzeCategoryStructure(products: ProductData[], categoryFeed?: CategoryData[]): CategoryIssue[] {
  const issues: CategoryIssue[] = [];

  // If we have category feed, use it for analysis
  if (categoryFeed && categoryFeed.length > 0) {
    return analyzeCategoryStructureFromFeed(categoryFeed, products);
  }

  // Fallback: Build category tree from products
  const categoryProducts = new Map<string, ProductData[]>();
  const allCategories = new Set<string>();

  for (const product of products) {
    const category = product.categoryText || product.defaultCategory || '';
    if (category) {
      if (!categoryProducts.has(category)) {
        categoryProducts.set(category, []);
      }
      categoryProducts.get(category)!.push(product);
      allCategories.add(category);

      // Also track parent categories
      const parts = category.split(/[>|\/]/);
      let path = '';
      for (const part of parts) {
        path = path ? `${path} > ${part.trim()}` : part.trim();
        allCategories.add(path);
      }
    }
  }

  // Analyze each category
  for (const category of allCategories) {
    const productsInCategory = categoryProducts.get(category) || [];
    const categoryName = category.split(/[>|\/]/).pop()?.trim() || category;

    // Empty categories
    if (productsInCategory.length === 0) {
      // Check if it's a parent category with children
      const hasChildren = Array.from(allCategories).some(c =>
        c !== category && c.startsWith(category)
      );
      if (!hasChildren) {
        issues.push({
          type: 'empty_category',
          categoryPath: category,
          categoryName: categoryName,
          severity: 'warning',
          details: 'Kategorie neobsahuje žádné produkty',
          productCount: 0,
        });
      }
    }

    // Single product category
    if (productsInCategory.length === 1) {
      issues.push({
        type: 'single_product_category',
        categoryPath: category,
        categoryName: categoryName,
        severity: 'warning',
        details: 'Kategorie obsahuje pouze 1 produkt (zbytečná hloubka)',
        productCount: 1,
      });
    }

    // Too deep category (> 4 levels)
    const depth = category.split(/[>|\/]/).length;
    if (depth > 4) {
      issues.push({
        type: 'too_deep_category',
        categoryPath: category,
        categoryName: categoryName,
        severity: 'warning',
        details: `Kategorie má ${depth} úrovní (doporučeno max. 4)`,
        productCount: productsInCategory.length,
      });
    }
  }

  // Check for duplicate category names
  const categoryNameCount = new Map<string, string[]>();
  for (const category of allCategories) {
    const name = category.split(/[>|\/]/).pop()?.trim().toLowerCase() || '';
    if (name) {
      if (!categoryNameCount.has(name)) {
        categoryNameCount.set(name, []);
      }
      categoryNameCount.get(name)!.push(category);
    }
  }

  for (const [name, paths] of categoryNameCount) {
    if (paths.length > 1) {
      for (const path of paths) {
        issues.push({
          type: 'duplicate_category_name',
          categoryPath: path,
          categoryName: name,
          severity: 'warning',
          details: `Duplicitní název kategorie (${paths.length}x)`,
        });
      }
    }
  }

  return issues;
}

// Analyze categories from dedicated category feed
function analyzeCategoryStructureFromFeed(categories: CategoryData[], products: ProductData[]): CategoryIssue[] {
  const issues: CategoryIssue[] = [];

  // Build maps for quick lookup
  const categoryByCode = new Map<string, CategoryData>();
  const categoryByName = new Map<string, CategoryData[]>();

  for (const cat of categories) {
    if (cat.code) {
      categoryByCode.set(cat.code, cat);
    }
    const nameLower = cat.name.toLowerCase().trim();
    if (!categoryByName.has(nameLower)) {
      categoryByName.set(nameLower, []);
    }
    categoryByName.get(nameLower)!.push(cat);
  }

  // Count products per category
  const productCountByCategory = new Map<string, number>();
  for (const product of products) {
    const catCode = product.defaultCategory || product.categoryText || '';
    if (catCode) {
      productCountByCategory.set(catCode, (productCountByCategory.get(catCode) || 0) + 1);
    }
  }

  // Analyze each category from feed
  for (const cat of categories) {
    const categoryPath = cat.path || cat.name;
    const productCount = cat.productCount ?? productCountByCategory.get(cat.code) ?? 0;

    // Empty category (no products)
    if (productCount === 0) {
      // Check if it has children
      const hasChildren = categories.some(c => c.parentCode === cat.code);
      if (!hasChildren) {
        issues.push({
          type: 'empty_category',
          categoryPath: categoryPath,
          categoryName: cat.name,
          severity: 'warning',
          details: 'Kategorie neobsahuje žádné produkty',
          productCount: 0,
        });
      }
    }

    // Single product category
    if (productCount === 1) {
      issues.push({
        type: 'single_product_category',
        categoryPath: categoryPath,
        categoryName: cat.name,
        severity: 'warning',
        details: 'Kategorie obsahuje pouze 1 produkt',
        productCount: 1,
      });
    }

    // Check category depth
    let depth = 1;
    let currentCode = cat.parentCode;
    while (currentCode && categoryByCode.has(currentCode)) {
      depth++;
      currentCode = categoryByCode.get(currentCode)?.parentCode;
    }
    if (depth > 4) {
      issues.push({
        type: 'too_deep_category',
        categoryPath: categoryPath,
        categoryName: cat.name,
        severity: 'warning',
        details: `Kategorie je v ${depth}. úrovni (doporučeno max. 4)`,
        productCount: productCount,
      });
    }

    // Orphan category (parent doesn't exist)
    if (cat.parentCode && !categoryByCode.has(cat.parentCode)) {
      issues.push({
        type: 'orphan_category',
        categoryPath: categoryPath,
        categoryName: cat.name,
        severity: 'error',
        details: `Rodičovská kategorie neexistuje: ${cat.parentCode}`,
        productCount: productCount,
      });
    }

    // Category without description
    if (!cat.description || cat.description.trim().length === 0) {
      issues.push({
        type: 'category_no_description',
        categoryPath: categoryPath,
        categoryName: cat.name,
        severity: 'warning',
        details: 'Kategorie nemá popis (doporučeno pro SEO)',
        productCount: productCount,
      });
    }

    // Inactive category with products
    if (cat.isActive === false && productCount > 0) {
      issues.push({
        type: 'empty_category', // reusing type
        categoryPath: categoryPath,
        categoryName: cat.name,
        severity: 'error',
        details: `Neaktivní kategorie obsahuje ${productCount} produktů`,
        productCount: productCount,
      });
    }
  }

  // Check for duplicate category names
  for (const [name, cats] of categoryByName) {
    if (cats.length > 1) {
      for (const cat of cats) {
        issues.push({
          type: 'duplicate_category_name',
          categoryPath: cat.path || cat.name,
          categoryName: cat.name,
          severity: 'warning',
          details: `Duplicitní název kategorie (${cats.length}x)`,
          productCount: cat.productCount,
        });
      }
    }
  }

  return issues;
}

// ============= 3.2 PRODUCT CATEGORIZATION ANALYSIS =============

function analyzeProductCategorization(products: ProductData[]): ProductCategoryIssue[] {
  const issues: ProductCategoryIssue[] = [];

  for (const product of products) {
    // Skip variants
    if (product.parentCode) continue;

    // No default category
    if (!product.defaultCategory && !product.categoryText) {
      issues.push({
        type: 'no_default_category',
        productCode: product.code,
        productName: product.name,
        severity: 'error',
        details: 'Produkt nemá výchozí kategorii',
      });
    }

    // Multiple main categories
    if (product.additionalCategories && product.additionalCategories.length > 0) {
      // Check if any additional category is a "main" category (top-level)
      const mainCategories = [product.defaultCategory, ...product.additionalCategories]
        .filter(c => c && !c.includes('>') && !c.includes('/'))
        .filter(Boolean);

      if (mainCategories.length > 1) {
        issues.push({
          type: 'multiple_main_categories',
          productCode: product.code,
          productName: product.name,
          severity: 'warning',
          details: `Produkt je ve více hlavních kategoriích: ${mainCategories.join(', ')}`,
          categories: mainCategories as string[],
        });
      }
    }
  }

  return issues;
}

// ============= MAIN ANALYSIS =============

export function analyzeProducts(
  products: ProductData[],
  expectedLanguage: 'cs' | 'en' | 'de' = 'cs',
  minDescriptionLength: number = 100,
  categories?: CategoryData[]
): ContentAuditReport {
  const issues: ContentIssue[] = [];
  const duplicateGroups: DuplicateGroup[] = [];

  // Stats
  let withDescription = 0;
  let withShortDescription = 0;
  let totalDescLength = 0;
  let totalShortDescLength = 0;

  // Maps for duplicate detection
  const descriptionMap = new Map<string, ProductData[]>();
  const shortDescMap = new Map<string, ProductData[]>();

  // First pass: collect stats and basic issues
  for (const product of products) {
    const desc = product.description || '';
    const shortDesc = product.shortDescription || '';
    const strippedDesc = stripHtml(desc);
    const strippedShort = stripHtml(shortDesc);

    // Stats
    if (strippedDesc.length > 0) {
      withDescription++;
      totalDescLength += strippedDesc.length;
    }
    if (strippedShort.length > 0) {
      withShortDescription++;
      totalShortDescLength += strippedShort.length;
    }

    // No description
    if (strippedDesc.length === 0 && strippedShort.length === 0) {
      issues.push({
        type: 'no_description',
        productCode: product.code,
        productName: product.name,
        severity: 'error',
        details: 'Produkt nemá žádný popis',
      });
      continue;
    }

    // Too short description
    if (strippedDesc.length > 0 && strippedDesc.length < minDescriptionLength) {
      issues.push({
        type: 'too_short',
        productCode: product.code,
        productName: product.name,
        severity: 'warning',
        details: `Popis má pouze ${strippedDesc.length} znaků (minimum: ${minDescriptionLength})`,
      });
    }

    // Same short and long description
    if (strippedDesc.length > 0 && strippedShort.length > 0) {
      const similarity = calculateSimilarity(strippedDesc, strippedShort);
      if (similarity > 0.9) {
        issues.push({
          type: 'same_short_long',
          productCode: product.code,
          productName: product.name,
          severity: 'warning',
          details: 'Krátký a dlouhý popis jsou téměř identické',
        });
      }
    }

    // Lorem ipsum
    if (hasLoremIpsum(desc) || hasLoremIpsum(shortDesc)) {
      issues.push({
        type: 'lorem_ipsum',
        productCode: product.code,
        productName: product.name,
        severity: 'error',
        details: 'Popis obsahuje Lorem Ipsum',
      });
    }

    // Test content
    if (hasTestContent(desc) || hasTestContent(shortDesc)) {
      issues.push({
        type: 'test_content',
        productCode: product.code,
        productName: product.name,
        severity: 'error',
        details: 'Popis obsahuje testovací obsah',
      });
    }

    // Wrong language
    const textToCheck = strippedDesc.length > strippedShort.length ? strippedDesc : strippedShort;
    if (textToCheck.length > 50) {
      const detectedLang = detectLanguage(textToCheck);
      if (detectedLang !== 'unknown' && detectedLang !== expectedLanguage) {
        issues.push({
          type: 'wrong_language',
          productCode: product.code,
          productName: product.name,
          severity: 'warning',
          details: `Popis je v jiném jazyce (detekováno: ${detectedLang}, očekáváno: ${expectedLanguage})`,
        });
      }
    }

    // Excessive HTML - only truly problematic cases (deep nesting, empty tags, br spam)
    if (hasExcessiveHtml(desc)) {
      // Detect what kind of problem it is
      const emptyTags = (desc.match(/<(div|span)[^>]*>\s*<\/\1>/gi) || []).length;
      const brSequences = (desc.match(/(<br\s*\/?>\s*){3,}/gi) || []).length;

      let detail = 'Popis obsahuje problematický HTML';
      if (emptyTags > 5) {
        detail = `Popis obsahuje ${emptyTags} prázdných tagů (div/span) - pravděpodobně kopírováno z Wordu`;
      } else if (brSequences > 3) {
        detail = `Popis obsahuje nadměrné množství <br> tagů místo odstavců - použijte <p> tagy`;
      } else {
        detail = 'Popis má příliš hluboké vnořování HTML tagů (>8 úrovní) - zjednodušte strukturu';
      }

      issues.push({
        type: 'html_in_description',
        productCode: product.code,
        productName: product.name,
        severity: 'warning',
        details: detail,
      });
    }

    // URLs in description
    if (hasUrls(strippedDesc)) {
      issues.push({
        type: 'url_in_description',
        productCode: product.code,
        productName: product.name,
        severity: 'warning',
        details: 'Popis obsahuje URL odkazy',
      });
    }

    // Emoji spam
    if (hasEmojiSpam(desc) || hasEmojiSpam(shortDesc)) {
      issues.push({
        type: 'emoji_spam',
        productCode: product.code,
        productName: product.name,
        severity: 'warning',
        details: 'Popis obsahuje příliš mnoho emoji',
      });
    }

    // Collect for duplicate detection (normalized)
    const normalizedDesc = strippedDesc.toLowerCase().trim();
    if (normalizedDesc.length > 50) {
      if (!descriptionMap.has(normalizedDesc)) {
        descriptionMap.set(normalizedDesc, []);
      }
      descriptionMap.get(normalizedDesc)!.push(product);
    }
  }

  // Second pass: find exact duplicates
  for (const [text, prods] of descriptionMap) {
    if (prods.length > 1) {
      duplicateGroups.push({
        type: 'exact',
        similarity: 100,
        products: prods,
        text: text.substring(0, 200) + (text.length > 200 ? '...' : ''),
      });

      // Add issues for each duplicate
      for (const prod of prods) {
        issues.push({
          type: 'duplicate_description',
          productCode: prod.code,
          productName: prod.name,
          severity: 'warning',
          details: `Identický popis s ${prods.length - 1} dalšími produkty`,
          relatedProducts: prods.filter(p => p.code !== prod.code).map(p => p.code),
        });
      }
    }
  }

  // Third pass: find near-duplicates (only for unique descriptions)
  const uniqueDescs = Array.from(descriptionMap.entries())
    .filter(([_, prods]) => prods.length === 1)
    .map(([text, prods]) => ({ text, product: prods[0] }));

  const checkedPairs = new Set<string>();

  for (let i = 0; i < uniqueDescs.length && i < 500; i++) {
    for (let j = i + 1; j < uniqueDescs.length && j < 500; j++) {
      const pairKey = `${uniqueDescs[i].product.code}-${uniqueDescs[j].product.code}`;
      if (checkedPairs.has(pairKey)) continue;
      checkedPairs.add(pairKey);

      const similarity = calculateSimilarity(uniqueDescs[i].text, uniqueDescs[j].text);

      if (similarity > 0.8) {
        // Check if already in a group
        let existingGroup = duplicateGroups.find(
          g => g.type === 'near' &&
          g.products.some(p => p.code === uniqueDescs[i].product.code || p.code === uniqueDescs[j].product.code)
        );

        if (existingGroup) {
          if (!existingGroup.products.find(p => p.code === uniqueDescs[i].product.code)) {
            existingGroup.products.push(uniqueDescs[i].product);
          }
          if (!existingGroup.products.find(p => p.code === uniqueDescs[j].product.code)) {
            existingGroup.products.push(uniqueDescs[j].product);
          }
        } else {
          duplicateGroups.push({
            type: 'near',
            similarity: Math.round(similarity * 100),
            products: [uniqueDescs[i].product, uniqueDescs[j].product],
            text: uniqueDescs[i].text.substring(0, 200) + '...',
          });
        }

        issues.push({
          type: 'near_duplicate',
          productCode: uniqueDescs[i].product.code,
          productName: uniqueDescs[i].product.name,
          severity: 'warning',
          details: `${Math.round(similarity * 100)}% podobnost s produktem ${uniqueDescs[j].product.code}`,
          relatedProducts: [uniqueDescs[j].product.code],
        });
      }
    }
  }

  // Business logic analysis
  const businessIssues = analyzeBusinessLogic(products);

  // NEW: Run all new analysis functions
  const completenessIssues = analyzeCompleteness(products);
  const dataQualityIssues = analyzeDataQuality(products);
  const variantIssues = analyzeVariants(products);
  const stockIssues = analyzeStock(products);
  const categoryIssues = analyzeCategoryStructure(products, categories);
  const productCategoryIssues = analyzeProductCategorization(products);

  // Additional stats
  let withPrice = 0;
  let withStock = 0;
  let inAction = 0;
  let withImages = 0;
  let totalImageCount = 0;
  let withEan = 0;
  let withManufacturer = 0;
  let withCategory = 0;
  let withVariants = 0;
  let totalVariants = 0;

  // Collect unique categories
  const uniqueCategories = new Set<string>();

  for (const product of products) {
    if (product.price !== undefined && product.price > 0) withPrice++;
    if (product.stock !== undefined && product.stock > 0) withStock++;
    if (product.isAction) inAction++;
    if (product.image || (product.imageCount && product.imageCount > 0)) {
      withImages++;
      totalImageCount += product.imageCount || 1;
    }
    if (product.ean && product.ean.trim()) withEan++;
    if (product.manufacturer || product.brand) withManufacturer++;
    if (product.defaultCategory || product.categoryText) {
      withCategory++;
      const cat = product.categoryText || product.defaultCategory;
      if (cat) uniqueCategories.add(cat);
    }
    if (product.parentCode) {
      totalVariants++;
    } else if (products.some(p => p.parentCode === product.code)) {
      withVariants++;
    }
  }

  // Calculate scores
  const totalProducts = products.length;
  const nonVariantProducts = products.filter(p => !p.parentCode).length;

  // Uniqueness score
  const duplicateCount = issues.filter(i => i.type === 'duplicate_description' || i.type === 'near_duplicate').length;
  const uniquenessScore = Math.max(0, 100 - (duplicateCount / totalProducts) * 100);

  // Quality score (content quality)
  const contentQualityIssues = issues.filter(i =>
    ['lorem_ipsum', 'test_content', 'emoji_spam', 'url_in_description'].includes(i.type)
  ).length;
  const qualityScore = Math.max(0, 100 - (contentQualityIssues / totalProducts) * 200);

  // Completeness score (based on new completeness issues)
  const completenessErrors = completenessIssues.filter(i => i.severity === 'error').length;
  const completenessWarnings = completenessIssues.filter(i => i.severity === 'warning').length;
  const completenessScore = Math.max(0, 100 - (completenessErrors * 5) - (completenessWarnings * 2));

  // Business score
  const businessErrors = businessIssues.filter(i => i.severity === 'error').length;
  const businessWarnings = businessIssues.filter(i => i.severity === 'warning').length;
  const businessScore = Math.max(0, 100 - (businessErrors * 10) - (businessWarnings * 3));

  // Data quality score
  const dataQualityErrors = dataQualityIssues.filter(i => i.severity === 'error').length;
  const dataQualityWarnings = dataQualityIssues.filter(i => i.severity === 'warning').length;
  const dataQualityScore = Math.max(0, 100 - (dataQualityErrors * 10) - (dataQualityWarnings * 3));

  // Stock score
  const stockErrors = stockIssues.filter(i => i.severity === 'error').length;
  const stockWarnings = stockIssues.filter(i => i.severity === 'warning').length;
  const stockScore = Math.max(0, 100 - (stockErrors * 10) - (stockWarnings * 3));

  // Category score
  const categoryErrors = categoryIssues.filter(i => i.severity === 'error').length;
  const categoryWarnings = categoryIssues.filter(i => i.severity === 'warning').length;
  const productCatErrors = productCategoryIssues.filter(i => i.severity === 'error').length;
  const productCatWarnings = productCategoryIssues.filter(i => i.severity === 'warning').length;
  const categoriesScore = Math.max(0, 100 - (categoryErrors + productCatErrors) * 5 - (categoryWarnings + productCatWarnings) * 2);

  // Overall score (weighted average of all scores)
  const overall = Math.round(
    (uniquenessScore * 0.15 +
     qualityScore * 0.15 +
     completenessScore * 0.2 +
     businessScore * 0.15 +
     dataQualityScore * 0.15 +
     stockScore * 0.1 +
     categoriesScore * 0.1)
  );

  return {
    totalProducts,
    analyzedAt: new Date(),
    issues,
    businessIssues,
    duplicateGroups,
    // New issue categories
    completenessIssues,
    dataQualityIssues,
    variantIssues,
    stockIssues,
    categoryIssues,
    productCategoryIssues,
    stats: {
      withDescription,
      withShortDescription,
      avgDescriptionLength: withDescription > 0 ? Math.round(totalDescLength / withDescription) : 0,
      avgShortDescriptionLength: withShortDescription > 0 ? Math.round(totalShortDescLength / withShortDescription) : 0,
      withPrice,
      withStock,
      inAction,
      // New stats
      withImages,
      avgImageCount: withImages > 0 ? Math.round((totalImageCount / withImages) * 10) / 10 : 0,
      withEan,
      withManufacturer,
      withCategory,
      withVariants,
      totalVariants,
      totalCategories: uniqueCategories.size,
    },
    scores: {
      uniqueness: Math.round(uniquenessScore),
      quality: Math.round(qualityScore),
      completeness: Math.round(completenessScore),
      business: Math.round(businessScore),
      dataQuality: Math.round(dataQualityScore),
      stock: Math.round(stockScore),
      categories: Math.round(categoriesScore),
      overall,
    },
  };
}
