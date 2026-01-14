import * as XLSX from 'xlsx';

// Types
export interface Product {
  code: string;
  pairCode?: string;
  name?: string;
  defaultCategory?: string;
  categoryText?: string;
  [key: string]: string | undefined;
}

export interface ProcessedProduct extends Product {
  relatedProduct?: string;
  relatedProduct2?: string;
  relatedProduct3?: string;
  relatedProduct4?: string;
  relatedProduct5?: string;
  relatedProduct6?: string;
  relatedProduct7?: string;
  relatedProduct8?: string;
  relatedProduct9?: string;
  relatedProduct10?: string;
  alternativeProduct?: string;
  alternativeProduct2?: string;
  alternativeProduct3?: string;
  alternativeProduct4?: string;
  alternativeProduct5?: string;
  alternativeProduct6?: string;
  alternativeProduct7?: string;
  alternativeProduct8?: string;
  alternativeProduct9?: string;
  alternativeProduct10?: string;
}

export interface ProductSettings {
  related: {
    enabled: boolean;
    count: number;
  };
  alternative: {
    enabled: boolean;
    count: number;
  };
}

export interface Stats {
  totalProducts: number;
  mainCategories: number;
  uniqueCategoryTexts: number;
}

export interface CategoryAnalysis {
  name: string;
  productCount: number;
  avgRelated: number;
  avgAlternative: number;
}

export interface DetailedStats {
  totalProducts: number;
  avgRelatedProducts: number;
  avgAlternativeProducts: number;
  fullRelatedPercent: number;
  fullAlternativePercent: number;
  lowRelatedCount: number;
  lowAlternativeCount: number;
  categoryAnalysis: CategoryAnalysis[];
  smallCategories: CategoryAnalysis[];
  productsWithoutCategoryText: number;
  singleProductSubcategories: string[];
  topRelatedCategories: CategoryAnalysis[];
  topConnectedSubcategories: { name: string; productCount: number; avgRelated: number }[];
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface ReadXlsxResult {
  data: Product[];
  originalColumns: string[];
}

/**
 * Randomly shuffles an array (Fisher-Yates shuffle)
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Extracts main category from defaultCategory
 * E.g. "Electronics > Phones > Accessories" -> "Electronics"
 */
function getMainCategory(defaultCategory: string | undefined): string | null {
  if (!defaultCategory) return null;
  const parts = defaultCategory.split('>').map(p => p.trim());
  return parts[0] || null;
}

/**
 * Gets subcategory (everything except main category)
 */
function getSubCategory(defaultCategory: string | undefined): string | null {
  if (!defaultCategory) return null;
  const parts = defaultCategory.split('>').map(p => p.trim());
  return parts.slice(1).join(' > ') || null;
}

/**
 * Gets all categoryText values from a product (categoryText, categoryText2, categoryText3, ...)
 */
function getAllCategoryTexts(product: Product): string[] {
  const categoryTexts: string[] = [];

  Object.keys(product).forEach(key => {
    if (key === 'categoryText' || /^categoryText\d+$/.test(key)) {
      const value = product[key];
      if (value && typeof value === 'string' && value.trim()) {
        categoryTexts.push(value.trim());
      }
    }
  });

  return categoryTexts;
}

/**
 * Processes data from XLSX file and adds related and similar products
 * Preserves original column order and adds new ones at the end
 */
export function processData(
  data: Product[],
  originalColumns: string[],
  settings: ProductSettings = { related: { enabled: true, count: 10 }, alternative: { enabled: true, count: 10 } }
): ProcessedProduct[] {
  const relatedEnabled = settings.related?.enabled ?? true;
  const relatedCount = Math.min(10, Math.max(1, settings.related?.count ?? 10));
  const alternativeEnabled = settings.alternative?.enabled ?? true;
  const alternativeCount = Math.min(10, Math.max(1, settings.alternative?.count ?? 10));

  // Create indexes for fast lookup
  const productsByMainCategory = new Map<string, Product[]>();
  const productsByCategoryText = new Map<string, Product[]>();

  // Index products
  data.forEach((product) => {
    const mainCategory = getMainCategory(product.defaultCategory);

    if (mainCategory) {
      if (!productsByMainCategory.has(mainCategory)) {
        productsByMainCategory.set(mainCategory, []);
      }
      productsByMainCategory.get(mainCategory)!.push(product);
    }

    const allCategoryTexts = getAllCategoryTexts(product);
    allCategoryTexts.forEach(categoryText => {
      if (!productsByCategoryText.has(categoryText)) {
        productsByCategoryText.set(categoryText, []);
      }
      productsByCategoryText.get(categoryText)!.push(product);
    });
  });

  // Define new column names (based on settings)
  const relatedColumns = relatedEnabled
    ? ['relatedProduct', ...Array.from({ length: relatedCount - 1 }, (_, i) => `relatedProduct${i + 2}`)]
    : [];
  const alternativeColumns = alternativeEnabled
    ? ['alternativeProduct', ...Array.from({ length: alternativeCount - 1 }, (_, i) => `alternativeProduct${i + 2}`)]
    : [];

  // Process each product
  const processedData = data.map((product) => {
    const result: ProcessedProduct = {} as ProcessedProduct;

    // First add all original columns in original order
    originalColumns.forEach(col => {
      if (col in product) {
        result[col] = product[col];
      } else {
        result[col] = '';
      }
    });

    const mainCategory = getMainCategory(product.defaultCategory);
    const currentSubCategory = getSubCategory(product.defaultCategory);
    const currentCategoryTexts = getAllCategoryTexts(product);

    // PREPARE CANDIDATES FOR RELATED PRODUCTS
    let relatedCandidates: Product[] = [];
    if (mainCategory) {
      const sameMainCategoryProducts = productsByMainCategory.get(mainCategory) || [];
      const allCandidates = sameMainCategoryProducts.filter(p => p.code !== product.code);

      const differentSubCategory: Product[] = [];
      const sameSubCategory: Product[] = [];

      allCandidates.forEach(p => {
        const pSubCategory = getSubCategory(p.defaultCategory);
        if (currentSubCategory && pSubCategory && pSubCategory !== currentSubCategory) {
          differentSubCategory.push(p);
        } else if (!currentSubCategory || !pSubCategory || pSubCategory === currentSubCategory) {
          sameSubCategory.push(p);
        }
      });

      relatedCandidates = [...shuffleArray(differentSubCategory), ...shuffleArray(sameSubCategory)];
    }

    // PREPARE CANDIDATES FOR ALTERNATIVE PRODUCTS
    let alternativeCandidates: Product[] = [];
    if (currentCategoryTexts.length > 0) {
      const allAlternativeCandidates = new Set<Product>();

      currentCategoryTexts.forEach(categoryText => {
        const sameCategoryTextProducts = productsByCategoryText.get(categoryText) || [];
        sameCategoryTextProducts.forEach(p => {
          if (p.code !== product.code) {
            allAlternativeCandidates.add(p);
          }
        });
      });

      alternativeCandidates = shuffleArray(Array.from(allAlternativeCandidates));
    }

    // ALTERNATING ASSIGNMENT
    const selectedRelatedCodes: string[] = [];
    const selectedAlternativeCodes: string[] = [];
    const usedCodes = new Set<string>();

    let relatedIdx = 0;
    let alternativeIdx = 0;

    const maxIterations = relatedCount + alternativeCount;
    for (let i = 0; i < maxIterations; i++) {
      if (i % 2 === 0) {
        if (relatedEnabled && selectedRelatedCodes.length < relatedCount) {
          while (relatedIdx < relatedCandidates.length) {
            const candidate = relatedCandidates[relatedIdx];
            relatedIdx++;
            if (!usedCodes.has(candidate.code)) {
              selectedRelatedCodes.push(candidate.code);
              usedCodes.add(candidate.code);
              break;
            }
          }
        }
      } else {
        if (alternativeEnabled && selectedAlternativeCodes.length < alternativeCount) {
          while (alternativeIdx < alternativeCandidates.length) {
            const candidate = alternativeCandidates[alternativeIdx];
            alternativeIdx++;
            if (!usedCodes.has(candidate.code)) {
              selectedAlternativeCodes.push(candidate.code);
              usedCodes.add(candidate.code);
              break;
            }
          }
        }
      }
    }

    // Fill remaining related products
    while (relatedEnabled && selectedRelatedCodes.length < relatedCount && relatedIdx < relatedCandidates.length) {
      const candidate = relatedCandidates[relatedIdx];
      relatedIdx++;
      if (!usedCodes.has(candidate.code)) {
        selectedRelatedCodes.push(candidate.code);
        usedCodes.add(candidate.code);
      }
    }

    // Fill remaining alternative products
    while (alternativeEnabled && selectedAlternativeCodes.length < alternativeCount && alternativeIdx < alternativeCandidates.length) {
      const candidate = alternativeCandidates[alternativeIdx];
      alternativeIdx++;
      if (!usedCodes.has(candidate.code)) {
        selectedAlternativeCodes.push(candidate.code);
        usedCodes.add(candidate.code);
      }
    }

    // Add relatedProduct columns (if enabled)
    if (relatedEnabled) {
      relatedColumns.forEach((colName, index) => {
        result[colName] = selectedRelatedCodes[index] || '';
      });
    }

    // Add alternativeProduct columns (if enabled)
    if (alternativeEnabled) {
      alternativeColumns.forEach((colName, index) => {
        result[colName] = selectedAlternativeCodes[index] || '';
      });
    }

    return result;
  });

  return processedData;
}

/**
 * Reads XLSX file and returns data as array of objects + original column order
 */
export function readXlsxFile(file: File): Promise<ReadXlsxResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
        const originalColumns: string[] = [];
        for (let col = range.s.c; col <= range.e.c; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
          const cell = worksheet[cellAddress];
          if (cell && cell.v) {
            originalColumns.push(cell.v as string);
          }
        }

        const jsonData = XLSX.utils.sheet_to_json<Product>(worksheet);

        resolve({ data: jsonData, originalColumns });
      } catch (error) {
        reject(new Error('Nepodařilo se načíst soubor: ' + (error as Error).message));
      }
    };

    reader.onerror = () => {
      reject(new Error('Chyba při čtení souboru'));
    };

    reader.readAsArrayBuffer(file);
  });
}

/**
 * Creates XLSX file from data and downloads it
 */
export function downloadXlsx(
  data: ProcessedProduct[],
  filename: string = 'processed_products.xlsx',
  originalColumns: string[] = [],
  settings: ProductSettings = { related: { enabled: true, count: 10 }, alternative: { enabled: true, count: 10 } }
): void {
  const relatedEnabled = settings.related?.enabled ?? true;
  const relatedCount = Math.min(10, Math.max(1, settings.related?.count ?? 10));
  const alternativeEnabled = settings.alternative?.enabled ?? true;
  const alternativeCount = Math.min(10, Math.max(1, settings.alternative?.count ?? 10));

  const relatedColumns = relatedEnabled
    ? ['relatedProduct', ...Array.from({ length: relatedCount - 1 }, (_, i) => `relatedProduct${i + 2}`)]
    : [];
  const alternativeColumns = alternativeEnabled
    ? ['alternativeProduct', ...Array.from({ length: alternativeCount - 1 }, (_, i) => `alternativeProduct${i + 2}`)]
    : [];

  const finalColumnOrder = [...originalColumns, ...relatedColumns, ...alternativeColumns];

  const orderedData = data.map(row => {
    const orderedRow: Record<string, string> = {};
    finalColumnOrder.forEach(col => {
      orderedRow[col] = row[col] !== undefined ? String(row[col]) : '';
    });
    return orderedRow;
  });

  const worksheet = XLSX.utils.json_to_sheet(orderedData, { header: finalColumnOrder });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');
  XLSX.writeFile(workbook, filename);
}

/**
 * Validates that data contains required columns and no extra columns
 */
export function validateData(data: Product[], originalColumns: string[] = []): ValidationResult {
  if (!data || data.length === 0) {
    return { valid: false, error: 'Soubor neobsahuje žádná data' };
  }

  const requiredColumns = ['code', 'pairCode', 'name', 'defaultCategory', 'categoryText'];
  const columnsInFile = originalColumns.length > 0 ? originalColumns : Object.keys(data[0]);

  const missingColumns = requiredColumns.filter(col => !columnsInFile.includes(col));
  if (missingColumns.length > 0) {
    return {
      valid: false,
      error: `Chybějící sloupce: ${missingColumns.join(', ')}`
    };
  }

  const extraColumns = columnsInFile.filter(col => {
    if (['code', 'pairCode', 'name', 'defaultCategory', 'categoryText'].includes(col)) {
      return false;
    }
    if (/^categoryText\d+$/.test(col)) {
      return false;
    }
    return true;
  });

  if (extraColumns.length > 0) {
    return {
      valid: false,
      error: `Soubor obsahuje nepovolené sloupce: ${extraColumns.join(', ')}. Povolené sloupce jsou: code, pairCode, name, defaultCategory, categoryText (a categoryText2, categoryText3, ...)`
    };
  }

  return { valid: true };
}

/**
 * Gets statistics about data
 */
export function getStats(data: ProcessedProduct[]): Stats {
  const mainCategories = new Set<string>();
  const categoryTexts = new Set<string>();

  data.forEach(product => {
    const mainCat = getMainCategory(product.defaultCategory);
    if (mainCat) mainCategories.add(mainCat);

    getAllCategoryTexts(product).forEach(ct => categoryTexts.add(ct));
  });

  return {
    totalProducts: data.length,
    mainCategories: mainCategories.size,
    uniqueCategoryTexts: categoryTexts.size
  };
}

/**
 * Gets detailed statistics about data quality after processing
 */
export function getDetailedStats(processedData: ProcessedProduct[]): DetailedStats {
  const stats: DetailedStats = {
    totalProducts: processedData.length,
    avgRelatedProducts: 0,
    avgAlternativeProducts: 0,
    fullRelatedPercent: 0,
    fullAlternativePercent: 0,
    lowRelatedCount: 0,
    lowAlternativeCount: 0,
    categoryAnalysis: [],
    smallCategories: [],
    productsWithoutCategoryText: 0,
    singleProductSubcategories: [],
    topRelatedCategories: [],
    topConnectedSubcategories: []
  };

  if (processedData.length === 0) return stats;

  const categoryData = new Map<string, { products: number; relatedSum: number; alternativeSum: number }>();
  const subcategoryData = new Map<string, { products: number; relatedSum: number }>();
  let totalRelated = 0;
  let totalAlternative = 0;
  let fullRelatedCount = 0;
  let fullAlternativeCount = 0;

  const relatedColumns = ['relatedProduct', ...Array.from({ length: 9 }, (_, i) => `relatedProduct${i + 2}`)];
  const alternativeColumns = ['alternativeProduct', ...Array.from({ length: 9 }, (_, i) => `alternativeProduct${i + 2}`)];

  processedData.forEach(product => {
    const relatedCount = relatedColumns.filter(col => product[col] && product[col] !== '').length;
    const alternativeCount = alternativeColumns.filter(col => product[col] && product[col] !== '').length;

    totalRelated += relatedCount;
    totalAlternative += alternativeCount;

    if (relatedCount === 10) fullRelatedCount++;
    if (alternativeCount === 10) fullAlternativeCount++;

    if (relatedCount < 3) stats.lowRelatedCount++;
    if (alternativeCount < 3) stats.lowAlternativeCount++;

    const hasCategoryText = getAllCategoryTexts(product).length > 0;
    if (!hasCategoryText) stats.productsWithoutCategoryText++;

    const mainCategory = getMainCategory(product.defaultCategory);
    if (mainCategory) {
      if (!categoryData.has(mainCategory)) {
        categoryData.set(mainCategory, { products: 0, relatedSum: 0, alternativeSum: 0 });
      }
      const catData = categoryData.get(mainCategory)!;
      catData.products++;
      catData.relatedSum += relatedCount;
      catData.alternativeSum += alternativeCount;
    }

    const subCategory = getSubCategory(product.defaultCategory);
    if (subCategory) {
      if (!subcategoryData.has(subCategory)) {
        subcategoryData.set(subCategory, { products: 0, relatedSum: 0 });
      }
      const subData = subcategoryData.get(subCategory)!;
      subData.products++;
      subData.relatedSum += relatedCount;
    }
  });

  stats.avgRelatedProducts = Math.round((totalRelated / processedData.length) * 10) / 10;
  stats.avgAlternativeProducts = Math.round((totalAlternative / processedData.length) * 10) / 10;
  stats.fullRelatedPercent = Math.round((fullRelatedCount / processedData.length) * 100);
  stats.fullAlternativePercent = Math.round((fullAlternativeCount / processedData.length) * 100);

  const sortedCategories = Array.from(categoryData.entries())
    .map(([name, data]) => ({
      name,
      productCount: data.products,
      avgRelated: Math.round((data.relatedSum / data.products) * 10) / 10,
      avgAlternative: Math.round((data.alternativeSum / data.products) * 10) / 10
    }))
    .sort((a, b) => b.productCount - a.productCount);

  stats.categoryAnalysis = sortedCategories.slice(0, 5);

  stats.smallCategories = sortedCategories
    .filter(cat => cat.productCount < 10)
    .slice(0, 5);

  stats.topRelatedCategories = [...sortedCategories]
    .filter(cat => cat.productCount >= 5)
    .sort((a, b) => b.avgRelated - a.avgRelated)
    .slice(0, 3);

  const singleProductSubs = Array.from(subcategoryData.entries())
    .filter(([, data]) => data.products === 1)
    .map(([name]) => name);
  stats.singleProductSubcategories = singleProductSubs.slice(0, 5);

  stats.topConnectedSubcategories = Array.from(subcategoryData.entries())
    .filter(([, data]) => data.products >= 3)
    .map(([name, data]) => ({
      name,
      productCount: data.products,
      avgRelated: Math.round((data.relatedSum / data.products) * 10) / 10
    }))
    .sort((a, b) => b.avgRelated - a.avgRelated)
    .slice(0, 3);

  return stats;
}
