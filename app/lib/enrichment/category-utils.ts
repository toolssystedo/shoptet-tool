import type { EnrichedRow, CategoryGroup } from "./types";
import { SHOPTET_CATEGORY_COLUMNS } from "./types";

/**
 * Определяет категорию продукта.
 * Приоритет: categoryText > defaultCategory > "Bez kategorie"
 */
export function getProductCategory(row: EnrichedRow): string {
  // Попробовать categoryText первым (более точная категория)
  const categoryText = row["categoryText"] as string | undefined;
  if (categoryText && categoryText.trim()) {
    return categoryText.trim();
  }

  // Затем defaultCategory
  const defaultCategory = row["defaultCategory"] as string | undefined;
  if (defaultCategory && defaultCategory.trim()) {
    return defaultCategory.trim();
  }

  return "Bez kategorie";
}

/**
 * Получает полный путь категорий продукта
 */
export function getProductCategoryPath(row: EnrichedRow): string[] {
  const path: string[] = [];

  // Добавить defaultCategory если есть
  const defaultCategory = row["defaultCategory"] as string | undefined;
  if (defaultCategory && defaultCategory.trim()) {
    path.push(defaultCategory.trim());
  }

  // Добавить все categoryText
  for (const col of SHOPTET_CATEGORY_COLUMNS) {
    if (col === "defaultCategory") continue;
    const value = row[col] as string | undefined;
    if (value && value.trim()) {
      path.push(value.trim());
    }
  }

  return path.length > 0 ? path : ["Bez kategorie"];
}

/**
 * Группирует продукты по категориям
 */
export function groupByCategory(rows: EnrichedRow[]): CategoryGroup[] {
  const categoryMap = new Map<string, EnrichedRow[]>();

  // Группировка по категории
  for (const row of rows) {
    const category = getProductCategory(row);
    const existing = categoryMap.get(category) || [];
    existing.push(row);
    categoryMap.set(category, existing);
  }

  // Преобразование в CategoryGroup[]
  const groups: CategoryGroup[] = [];

  for (const [categoryName, products] of categoryMap) {
    const commonParams = getCategoryCommonParams(products);
    const categoryPath = products.length > 0 ? getProductCategoryPath(products[0]) : [categoryName];

    groups.push({
      categoryName,
      categoryPath,
      products,
      commonParams,
    });
  }

  // Сортировка: "Bez kategorie" в конце, остальные по алфавиту
  groups.sort((a, b) => {
    if (a.categoryName === "Bez kategorie") return 1;
    if (b.categoryName === "Bez kategorie") return -1;
    return a.categoryName.localeCompare(b.categoryName, "cs");
  });

  return groups;
}

/**
 * Получает общие параметры для категории
 */
export function getCategoryCommonParams(products: EnrichedRow[]): {
  filtering: string[];
  text: string[];
} {
  const allFilteringNames = new Set<string>();
  const allTextKeys = new Set<string>();

  for (const product of products) {
    if (product.aiResult) {
      for (const f of product.aiResult.filtering) {
        allFilteringNames.add(f.name);
      }
      for (const t of product.aiResult.text) {
        allTextKeys.add(t.key);
      }
    }
  }

  return {
    filtering: Array.from(allFilteringNames).sort((a, b) => a.localeCompare(b, "cs")),
    text: Array.from(allTextKeys).sort((a, b) => a.localeCompare(b, "cs")),
  };
}

/**
 * Находит столбец с изображением
 */
export function findImageColumn(headers: string[]): string | null {
  const imageColumns = ["imgUrl", "image", "imageUrl", "img", "photo", "picture"];
  for (const col of imageColumns) {
    const found = headers.find((h) => h.toLowerCase() === col.toLowerCase());
    if (found) return found;
  }
  return null;
}

/**
 * Находит столбец с ценой
 */
export function findPriceColumn(headers: string[]): string | null {
  const priceColumns = ["price", "priceVat", "cena", "priceWithVat"];
  for (const col of priceColumns) {
    const found = headers.find((h) => h.toLowerCase() === col.toLowerCase());
    if (found) return found;
  }
  return null;
}

/**
 * Находит столбец с названием продукта
 */
export function findNameColumn(headers: string[]): string | null {
  const nameColumns = ["name", "productName", "title", "nazev", "název"];
  for (const col of nameColumns) {
    const found = headers.find((h) => h.toLowerCase() === col.toLowerCase());
    if (found) return found;
  }
  return null;
}

/**
 * Находит столбец с кодом/SKU
 */
export function findCodeColumn(headers: string[]): string | null {
  const codeColumns = ["code", "sku", "productCode", "kod", "kód", "ean"];
  for (const col of codeColumns) {
    const found = headers.find((h) => h.toLowerCase() === col.toLowerCase());
    if (found) return found;
  }
  return null;
}

/**
 * Форматирует цену для отображения
 */
export function formatPrice(value: unknown): string {
  if (value === undefined || value === null || value === "") {
    return "-";
  }

  const num = typeof value === "number" ? value : parseFloat(String(value));
  if (isNaN(num)) {
    return String(value);
  }

  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Обрезает текст до максимальной длины
 */
export function truncateText(text: string | undefined, maxLength: number = 50): string {
  if (!text) return "-";
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
}

/**
 * Подсчитывает количество параметров у продукта
 */
export function countParams(row: EnrichedRow): { filtering: number; text: number; total: number } {
  const filtering = row.aiResult?.filtering.length || 0;
  const text = row.aiResult?.text.length || 0;
  return { filtering, text, total: filtering + text };
}

/**
 * Removes HTML tags from a string and returns plain text.
 * Also decodes common HTML entities.
 */
export function stripHtml(html: string | undefined | null): string {
  if (!html) return "";

  // Remove HTML tags
  let text = html.replace(/<[^>]*>/g, " ");

  // Decode common HTML entities
  text = text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&hellip;/g, "...")
    .replace(/&copy;/g, "©")
    .replace(/&reg;/g, "®")
    .replace(/&trade;/g, "™");

  // Collapse multiple spaces into one
  text = text.replace(/\s+/g, " ").trim();

  return text;
}
