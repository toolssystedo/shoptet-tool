// Fetches and parses category trees from different platforms

import type {
  Category,
  HeurekaCategory,
  ZboziCategory,
  GlamiCategory,
  GoogleCategory,
} from './types';

// URLs for category sources
const CATEGORY_SOURCES = {
  heureka: 'https://www.heureka.cz/direct/xml-export/shops/heureka-sekce.xml',
  zbozi: 'https://www.zbozi.cz/static/categories.json',
  glami: 'https://www.glami.cz/category-xml/',
  // Google taxonomy - using Czech version
  google: 'https://www.google.com/basepages/producttype/taxonomy-with-ids.cs-CZ.txt',
};

/**
 * Parse Heureka XML category tree
 */
function parseHeurekaXML(xmlText: string): Category[] {
  const categories: Category[] = [];

  // Simple XML parsing using regex (for server-side)
  const parseCategory = (xml: string, parentPath: string = ''): Category[] => {
    const result: Category[] = [];
    const categoryRegex = /<CATEGORY>[\s\S]*?<CATEGORY_ID>(\d+)<\/CATEGORY_ID>[\s\S]*?<CATEGORY_NAME>([^<]+)<\/CATEGORY_NAME>([\s\S]*?)<\/CATEGORY>/g;

    let match;
    while ((match = categoryRegex.exec(xml)) !== null) {
      const id = parseInt(match[1]);
      const name = match[2].trim();
      const innerContent = match[3];
      const fullPath = parentPath ? `${parentPath} | ${name}` : name;

      const category: Category = {
        id,
        name,
        fullPath,
      };

      // Check for nested categories
      if (innerContent.includes('<CATEGORY>')) {
        category.children = parseCategory(innerContent, fullPath);
      }

      result.push(category);
    }

    return result;
  };

  return parseCategory(xmlText);
}

/**
 * Flatten category tree to array with full paths
 * Only includes LEAF categories (no children) for accurate mapping
 */
function flattenCategories(categories: Category[], result: Category[] = [], leafOnly: boolean = true): Category[] {
  for (const cat of categories) {
    const hasChildren = cat.children && cat.children.length > 0;

    // If leafOnly mode, only add categories without children
    // Otherwise add all categories
    if (!leafOnly || !hasChildren) {
      result.push({
        id: cat.id,
        name: cat.name,
        fullPath: cat.fullPath,
        isLeaf: !hasChildren,
      });
    }

    if (hasChildren) {
      flattenCategories(cat.children!, result, leafOnly);
    }
  }
  return result;
}

/**
 * Parse Zboží.cz JSON category tree
 */
function parseZboziJSON(jsonData: ZboziCategory[]): Category[] {
  const result: Category[] = [];

  const parseCategory = (cat: ZboziCategory, parentPath: string = ''): void => {
    const fullPath = cat.categoryText || (parentPath ? `${parentPath} | ${cat.name}` : cat.name);

    if (cat.id) {
      result.push({
        id: cat.id,
        name: cat.name,
        fullPath,
      });
    }

    if (cat.children && cat.children.length > 0) {
      for (const child of cat.children) {
        parseCategory(child, fullPath);
      }
    }
  };

  for (const cat of jsonData) {
    parseCategory(cat);
  }

  return result;
}

/**
 * Parse Glami XML category tree
 */
function parseGlamiXML(xmlText: string): Category[] {
  const categories: Category[] = [];

  const categoryRegex = /<CATEGORY>[\s\S]*?<CATEGORY_ID>(\d+)<\/CATEGORY_ID>[\s\S]*?<CATEGORY_NAME>([^<]+)<\/CATEGORY_NAME>[\s\S]*?<CATEGORY_FULLNAME>([^<]+)<\/CATEGORY_FULLNAME>[\s\S]*?<\/CATEGORY>/g;

  let match;
  while ((match = categoryRegex.exec(xmlText)) !== null) {
    categories.push({
      id: parseInt(match[1]),
      name: match[2].trim(),
      fullPath: match[3].trim(),
    });
  }

  return categories;
}

/**
 * Parse Google taxonomy TXT file
 * Format: "id - Category > Subcategory > Item"
 */
function parseGoogleTaxonomy(txtContent: string): Category[] {
  const categories: Category[] = [];
  const lines = txtContent.split('\n');

  for (const line of lines) {
    // Skip comments and empty lines
    if (line.startsWith('#') || !line.trim()) continue;

    // Parse "id - Category > Subcategory"
    const match = line.match(/^(\d+)\s*-\s*(.+)$/);
    if (match) {
      const id = parseInt(match[1]);
      const fullPath = match[2].trim();
      const parts = fullPath.split(' > ');
      const name = parts[parts.length - 1];

      categories.push({
        id,
        name,
        fullPath,
      });
    }
  }

  return categories;
}

/**
 * Fetch categories from Heureka
 */
export async function fetchHeurekaCategories(): Promise<Category[]> {
  try {
    const response = await fetch(CATEGORY_SOURCES.heureka);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const xmlText = await response.text();
    const tree = parseHeurekaXML(xmlText);
    return flattenCategories(tree);
  } catch (error) {
    console.error('Failed to fetch Heureka categories:', error);
    throw error;
  }
}

/**
 * Fetch categories from Zboží.cz
 */
export async function fetchZboziCategories(): Promise<Category[]> {
  try {
    const response = await fetch(CATEGORY_SOURCES.zbozi, {
      headers: {
        'Accept': 'application/json; charset=utf-8',
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    // Ensure proper UTF-8 decoding
    const buffer = await response.arrayBuffer();
    const decoder = new TextDecoder('utf-8');
    const text = decoder.decode(buffer);
    const jsonData = JSON.parse(text);

    return parseZboziJSON(jsonData);
  } catch (error) {
    console.error('Failed to fetch Zboží categories:', error);
    throw error;
  }
}

/**
 * Fetch categories from Glami
 */
export async function fetchGlamiCategories(): Promise<Category[]> {
  try {
    const response = await fetch(CATEGORY_SOURCES.glami);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const xmlText = await response.text();
    return parseGlamiXML(xmlText);
  } catch (error) {
    console.error('Failed to fetch Glami categories:', error);
    throw error;
  }
}

/**
 * Fetch categories from Google
 */
export async function fetchGoogleCategories(): Promise<Category[]> {
  try {
    const response = await fetch(CATEGORY_SOURCES.google);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    // Ensure proper UTF-8 decoding (Google doesn't send charset header)
    const buffer = await response.arrayBuffer();
    const decoder = new TextDecoder('utf-8');
    const txtContent = decoder.decode(buffer);

    return parseGoogleTaxonomy(txtContent);
  } catch (error) {
    console.error('Failed to fetch Google categories:', error);
    throw error;
  }
}

/**
 * Fetch all categories from all platforms
 */
export async function fetchAllCategories(): Promise<{
  heureka: Category[];
  zbozi: Category[];
  glami: Category[];
  google: Category[];
}> {
  const [heureka, zbozi, glami, google] = await Promise.allSettled([
    fetchHeurekaCategories(),
    fetchZboziCategories(),
    fetchGlamiCategories(),
    fetchGoogleCategories(),
  ]);

  return {
    heureka: heureka.status === 'fulfilled' ? heureka.value : [],
    zbozi: zbozi.status === 'fulfilled' ? zbozi.value : [],
    glami: glami.status === 'fulfilled' ? glami.value : [],
    google: google.status === 'fulfilled' ? google.value : [],
  };
}

/**
 * Search categories by text (simple text matching)
 */
export function searchCategories(
  categories: Category[],
  query: string,
  limit: number = 10
): Category[] {
  const normalizedQuery = query.toLowerCase().trim();

  // Score each category
  const scored = categories.map(cat => {
    const name = cat.name.toLowerCase();
    const fullPath = (cat.fullPath || '').toLowerCase();

    let score = 0;

    // Exact match in name
    if (name === normalizedQuery) score += 100;
    // Name starts with query
    else if (name.startsWith(normalizedQuery)) score += 50;
    // Name contains query
    else if (name.includes(normalizedQuery)) score += 30;
    // Full path contains query
    else if (fullPath.includes(normalizedQuery)) score += 10;

    // Bonus for shorter paths (more specific)
    if (score > 0) {
      score += Math.max(0, 20 - (cat.fullPath?.split('|').length || 0) * 2);
    }

    return { category: cat, score };
  });

  // Filter and sort by score
  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(s => s.category);
}
