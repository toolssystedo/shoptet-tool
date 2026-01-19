import { NextRequest } from 'next/server';
import {
  parseSitemap,
  extractLinksFromPage,
  checkUrl,
  isExternalUrl,
  checkRobotsTxt,
  checkSitemapHealth,
  checkFavicon,
  checkHttpsRedirect,
  analyzePage,
  generatePerformanceIssues,
  generateHtmlIssues,
  generateConfigIssues,
  generateSecurityIssues,
  calculateScores,
  type CrawlResult,
  type AuditReport,
  type PerformanceIssue,
  type HtmlIssue,
  type ConfigIssue,
  type SecurityIssue,
} from '@/lib/site-audit/crawler';

const MAX_PAGES = 50;
const MAX_EXTERNAL_LINKS = 30;

// Normalize URL to avoid duplicates like "/" and ""
function normalizePageUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Remove trailing slash for consistency (except root)
    if (parsed.pathname !== '/' && parsed.pathname.endsWith('/')) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }
    // Remove default ports
    if ((parsed.protocol === 'https:' && parsed.port === '443') ||
        (parsed.protocol === 'http:' && parsed.port === '80')) {
      parsed.port = '';
    }
    return parsed.href;
  } catch {
    return url;
  }
}

// Create issue signature for deduplication
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
          // Collections for issues
          const performanceIssues: PerformanceIssue[] = [];
          const htmlIssues: HtmlIssue[] = [];
          const configIssues: ConfigIssue[] = [];
          const securityIssues: SecurityIssue[] = [];

          // ========== PHASE 1: CONFIG CHECKS ==========
          sendProgress({ phase: 'config', message: 'Kontroluji konfiguraci...', current: 0, total: 4 });

          // Check robots.txt
          const robotsIssues = await checkRobotsTxt(siteUrl);
          configIssues.push(...robotsIssues);
          sendProgress({ phase: 'config', message: 'Kontroluji robots.txt...', current: 1, total: 4 });

          // Check sitemap
          const { issues: sitemapIssues, urls: sitemapUrls } = await checkSitemapHealth(siteUrl);
          configIssues.push(...sitemapIssues);
          sendProgress({ phase: 'config', message: 'Kontroluji sitemap...', current: 2, total: 4 });

          // Check favicon
          const faviconIssue = await checkFavicon(siteUrl);
          if (faviconIssue) configIssues.push(faviconIssue);
          sendProgress({ phase: 'config', message: 'Kontroluji favicon...', current: 3, total: 4 });

          // Check HTTPS redirect
          const httpsIssue = await checkHttpsRedirect(siteUrl);
          if (httpsIssue) securityIssues.push(httpsIssue);
          sendProgress({ phase: 'config', message: 'Kontroluji HTTPS...', current: 4, total: 4 });

          // ========== PHASE 2: SITEMAP ==========
          sendProgress({ phase: 'sitemap', message: 'Načítám sitemap...', current: 0, total: 1 });

          let pagesToScan = sitemapUrls.length > 0 ? sitemapUrls : await parseSitemap(siteUrl);

          if (pagesToScan.length === 0) {
            pagesToScan = [siteUrl];
          }

          pagesToScan = pagesToScan.slice(0, MAX_PAGES);

          sendProgress({
            phase: 'sitemap',
            message: `Nalezeno ${pagesToScan.length} stránek`,
            current: pagesToScan.length,
            total: pagesToScan.length,
          });

          // ========== PHASE 3: CRAWLING & ANALYSIS ==========
          const allLinks: Map<string, string> = new Map();
          const allImages: Map<string, string> = new Map();
          const pages404: CrawlResult[] = [];
          const scannedPages = new Set<string>();

          for (let i = 0; i < pagesToScan.length; i++) {
            const pageUrl = pagesToScan[i];

            if (scannedPages.has(pageUrl)) continue;
            scannedPages.add(pageUrl);

            sendProgress({
              phase: 'crawling',
              current: i + 1,
              total: pagesToScan.length,
              currentUrl: pageUrl,
            });

            // Check page status
            const { status } = await checkUrl(pageUrl);

            if (status === 404) {
              pages404.push({
                url: pageUrl,
                status: 404,
                type: 'page',
                isExternal: false,
              });
              continue;
            }

            if (status !== 200 && status < 300) continue;

            // Analyze page for technical issues
            const isHomepage = pageUrl === siteUrl || pageUrl === `${siteUrl}/`;
            const analysis = await analyzePage(pageUrl);

            if (analysis) {
              // Generate issues from analysis
              performanceIssues.push(...generatePerformanceIssues(analysis));
              htmlIssues.push(...generateHtmlIssues(analysis));
              configIssues.push(...generateConfigIssues(analysis, isHomepage));
              securityIssues.push(...generateSecurityIssues(analysis));
            }

            // Extract links and images
            const { links, images } = await extractLinksFromPage(pageUrl);

            for (const link of links) {
              if (!allLinks.has(link)) {
                allLinks.set(link, pageUrl);
              }
            }

            for (const image of images) {
              if (!allImages.has(image)) {
                allImages.set(image, pageUrl);
              }
            }

            // Add new internal pages to scan
            for (const link of links) {
              if (
                !isExternalUrl(link, siteUrl) &&
                !scannedPages.has(link) &&
                !pagesToScan.includes(link) &&
                pagesToScan.length < MAX_PAGES
              ) {
                if (!link.match(/\.(jpg|jpeg|png|gif|svg|pdf|zip|css|js|xml|ico|webp)$/i)) {
                  pagesToScan.push(link);
                }
              }
            }

            await new Promise(resolve => setTimeout(resolve, 100));
          }

          // ========== PHASE 4: LINK CHECKING ==========
          sendProgress({
            phase: 'checking',
            message: 'Kontroluji odkazy...',
            current: 0,
            total: allLinks.size + allImages.size,
          });

          const internalLinks404: CrawlResult[] = [];
          const externalLinks404: CrawlResult[] = [];
          const brokenImages: CrawlResult[] = [];

          // Check internal links
          const internalLinks = Array.from(allLinks.entries()).filter(
            ([link]) => !isExternalUrl(link, siteUrl)
          );

          let checkCount = 0;
          for (const [link, source] of internalLinks) {
            if (scannedPages.has(link)) continue;

            checkCount++;
            sendProgress({
              phase: 'checking',
              current: checkCount,
              total: internalLinks.length + Math.min(MAX_EXTERNAL_LINKS, allLinks.size - internalLinks.length) + allImages.size,
              currentUrl: link,
            });

            const { status } = await checkUrl(link);

            if (status === 404) {
              internalLinks404.push({
                url: link,
                status: 404,
                type: 'link',
                source,
                isExternal: false,
              });
            }

            await new Promise(resolve => setTimeout(resolve, 50));
          }

          // Check external links (limited)
          const externalLinks = Array.from(allLinks.entries())
            .filter(([link]) => isExternalUrl(link, siteUrl))
            .slice(0, MAX_EXTERNAL_LINKS);

          for (const [link, source] of externalLinks) {
            checkCount++;
            sendProgress({
              phase: 'checking',
              current: checkCount,
              total: internalLinks.length + externalLinks.length + allImages.size,
              currentUrl: link,
            });

            const { status } = await checkUrl(link);

            if (status === 404 || status === 0) {
              externalLinks404.push({
                url: link,
                status: status || 404,
                type: 'link',
                source,
                isExternal: true,
              });
            }

            await new Promise(resolve => setTimeout(resolve, 100));
          }

          // Check images (sample)
          const imagesToCheck = Array.from(allImages.entries()).slice(0, 50);
          for (const [imageUrl, source] of imagesToCheck) {
            checkCount++;
            sendProgress({
              phase: 'checking',
              current: checkCount,
              total: internalLinks.length + externalLinks.length + imagesToCheck.length,
              currentUrl: imageUrl,
            });

            const { status } = await checkUrl(imageUrl);

            if (status === 404 || status === 0) {
              brokenImages.push({
                url: imageUrl,
                status: status || 404,
                type: 'image',
                source,
                isExternal: isExternalUrl(imageUrl, siteUrl),
              });
            }

            await new Promise(resolve => setTimeout(resolve, 50));
          }

          // ========== BUILD REPORT ==========

          // Deduplicate issues - group same issues across pages, show only unique ones
          // For issues that appear on all/most pages (SPA behavior), show once with note
          const deduplicateIssues = <T extends { type: string; url?: string; details?: string; severity?: string }>(
            issues: T[]
          ): T[] => {
            const signatureMap = new Map<string, T[]>();

            for (const issue of issues) {
              const normalizedUrl = issue.url ? normalizePageUrl(issue.url) : '';
              const signature = getIssueSignature(issue);

              if (!signatureMap.has(signature)) {
                signatureMap.set(signature, []);
              }

              // Check if we already have this issue for this normalized URL
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

              // If issue appears on most pages (>70%), keep only the first one with a note
              if (issueList.length > totalPages * 0.7 && totalPages > 2) {
                // Create a proper copy preserving all properties
                const firstIssue = { ...issueList[0] } as T;
                (firstIssue as { details?: string }).details =
                  `${(firstIssue as { details?: string }).details || ''} [Nalezeno na ${issueList.length} stránkách]`.trim();
                result.push(firstIssue);
              } else {
                // Otherwise keep all unique occurrences
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
