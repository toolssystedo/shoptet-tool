// Types for Category Mapper tool

export interface Category {
  id: string | number;
  name: string;
  fullPath?: string;
  parentId?: string | number;
  children?: Category[];
  isLeaf?: boolean; // true if this is a leaf category (no children)
}

export interface HeurekaCategory {
  CATEGORY_ID: number;
  CATEGORY_NAME: string;
  CATEGORY_FULLNAME?: string;
  children?: HeurekaCategory[];
}

export interface ZboziCategory {
  id?: number;
  name: string;
  categoryText?: string;
  children?: ZboziCategory[];
}

export interface GlamiCategory {
  CATEGORY_ID: number;
  CATEGORY_NAME: string;
  CATEGORY_FULLNAME: string;
}

export interface GoogleCategory {
  id: number;
  name: string;
  fullPath: string;
}

export interface ProductForMapping {
  code: string;
  name: string;
  categoryText?: string;
  defaultCategory?: string;
  description?: string;
  shortDescription?: string;
  // Existing category IDs (may be empty)
  googleCategoryId?: string;
  googleCategoryIdInFeed?: string;
  heurekaCategoryId?: string;
  zboziCategoryId?: string;
  glamiCategoryId?: string;
}

export interface MappedProduct extends ProductForMapping {
  mappedCategories: {
    heureka?: {
      id: string | number;
      name: string;
      fullPath: string;
      confidence: number;
    };
    zbozi?: {
      id: string | number;
      name?: string;
      categoryText?: string;
      fullPath?: string;
      confidence: number;
    };
    google?: {
      id: string | number;
      name: string;
      fullPath: string;
      confidence: number;
    };
    glami?: {
      id: string | number;
      name: string;
      fullPath: string;
      confidence: number;
    };
  };
}

export interface CategoryMappingResult {
  products: MappedProduct[];
  stats: {
    total: number;
    mapped: {
      heureka: number;
      zbozi: number;
      google: number;
      glami: number;
    };
    failed: number;
  };
}

export interface PlatformCategories {
  heureka: Category[];
  zbozi: Category[];
  google: Category[];
  glami: Category[];
  lastUpdated: {
    heureka?: Date;
    zbozi?: Date;
    google?: Date;
    glami?: Date;
  };
}

export type Platform = 'heureka' | 'zbozi' | 'google' | 'glami';

export interface MappingConfig {
  platforms: Platform[];
  overwriteExisting: boolean;
  useAI: boolean;
  language: 'cs' | 'en';
}
