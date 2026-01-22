import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  fetchHeurekaCategories,
  fetchZboziCategories,
  fetchGlamiCategories,
  fetchGoogleCategories,
} from '@/lib/category-mapper/category-fetcher';
import { batchMapProducts } from '@/lib/category-mapper/ai-mapper';
import type {
  ProductForMapping,
  MappedProduct,
  Platform,
  Category,
} from '@/lib/category-mapper/types';

export const maxDuration = 300; // 5 minutes

// Cache for categories (in-memory, resets on server restart)
let categoryCache: {
  heureka?: Category[];
  zbozi?: Category[];
  google?: Category[];
  glami?: Category[];
  lastFetched?: Date;
} = {};

const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

async function getCachedCategories(platforms: Platform[]) {
  const now = new Date();
  const needsRefresh = !categoryCache.lastFetched ||
    now.getTime() - categoryCache.lastFetched.getTime() > CACHE_TTL;

  if (needsRefresh) {
    // Fetch all categories in parallel
    const fetchPromises: Promise<void>[] = [];

    if (platforms.includes('heureka') && !categoryCache.heureka) {
      fetchPromises.push(
        fetchHeurekaCategories().then(cats => { categoryCache.heureka = cats; })
      );
    }
    if (platforms.includes('zbozi') && !categoryCache.zbozi) {
      fetchPromises.push(
        fetchZboziCategories().then(cats => { categoryCache.zbozi = cats; })
      );
    }
    if (platforms.includes('google') && !categoryCache.google) {
      fetchPromises.push(
        fetchGoogleCategories().then(cats => { categoryCache.google = cats; })
      );
    }
    if (platforms.includes('glami') && !categoryCache.glami) {
      fetchPromises.push(
        fetchGlamiCategories().then(cats => { categoryCache.glami = cats; })
      );
    }

    await Promise.allSettled(fetchPromises);
    categoryCache.lastFetched = now;
  }

  return {
    heureka: categoryCache.heureka,
    zbozi: categoryCache.zbozi,
    google: categoryCache.google,
    glami: categoryCache.glami,
  };
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      products,
      platforms,
      useAI = true,
      overwriteExisting = false,
    } = body as {
      products: ProductForMapping[];
      platforms: Platform[];
      useAI?: boolean;
      overwriteExisting?: boolean;
    };

    if (!products || !Array.isArray(products) || products.length === 0) {
      return NextResponse.json(
        { error: 'No products provided' },
        { status: 400 }
      );
    }

    if (!platforms || !Array.isArray(platforms) || platforms.length === 0) {
      return NextResponse.json(
        { error: 'No platforms selected' },
        { status: 400 }
      );
    }

    // Fetch categories for selected platforms
    const platformCategories = await getCachedCategories(platforms);

    // Filter products that need mapping
    const productsToMap = overwriteExisting
      ? products
      : products.filter(p => {
          // Check if any selected platform is missing category
          for (const platform of platforms) {
            const fieldMap: Record<Platform, keyof ProductForMapping> = {
              heureka: 'heurekaCategoryId',
              zbozi: 'zboziCategoryId',
              google: 'googleCategoryId',
              glami: 'glamiCategoryId',
            };
            if (!p[fieldMap[platform]]) return true;
          }
          return false;
        });

    // Use optimized batch mapping with optional AI verification
    const mappedProducts = await batchMapProducts(
      productsToMap,
      platformCategories,
      platforms,
      undefined, // no progress callback for API
      useAI
    );

    // Calculate stats
    const stats = {
      total: products.length,
      processed: mappedProducts.length,
      mapped: {
        heureka: mappedProducts.filter(p => p.mappedCategories.heureka).length,
        zbozi: mappedProducts.filter(p => p.mappedCategories.zbozi).length,
        google: mappedProducts.filter(p => p.mappedCategories.google).length,
        glami: mappedProducts.filter(p => p.mappedCategories.glami).length,
      },
    };

    return NextResponse.json({
      success: true,
      products: mappedProducts,
      stats,
    });
  } catch (error) {
    console.error('Category mapping error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET endpoint to fetch available categories
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const platform = searchParams.get('platform') as Platform | null;

    if (!platform || !['heureka', 'zbozi', 'google', 'glami'].includes(platform)) {
      return NextResponse.json(
        { error: 'Invalid platform' },
        { status: 400 }
      );
    }

    const categories = await getCachedCategories([platform]);

    return NextResponse.json({
      platform,
      categories: categories[platform] || [],
      count: (categories[platform] || []).length,
    });
  } catch (error) {
    console.error('Failed to fetch categories:', error);
    return NextResponse.json(
      { error: 'Failed to fetch categories' },
      { status: 500 }
    );
  }
}
