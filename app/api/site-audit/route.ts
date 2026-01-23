import { NextRequest } from 'next/server';
import {
  parseSitemap,
  checkUrl,
  isExternalUrl,
  checkRobotsTxt,
  checkSitemapHealth,
  checkFavicon,
  checkHttpsRedirect,
  analyzePageFull,
  generatePerformanceIssues,
  generateHtmlIssues,
  generateConfigIssues,
  generateSecurityIssues,
  calculateScores,
  checkUrlsBatch,
  type CrawlResult,
  type AuditReport,
  type PerformanceIssue,
  type HtmlIssue,
  type ConfigIssue,
  type SecurityIssue,
} from '@/lib/site-audit/crawler';

// Configuration
const MAX_PAGES = 500; // Increased from 50
const MAX_EXTERNAL_LINKS = 100;
const PAGE_CONCURRENCY = 10; // Parallel page processing (increased from 5)
const LINK_CHECK_CONCURRENCY = 30; // Parallel link checking (increased from 15)

// Normalize URL to avoid duplicates
function normalizePageUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.pathname !== '/' && parsed.pathname.endsWith('/')) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }
    if ((parsed.protocol === 'https:' && parsed.port === '443') ||
        (parsed.protocol === 'http:' && parsed.port === '80')) {
      parsed.port = '';
    }
    return parsed.href;
  } catch {
    return url;
  }
}

function getIssueSignature(issue: { type: string; details?: string }): string {
  return `${issue.type}:${issue.details || ''}`;
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  try {
    const { url } = await request.json();

    if (!url) {
      return new Response(JSON.stringify({ error: 'URL is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let siteUrl: string;
    try {
      const parsed = new URL(url);
      siteUrl = parsed.origin;
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid URL' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const stream = new ReadableStream({
      async start(controller) {
        const sendProgress = (data: object) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        try {
          const performanceIssues: PerformanceIssue[] = [];
          const htmlIssues: HtmlIssue[] = [];
          const configIssues: ConfigIssue[] = [];
          const securityIssues: SecurityIssue[] = [];

          // ========== PHASE 1: CONFIG CHECKS (parallel) ==========
          sendProgress({ phase: 'config', message: 'Kontroluji konfiguraci...', current: 0, total: 4 });

          const [robotsIssues, sitemapResult, faviconIssue, httpsIssue] = await Promise.all([
            checkRobotsTxt(siteUrl),
            checkSitemapHealth(siteUrl),
            checkFavicon(siteUrl),
            checkHttpsRedirect(siteUrl),
          ]);

          configIssues.push(...robotsIssues);
          configIssues.push(...sitemapResult.issues);
          if (faviconIssue) configIssues.push(faviconIssue);
          if (httpsIssue) securityIssues.push(httpsIssue);

          sendProgress({ phase: 'config', message: 'Konfigurace zkontrolována', current: 4, total: 4 });

          // ========== PHASE 2: SITEMAP ==========
          sendProgress({ phase: 'sitemap', message: 'Načítám sitemap...', current: 0, total: 1 });

          let pagesToScan = sitemapResult.urls.length > 0
            ? sitemapResult.urls
            : await parseSitemap(siteUrl);

          if (pagesToScan.length === 0) {
            pagesToScan = [siteUrl];
          }

          // For very large sites, use sampling
          const totalSitemapPages = pagesToScan.length;
          if (pagesToScan.length > MAX_PAGES) {
            // Take first 100, last 50, and random sample from middle
            const first = pagesToScan.slice(0, 100);
            const last = pagesToScan.slice(-50);
            const middle = pagesToScan.slice(100, -50);
            const sampleSize = MAX_PAGES - 150;
            const sampled: string[] = [];

            // Random sampling from middle
            const shuffled = middle.sort(() => Math.random() - 0.5);
            sampled.push(...shuffled.slice(0, sampleSize));

            pagesToScan = [...new Set([...first, ...sampled, ...last])];
          }

          sendProgress({
            phase: 'sitemap',
            message: totalSitemapPages > MAX_PAGES
              ? `Nalezeno ${totalSitemapPages} stránek, analyzuji vzorek ${pagesToScan.length}`
              : `Nalezeno ${pagesToScan.length} stránek`,
            current: pagesToScan.length,
            total: pagesToScan.length,
          });

          // ========== PHASE 3: PARALLEL CRAWLING & ANALYSIS ==========
          const allLinks: Map<string, string> = new Map();
          const allImages: Map<string, string> = new Map();
          const pages404: CrawlResult[] = [];
          const scannedPages = new Set<string>();
          const pageQueue = [...pagesToScan];
          let processedCount = 0;

          // Process pages in batches with concurrency
          const processBatch = async (batch: string[]): Promise<void> => {
            const results = await Promise.all(
              batch.map(async (pageUrl) => {
                if (scannedPages.has(pageUrl)) return null;
                scannedPages.add(pageUrl);

                // First check if page exists (fast HEAD request)
                const { status } = await checkUrl(pageUrl);

                if (status === 404) {
                  return { type: '404' as const, url: pageUrl };
                }

                if (status !== 200 && status < 300) return null;

                // Full page analysis (single fetch for both analysis + links)
                const result = await analyzePageFull(pageUrl);
                return { type: 'success' as const, url: pageUrl, ...result };
              })
            );

            for (const result of results) {
              if (!result) continue;

              if (result.type === '404') {
                pages404.push({
                  url: result.url,
                  status: 404,
                  type: 'page',
                  isExternal: false,
                });
                continue;
              }

              const { url: pageUrl, analysis, links, images } = result;
              const isHomepage = pageUrl === siteUrl || pageUrl === `${siteUrl}/`;

              if (analysis) {
                performanceIssues.push(...generatePerformanceIssues(analysis));
                htmlIssues.push(...generateHtmlIssues(analysis));
                configIssues.push(...generateConfigIssues(analysis, isHomepage));
                securityIssues.push(...generateSecurityIssues(analysis));
              }

              for (const link of links) {
                if (!allLinks.has(link)) {
                  allLinks.set(link, pageUrl);
                }
                // Add new internal pages to queue (limited)
                if (
                  !isExternalUrl(link, siteUrl) &&
                  !scannedPages.has(link) &&
                  !pageQueue.includes(link) &&
                  scannedPages.size + pageQueue.length < MAX_PAGES &&
                  !link.match(/\.(jpg|jpeg|png|gif|svg|pdf|zip|css|js|xml|ico|webp)$/i)
                ) {
                  pageQueue.push(link);
                }
              }

              for (const image of images) {
                if (!allImages.has(image)) {
                  allImages.set(image, pageUrl);
                }
              }
            }
          };

          // Process all pages with progress updates
          while (pageQueue.length > 0) {
            const batch = pageQueue.splice(0, PAGE_CONCURRENCY);
            await processBatch(batch);
            processedCount += batch.length;

            sendProgress({
              phase: 'crawling',
              current: processedCount,
              total: processedCount + pageQueue.length,
              message: `Analyzuji stránky... (${scannedPages.size} hotovo)`,
            });

            // Small delay between batches to be polite (reduced for speed)
            await new Promise(resolve => setTimeout(resolve, 20));
          }

          // ========== PHASE 4: PARALLEL LINK CHECKING ==========
          const internalLinks404: CrawlResult[] = [];
          const externalLinks404: CrawlResult[] = [];
          const brokenImages: CrawlResult[] = [];

          // Prepare links to check (exclude already scanned, limit for speed)
          const internalLinksToCheck = Array.from(allLinks.entries())
            .filter(([link]) => !isExternalUrl(link, siteUrl) && !scannedPages.has(link))
            .slice(0, 500) // Limit internal links to check
            .map(([url, source]) => ({ url, source }));

          const externalLinksToCheck = Array.from(allLinks.entries())
            .filter(([link]) => isExternalUrl(link, siteUrl))
            .slice(0, MAX_EXTERNAL_LINKS)
            .map(([url, source]) => ({ url, source }));

          const imagesToCheck = Array.from(allImages.entries())
            .slice(0, 50) // Check up to 50 images (reduced for speed)
            .map(([url, source]) => ({ url, source }));

          const totalToCheck = internalLinksToCheck.length + externalLinksToCheck.length + imagesToCheck.length;

          sendProgress({
            phase: 'checking',
            message: `Kontroluji ${totalToCheck} odkazů...`,
            current: 0,
            total: totalToCheck,
          });

          // Check all in parallel batches
          let checkedCount = 0;

          // Internal links
          for (let i = 0; i < internalLinksToCheck.length; i += LINK_CHECK_CONCURRENCY) {
            const batch = internalLinksToCheck.slice(i, i + LINK_CHECK_CONCURRENCY);
            const results = await checkUrlsBatch(batch, LINK_CHECK_CONCURRENCY);

            for (const result of results) {
              if (result.status === 404) {
                internalLinks404.push({
                  url: result.url,
                  status: 404,
                  type: 'link',
                  source: result.source,
                  isExternal: false,
                });
              }
            }

            checkedCount += batch.length;
            sendProgress({
              phase: 'checking',
              current: checkedCount,
              total: totalToCheck,
              message: `Kontroluji interní odkazy...`,
            });
          }

          // External links
          for (let i = 0; i < externalLinksToCheck.length; i += LINK_CHECK_CONCURRENCY) {
            const batch = externalLinksToCheck.slice(i, i + LINK_CHECK_CONCURRENCY);
            const results = await checkUrlsBatch(batch, LINK_CHECK_CONCURRENCY);

            for (const result of results) {
              if (result.status === 404 || result.status === 0) {
                externalLinks404.push({
                  url: result.url,
                  status: result.status || 404,
                  type: 'link',
                  source: result.source,
                  isExternal: true,
                });
              }
            }

            checkedCount += batch.length;
            sendProgress({
              phase: 'checking',
              current: checkedCount,
              total: totalToCheck,
              message: `Kontroluji externí odkazy...`,
            });
          }

          // Images
          for (let i = 0; i < imagesToCheck.length; i += LINK_CHECK_CONCURRENCY) {
            const batch = imagesToCheck.slice(i, i + LINK_CHECK_CONCURRENCY);
            const results = await checkUrlsBatch(batch, LINK_CHECK_CONCURRENCY);

            for (const result of results) {
              if (result.status === 404 || result.status === 0) {
                brokenImages.push({
                  url: result.url,
                  status: result.status || 404,
                  type: 'image',
                  source: result.source,
                  isExternal: isExternalUrl(result.url, siteUrl),
                });
              }
            }

            checkedCount += batch.length;
            sendProgress({
              phase: 'checking',
              current: checkedCount,
              total: totalToCheck,
              message: `Kontroluji obrázky...`,
            });
          }

          // ========== BUILD REPORT ==========
          const deduplicateIssues = <T extends { type: string; url?: string; details?: string }>(
            issues: T[]
          ): T[] => {
            const signatureMap = new Map<string, T[]>();

            for (const issue of issues) {
              const normalizedUrl = issue.url ? normalizePageUrl(issue.url) : '';
              const signature = getIssueSignature(issue);

              if (!signatureMap.has(signature)) {
                signatureMap.set(signature, []);
              }

              const existing = signatureMap.get(signature)!;
              const alreadyHasUrl = existing.some(i =>
                (i.url ? normalizePageUrl(i.url) : '') === normalizedUrl
              );

              if (!alreadyHasUrl) {
                existing.push(issue);
              }
            }

            const result: T[] = [];
            const totalPages = scannedPages.size;

            for (const [, issueList] of signatureMap) {
              if (issueList.length === 0) continue;

              if (issueList.length > totalPages * 0.7 && totalPages > 2) {
                const firstIssue = { ...issueList[0] } as T;
                (firstIssue as { details?: string }).details =
                  `${(firstIssue as { details?: string }).details || ''} [Nalezeno na ${issueList.length} stránkách]`.trim();
                result.push(firstIssue);
              } else {
                result.push(...issueList);
              }
            }

            return result;
          };

          const reportWithoutScores = {
            siteUrl,
            totalPages: scannedPages.size,
            totalLinks: allLinks.size,
            totalImages: allImages.size,
            scannedAt: new Date(),
            errors: {
              pages404,
              internalLinks404,
              brokenImages,
              externalLinks404,
            },
            performance: deduplicateIssues(performanceIssues),
            html: deduplicateIssues(htmlIssues),
            config: deduplicateIssues(configIssues),
            security: deduplicateIssues(securityIssues),
          };

          const scores = calculateScores(reportWithoutScores);

          const report: AuditReport = {
            ...reportWithoutScores,
            scores,
          };

          sendProgress({ phase: 'complete', report });
          controller.close();
        } catch (error) {
          sendProgress({
            phase: 'error',
            message: error instanceof Error ? error.message : 'Unknown error',
          });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
