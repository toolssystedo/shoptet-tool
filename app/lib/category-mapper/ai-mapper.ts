// Smart category mapping with optional AI verification (OpenAI GPT-4o-mini)
// UNIVERSAL APPROACH - No hardcoded product-specific rules

import OpenAI from 'openai';
import type { Category, ProductForMapping, MappedProduct, Platform } from './types';

// --- CONFIGURATION ---

let openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!openai) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

// Cache for variant products (baseCode -> mapping)
const variantCache = new Map<string, MappedProduct['mappedCategories']>();

/**
 * UNIVERSAL STOP WORDS
 * Words that carry very little semantic meaning for categorization
 */
const STOP_WORDS = new Set([
  'pro', 'pod', 'nad', 'pri', 'pre', 'the', 'and', 'for', 'with', 'von', 'zur',
  'bio', 'pure', 'muud', 'original', 'premium', 'new', 'top', 'best',
  'sale', 'akce', 'sleva', 'novinka', 'hit'
]);

/**
 * WEAK KEYWORDS
 * Words that match but score very low - prevents "Flow System" -> "Ironing Systems"
 */
const WEAK_KEYWORDS = new Set([
  'set', 'sada', 'system', 'systém', 'komplet', 'big', 'boy', 'flow',
  'series', 'line', 'typ', 'type', 'model', 'edition', 'verze', 'version',
  'pack', 'kit', 'bundle', 'collection', 'kolekce'
]);

/**
 * ACCESSORY INDICATORS
 * Words indicating the category is for spare parts or accessories
 */
const ACCESSORY_INDICATORS = [
  'příslušenství', 'prislusenstvi', 'doplňky', 'doplnky',
  'náhradní', 'nahradni', 'díl', 'dil', 'díly', 'dily',
  'součást', 'soucast', 'adapter', 'adaptér',
  'kabel', 'obal', 'pouzdro', 'kryt', 'holder',
  'accessories', 'spare', 'parts', 'replacement'
];

/**
 * NON-PRODUCT KEYWORDS
 * Products matching these should return empty results (services, vouchers, etc.)
 */
const NON_PRODUCT_KEYWORDS = [
  'dýško', 'dysko', 'spropitné', 'tip',
  'seminář', 'seminar', 'workshop', 'kurz', 'školení', 'skoleni',
  'poukaz', 'voucher', 'gift card', 'dárková karta',
  'služba', 'sluzba', 'service', 'servis',
  'konzultace', 'poradenství'
];

// --- HELPER FUNCTIONS ---

/**
 * Normalize text for comparison - remove diacritics and lowercase
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract base product code from variant code (e.g., "75/RUZ2" -> "75")
 */
function getBaseProductCode(code: string): string | null {
  const match = code.match(/^([^\/\-]+)[\/\-].+$/);
  return match ? match[1] : null;
}

/**
 * Extract keywords with strong/weak classification
 */
function extractKeywords(text: string): { strong: string[], weak: string[] } {
  const words = normalizeText(text).split(' ');
  const strong: string[] = [];
  const weak: string[] = [];

  for (const w of words) {
    if (w.length < 2 || STOP_WORDS.has(w)) continue;
    if (WEAK_KEYWORDS.has(w) || w.length < 3) {
      weak.push(w);
    } else {
      strong.push(w);
    }
  }
  return { strong, weak };
}

/**
 * Czech Stemmer (Lightweight)
 */
function getStem(word: string): string {
  const suffixes = [
    'ova', 'ove', 'ovy', 'ovou',
    'ky', 'ka', 'ek', 'ko', 'ku', 'kem',
    'ami', 'emi', 'ach', 'ich', 'ech',
    'um', 'em', 'im', 'ym',
    'ou', 'ovi', 'ni', 'ny', 'ne', 'na'
  ];

  let stem = word;
  for (const suffix of suffixes) {
    if (stem.length > suffix.length + 2 && stem.endsWith(suffix)) {
      stem = stem.slice(0, -suffix.length);
      break;
    }
  }
  return stem;
}

/**
 * Check if two words match (exact or stem match)
 */
function wordsMatch(prodWord: string, catWord: string): boolean {
  if (prodWord === catWord) return true;

  const s1 = getStem(prodWord);
  const s2 = getStem(catWord);

  return s1 === s2 || (s1.length >= 4 && s2.length >= 4 && (s1.includes(s2) || s2.includes(s1)));
}

/**
 * Universal exclusion of seasonal/marketing categories
 */
function isExcludedCategory(categoryPath: string): boolean {
  // Emoji check for seasonal categories
  if (/[🎄🎁🐣🎃🎅🦃🎆🎇💝💘🎉🎊❄️☀️🌸🍂]/.test(categoryPath)) {
    return true;
  }

  const excludePatterns = [
    /v[aá]no[cč]/i,          // Vánoce
    /velikon/i,               // Velikonoce
    /black\s*friday/i,
    /v[yý]prodej/i,           // Výprodej
    /akce\b/i,
    /slev[ay]/i,              // Sleva/Slevy
    /halloween/i,
    /valent[yý]n/i,           // Valentýn
    /sez[oó]n/i,              // Sezóna
    /novink/i,                // Novinky
    /tipy\s+na/i,             // Tipy na...
    /d[aá]rky\s+(pro|k)/i,    // Dárky pro/k...
    /bestseller/i,
    /doporu[cč]/i,            // Doporučené
  ];

  return excludePatterns.some(pattern => pattern.test(categoryPath));
}

/**
 * Check if product is a non-product (service, voucher, tip)
 */
function isNonProduct(productName: string): boolean {
  const lowerName = normalizeText(productName);
  return NON_PRODUCT_KEYWORDS.some(keyword => lowerName.includes(normalizeText(keyword)));
}

/**
 * Check if text contains accessory indicators
 */
function containsAccessoryIndicator(text: string): boolean {
  const normalized = normalizeText(text);
  return ACCESSORY_INDICATORS.some(ind => normalized.includes(normalizeText(ind)));
}

/**
 * UNIVERSAL SCORING LOGIC
 * Determines which categories get sent to the AI
 */
function calculateScore(
  productNameKeywords: { strong: string[], weak: string[] },
  category: Category
): number {
  const categoryPath = category.fullPath || category.name;

  // 1. Hard Exclusion (Seasonal/Marketing)
  if (isExcludedCategory(categoryPath)) return -1000;

  const catKeywords = extractKeywords(categoryPath);
  const leafKeywords = extractKeywords(category.name);

  let score = 0;
  let strongMatches = 0;

  // 2. Score Strong Keywords (e.g., "Kalabasa", "Termoska", "Hrnek")
  for (const pw of productNameKeywords.strong) {
    // Match in LEAF name (category name itself) - very important
    if (leafKeywords.strong.some(cw => wordsMatch(cw, pw))) {
      score += 100;
      strongMatches++;
    }
    // Match in PATH (parent categories) - less important
    else if (catKeywords.strong.some(cw => wordsMatch(cw, pw))) {
      score += 20;
    }
  }

  // 3. Score Weak Keywords (e.g., "Set", "System") - very low weight
  for (const pw of productNameKeywords.weak) {
    if (leafKeywords.strong.some(cw => wordsMatch(cw, pw)) ||
        leafKeywords.weak.some(cw => wordsMatch(cw, pw))) {
      score += 5; // Very low score for weak words
    }
  }

  // 4. THE "ACCESSORY" TRAP (Universal Fix)
  // If category is "Accessories" but product is NOT an accessory -> Huge penalty
  const catIsAccessory = containsAccessoryIndicator(category.name);
  const prodIsAccessory = containsAccessoryIndicator(
    [...productNameKeywords.strong, ...productNameKeywords.weak].join(' ')
  );

  if (catIsAccessory && !prodIsAccessory) {
    score -= 150; // Prevents "Mug" falling into "Thermometer Accessories"
  }

  // 5. No Strong Matches Penalty
  // If we only matched "System" or "Set" but not "Iron" or "Toy", kill the score
  if (strongMatches === 0) {
    score = Math.floor(score / 4);
  }

  // 6. Bonus for multiple strong matches in leaf
  if (strongMatches >= 2) {
    score += strongMatches * 30;
  }

  // 7. Depth penalty for very deep categories without leaf matches
  const depth = categoryPath.split(/[|>]/).length;
  if (depth > 4 && strongMatches === 0) {
    score -= depth * 5;
  }

  return score;
}

/**
 * Find candidate categories using the universal scorer
 */
function findCandidateCategories(
  productText: string,
  categories: Category[],
  limit: number = 20 // Send more candidates to AI so it has choices
): Array<{ category: Category; score: number }> {

  const productKw = extractKeywords(productText);

  if (productKw.strong.length === 0 && productKw.weak.length === 0) {
    return [];
  }

  const leafCategories = categories.filter(c => c.isLeaf !== false);

  const scored = leafCategories.map(category => ({
    category,
    score: calculateScore(productKw, category)
  }));

  // Sort and filter
  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * THE UNIVERSAL AI PROMPT
 * Uses Entity Analysis + Context (Description)
 * NO hardcoded product-specific rules
 */
async function batchVerifyWithAI(
  productsToVerify: Array<{
    product: ProductForMapping;
    currentMapping: MappedProduct['mappedCategories'];
    platforms: Platform[];
    candidatesPerPlatform: Record<Platform, Category[]>;
  }>
): Promise<Map<string, MappedProduct['mappedCategories']>> {
  const results = new Map<string, MappedProduct['mappedCategories']>();

  if (productsToVerify.length === 0) return results;

  const productsPayload = productsToVerify.map((item, idx) => {
    // Format candidates for each platform
    const candidatesStr = item.platforms.map(p => {
      const cats = item.candidatesPerPlatform[p] || [];
      if (cats.length === 0) return `   ${p}: [NO CANDIDATES FOUND]`;
      return `   ${p}:\n` + cats.slice(0, 15).map(c =>
        `      - ID ${c.id}: ${c.fullPath || c.name}`
      ).join('\n');
    }).join('\n');

    // Clean description (remove HTML tags)
    const desc = (item.product.description || item.product.shortDescription || "")
      .replace(/<[^>]*>?/gm, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 500);

    return `### ITEM ${idx}
NAME: ${item.product.name}
DEFAULT_CAT: ${item.product.categoryText || 'N/A'}
DESCRIPTION: ${desc}
CANDIDATES:
${candidatesStr}`;
  }).join('\n\n');

  const systemPrompt = `You are an expert in E-commerce Product Categorization.
Your goal is to map products to the most strictly accurate category based on their DESCRIPTION and FUNCTION.

INSTRUCTIONS:

1. **Analyze the Product**: Read the Name and Description. Determine:
   - What is the *physical entity*? (e.g., "A ceramic cup", "A thermos bottle", "A straw", "A toy").
   - What is the *usage context*? (e.g., "Kitchen", "Sport", "Kids", "Garden").

2. **Analyze Candidates**: Look at the "CANDIDATES" list (Full Category Paths).

3. **Select the Best Match**:
   - The Category Path must match BOTH the entity AND the context.

   **CRITICAL TRAPS TO AVOID:**

   - **Entity Mismatch**: Do not put a "Thermos" into "Toys" just because of keyword "Boy" in the name.
   - **Context Mismatch**: Do not put a "Cup" into "Pet Supplies" or "Thermometer Accessories".
   - **Accessory Trap**: If the product is a MAIN item (e.g., "Ironing Board"), do NOT select "Ironing Board Accessories" unless it's specifically a cover/pad/accessory.
   - **Vague Keywords**: Ignore generic matches like "System", "Set", "Pro", "Flow" if the specific category subject is missing in the product.
   - **Material Trap**: "Stainless steel cup" should go to "Cups/Tableware", NOT "Steel cleaning products".
   - **Size/Brand Trap**: "Big Boy 2500ml" - focus on WHAT it is (thermos), not the brand/size.

4. **Non-Products**: If the item is a service, voucher, seminar, or tip - return null.

5. **When Unsure**: If no candidate logically fits, return null. Better no category than wrong category.

OUTPUT FORMAT:
{
  "mappings": [
    { "idx": 0, "heureka": 12345, "zbozi": null, "google": 999, "glami": null },
    ...
  ]
}

Return the category ID as a number, or null if no candidate is appropriate.`;

  try {
    const client = getOpenAI();
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Please categorize these products:\n\n${productsPayload}` }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content || '{}';

    let parsed: { mappings?: Array<Record<string, number | null>> };
    try {
      parsed = JSON.parse(content);
    } catch {
      console.error("Failed to parse AI JSON response", content);
      return results;
    }

    if (parsed.mappings && Array.isArray(parsed.mappings)) {
      for (const m of parsed.mappings) {
        const idx = m.idx as number;
        const item = productsToVerify[idx];
        if (!item) continue;

        const newMap: MappedProduct['mappedCategories'] = { ...item.currentMapping };

        for (const p of item.platforms) {
          const chosenId = m[p];
          if (chosenId && typeof chosenId === 'number') {
            const cat = item.candidatesPerPlatform[p]?.find(c =>
              c.id === chosenId || String(c.id) === String(chosenId)
            );
            if (cat) {
              newMap[p] = {
                id: cat.id,
                name: cat.name,
                fullPath: cat.fullPath || cat.name,
                confidence: 90
              };
            }
          }
        }

        results.set(item.product.code, newMap);
      }
    }

  } catch (error) {
    console.error("AI Mapping failed:", error);
  }

  return results;
}

// --- MAIN EXPORTED FUNCTIONS ---

/**
 * Map a single product to categories
 */
export async function mapProductToCategories(
  product: ProductForMapping,
  platformCategories: {
    heureka?: Category[];
    zbozi?: Category[];
    google?: Category[];
    glami?: Category[];
  },
  platforms: Platform[]
): Promise<MappedProduct['mappedCategories']> {
  const res = await batchMapProducts([product], platformCategories, platforms);
  return res[0].mappedCategories;
}

/**
 * Batch map products with optional AI verification
 */
export async function batchMapProducts(
  products: ProductForMapping[],
  platformCategories: {
    heureka?: Category[];
    zbozi?: Category[];
    google?: Category[];
    glami?: Category[];
  },
  platforms: Platform[],
  onProgress?: (current: number, total: number) => void,
  useAI: boolean = true
): Promise<MappedProduct[]> {

  variantCache.clear();
  const results: MappedProduct[] = [];
  const needsAI: Array<{
    index: number;
    product: ProductForMapping;
    currentMapping: MappedProduct['mappedCategories'];
    platforms: Platform[];
    candidatesPerPlatform: Record<Platform, Category[]>;
  }> = [];

  // Sort products so base products are processed before variants
  const sortedProducts = [...products].sort((a, b) => {
    const aBase = getBaseProductCode(a.code);
    const bBase = getBaseProductCode(b.code);
    if (!aBase && bBase) return -1;
    if (aBase && !bBase) return 1;
    return 0;
  });

  // Stage 1: Mechanical Pass (Text Matching)
  for (let i = 0; i < sortedProducts.length; i++) {
    const p = sortedProducts[i];
    const mapping: MappedProduct['mappedCategories'] = {};
    const candidatesMap: Record<Platform, Category[]> = {} as Record<Platform, Category[]>;
    let lowConfidence = false;

    // Skip non-products (services, vouchers, tips)
    if (isNonProduct(p.name)) {
      results.push({ ...p, mappedCategories: {} });
      if (onProgress) onProgress(i + 1, sortedProducts.length);
      continue;
    }

    // Check variant cache
    const baseCode = getBaseProductCode(p.code);
    if (baseCode && variantCache.has(baseCode)) {
      results.push({ ...p, mappedCategories: variantCache.get(baseCode)! });
      if (onProgress) onProgress(i + 1, sortedProducts.length);
      continue;
    }

    const context = [p.name, p.categoryText, p.defaultCategory].filter(Boolean).join(' ');

    for (const plat of platforms) {
      const categories = platformCategories[plat];
      if (!categories || categories.length === 0) continue;

      // Use LIMIT 20 to widen the funnel for AI
      const candidates = findCandidateCategories(context, categories, 20);

      if (candidates.length > 0) {
        candidatesMap[plat] = candidates.map(c => c.category);
        const top = candidates[0];

        // Auto-accept only if score is very high (strong leaf match + no accessory warning)
        if (top.score >= 100) {
          mapping[plat] = {
            id: top.category.id,
            name: top.category.name,
            fullPath: top.category.fullPath || top.category.name,
            confidence: 80
          };
        } else {
          lowConfidence = true;
        }
      } else {
        lowConfidence = true;
      }
    }

    results.push({ ...p, mappedCategories: mapping });

    // Cache for variants
    if (Object.keys(mapping).length > 0) {
      if (baseCode) {
        variantCache.set(baseCode, { ...mapping });
      } else {
        variantCache.set(p.code, { ...mapping });
      }
    }

    // Queue for AI if confidence is low
    if (useAI && lowConfidence && process.env.OPENAI_API_KEY) {
      // Only send if we actually found candidates to choose from
      const hasCandidates = Object.values(candidatesMap).some(c => c && c.length > 0);
      if (hasCandidates) {
        needsAI.push({
          index: i,
          product: p,
          currentMapping: mapping,
          platforms,
          candidatesPerPlatform: candidatesMap
        });
      }
    }

    if (onProgress) onProgress(i + 1, sortedProducts.length);
  }

  // Stage 2: AI Pass (for low-confidence products)
  if (needsAI.length > 0 && useAI) {
    console.log(`AI Refining ${needsAI.length} products...`);

    const BATCH_SIZE = 10; // Smaller batch size for better description analysis

    for (let i = 0; i < needsAI.length; i += BATCH_SIZE) {
      const chunk = needsAI.slice(i, i + BATCH_SIZE);
      const aiResults = await batchVerifyWithAI(chunk);

      for (const task of chunk) {
        const improved = aiResults.get(task.product.code);
        if (improved) {
          results[task.index].mappedCategories = {
            ...results[task.index].mappedCategories,
            ...improved
          };

          // Update cache
          const base = getBaseProductCode(task.product.code);
          if (base) {
            variantCache.set(base, results[task.index].mappedCategories);
          }
        }
      }
    }
  }

  return results;
}

/**
 * Simple text-based category matching (exported for API use)
 */
export function simpleMatchCategory(
  productText: string,
  categories: Category[]
): { id: number | string; name: string; fullPath: string; confidence: number } | undefined {
  const candidates = findCandidateCategories(productText, categories, 1);

  if (candidates.length > 0) {
    const best = candidates[0];
    return {
      id: best.category.id,
      name: best.category.name,
      fullPath: best.category.fullPath || best.category.name,
      confidence: 75,
    };
  }

  return undefined;
}
