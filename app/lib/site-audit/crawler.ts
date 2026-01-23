import * as cheerio from "cheerio";

// ============= TYPES =============

export interface CrawlResult {
  url: string;
  status: number;
  type: "page" | "image" | "link";
  source?: string;
  isExternal: boolean;
}

export interface PerformanceIssue {
  type:
    | "too_many_js"
    | "too_many_css"
    | "unoptimized_image"
    | "missing_lazy_loading"
    | "render_blocking_script"
    | "too_many_webfonts"
    | "large_page_size";
  url: string;
  source?: string;
  details?: string;
  severity: "warning" | "error";
}

export interface HtmlIssue {
  type:
    | "invalid_html"
    | "missing_h1"
    | "duplicate_h1"
    | "heading_hierarchy"
    | "empty_link"
    | "missing_alt"
    | "deprecated_element"
    | "missing_title"
    | "missing_meta_description";
  url: string;
  element?: string;
  details?: string;
  severity: "warning" | "error";
  // New: specific elements that cause the issue
  elements?: string[];
}

export interface ConfigIssue {
  type:
    | "missing_robots"
    | "invalid_robots"
    | "missing_sitemap"
    | "sitemap_404_urls"
    | "sitemap_redirects"
    | "outdated_sitemap"
    | "missing_favicon"
    | "missing_og_tags"
    | "missing_twitter_cards";
  url?: string;
  details?: string;
  severity: "warning" | "error";
}

export interface SecurityIssue {
  type:
    | "mixed_content"
    | "no_https_redirect"
    | "untrusted_scripts"
    | "missing_csp"
    | "missing_x_frame_options";
  url: string;
  source?: string;
  details?: string;
  severity: "warning" | "error";
}

export interface PageAnalysis {
  url: string;
  title?: string;
  h1Count: number;
  h1Text?: string[];
  headingHierarchy: string[];
  imagesWithoutAlt: number;
  imagesWithoutAltList: string[]; // Actual img tags/src
  emptyLinks: number;
  emptyLinksList: string[]; // Actual empty link hrefs or text
  jsFiles: number;
  cssFiles: number;
  renderBlockingScripts: number;
  webfonts: number;
  hasLazyLoading: boolean;
  mixedContent: string[];
  externalScripts: string[];
  hasFavicon: boolean;
  hasOgTags: boolean;
  hasTwitterCards: boolean;
  hasMetaDescription: boolean;
  pageSize: number;
}

export interface AuditReport {
  siteUrl: string;
  totalPages: number;
  totalLinks: number;
  totalImages: number;
  scannedAt: Date;

  // Link errors (existing)
  errors: {
    pages404: CrawlResult[];
    internalLinks404: CrawlResult[];
    brokenImages: CrawlResult[];
    externalLinks404: CrawlResult[];
  };

  // Technical audit (new)
  performance: PerformanceIssue[];
  html: HtmlIssue[];
  config: ConfigIssue[];
  security: SecurityIssue[];

  // Summary scores
  scores: {
    links: number;
    performance: number;
    html: number;
    config: number;
    security: number;
    overall: number;
  };
}

export interface CrawlProgress {
  phase: "sitemap" | "config" | "crawling" | "checking" | "complete" | "error";
  current: number;
  total: number;
  currentUrl?: string;
  message?: string;
  report?: AuditReport;
}

// ============= SITEMAP PARSING =============

export async function parseSitemap(siteUrl: string): Promise<string[]> {
  const urls: string[] = [];
  const baseUrl = new URL(siteUrl).origin;

  try {
    const sitemapPaths = [
      "/sitemap.xml",
      "/sitemap_index.xml",
      "/sitemap-index.xml",
    ];

    for (const path of sitemapPaths) {
      try {
        const response = await fetch(`${baseUrl}${path}`, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; SiteAuditBot/1.0)",
          },
        });

        if (response.ok) {
          const xml = await response.text();
          const $ = cheerio.load(xml, { xmlMode: true });

          const sitemapLocs = $("sitemap > loc");
          if (sitemapLocs.length > 0) {
            for (const elem of sitemapLocs.toArray()) {
              const nestedUrl = $(elem).text().trim();
              try {
                const nestedResponse = await fetch(nestedUrl, {
                  headers: {
                    "User-Agent": "Mozilla/5.0 (compatible; SiteAuditBot/1.0)",
                  },
                });
                if (nestedResponse.ok) {
                  const nestedXml = await nestedResponse.text();
                  const nested$ = cheerio.load(nestedXml, { xmlMode: true });
                  nested$("url > loc").each((_, el) => {
                    const loc = nested$(el).text().trim();
                    if (loc) urls.push(loc);
                  });
                }
              } catch {
                // Ignore nested sitemap errors
              }
            }
          } else {
            $("url > loc").each((_, el) => {
              const loc = $(el).text().trim();
              if (loc) urls.push(loc);
            });
          }

          if (urls.length > 0) break;
        }
      } catch {
        // Continue with next path
      }
    }
  } catch (error) {
    console.error("Error parsing sitemap:", error);
  }

  return urls;
}

// ============= URL CHECKING =============

// Fetch with timeout to prevent hanging
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 8000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function checkUrl(
  url: string
): Promise<{ status: number; contentType: string; redirectUrl?: string }> {
  try {
    const response = await fetchWithTimeout(url, {
      method: "HEAD",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SiteAuditBot/1.0)",
      },
      redirect: "manual",
    }, 5000); // 5 second timeout for HEAD requests

    const redirectUrl = response.headers.get("location") || undefined;

    return {
      status: response.status,
      contentType: response.headers.get("content-type") || "",
      redirectUrl,
    };
  } catch {
    try {
      const response = await fetchWithTimeout(url, {
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; SiteAuditBot/1.0)",
        },
        redirect: "manual",
      }, 8000); // 8 second timeout for GET fallback

      return {
        status: response.status,
        contentType: response.headers.get("content-type") || "",
        redirectUrl: response.headers.get("location") || undefined,
      };
    } catch {
      return { status: 0, contentType: "" }; // Timeout or error = treat as broken
    }
  }
}

// ============= CONFIG CHECKS =============

export async function checkRobotsTxt(siteUrl: string): Promise<ConfigIssue[]> {
  const issues: ConfigIssue[] = [];
  const baseUrl = new URL(siteUrl).origin;

  try {
    const response = await fetch(`${baseUrl}/robots.txt`, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SiteAuditBot/1.0)" },
    });

    if (!response.ok) {
      issues.push({
        type: "missing_robots",
        url: `${baseUrl}/robots.txt`,
        severity: "warning",
        details: `Status: ${response.status}`,
      });
    } else {
      const content = await response.text();

      // Check for common issues
      if (!content.toLowerCase().includes("user-agent")) {
        issues.push({
          type: "invalid_robots",
          url: `${baseUrl}/robots.txt`,
          severity: "warning",
          details: "Missing User-agent directive",
        });
      }

      if (!content.toLowerCase().includes("sitemap")) {
        issues.push({
          type: "invalid_robots",
          url: `${baseUrl}/robots.txt`,
          severity: "warning",
          details: "Missing Sitemap directive",
        });
      }
    }
  } catch {
    issues.push({
      type: "missing_robots",
      url: `${baseUrl}/robots.txt`,
      severity: "warning",
      details: "Failed to fetch robots.txt",
    });
  }

  return issues;
}

export async function checkSitemapHealth(
  siteUrl: string
): Promise<{ issues: ConfigIssue[]; urls: string[] }> {
  const issues: ConfigIssue[] = [];
  const baseUrl = new URL(siteUrl).origin;
  const urls: string[] = [];

  const sitemapPaths = ["/sitemap.xml", "/sitemap_index.xml"];
  let sitemapFound = false;

  for (const path of sitemapPaths) {
    try {
      const response = await fetch(`${baseUrl}${path}`, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; SiteAuditBot/1.0)" },
      });

      if (response.ok) {
        sitemapFound = true;
        const xml = await response.text();
        const $ = cheerio.load(xml, { xmlMode: true });

        // Check lastmod dates
        const lastmodElements = $("lastmod");
        if (lastmodElements.length > 0) {
          const dates = lastmodElements.toArray().map((el) => $(el).text());
          const mostRecent = dates.sort().reverse()[0];
          const lastModDate = new Date(mostRecent);
          const daysSinceUpdate =
            (Date.now() - lastModDate.getTime()) / (1000 * 60 * 60 * 24);

          if (daysSinceUpdate > 7) {
            issues.push({
              type: "outdated_sitemap",
              url: `${baseUrl}${path}`,
              severity: "warning",
              details: `Last updated ${Math.floor(daysSinceUpdate)} days ago`,
            });
          }
        }

        // Get URLs
        $("url > loc").each((_, el) => {
          urls.push($(el).text().trim());
        });

        break;
      }
    } catch {
      // Continue
    }
  }

  if (!sitemapFound) {
    issues.push({
      type: "missing_sitemap",
      severity: "error",
      details: "No sitemap.xml found",
    });
  }

  return { issues, urls };
}

export async function checkFavicon(
  siteUrl: string
): Promise<ConfigIssue | null> {
  const baseUrl = new URL(siteUrl).origin;
  const faviconPaths = [
    "/favicon.ico",
    "/favicon.png",
    "/apple-touch-icon.png",
  ];

  for (const path of faviconPaths) {
    try {
      const response = await fetch(`${baseUrl}${path}`, {
        method: "HEAD",
        headers: { "User-Agent": "Mozilla/5.0 (compatible; SiteAuditBot/1.0)" },
      });
      if (response.ok) return null;
    } catch {
      // Continue
    }
  }

  return {
    type: "missing_favicon",
    url: `${baseUrl}/favicon.ico`,
    severity: "warning",
    details: "No favicon found at standard locations",
  };
}

export async function checkHttpsRedirect(
  siteUrl: string
): Promise<SecurityIssue | null> {
  try {
    const httpUrl = siteUrl.replace("https://", "http://");
    const response = await fetch(httpUrl, {
      method: "HEAD",
      redirect: "manual",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SiteAuditBot/1.0)" },
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (location?.startsWith("https://")) {
        return null; // Good - redirects to HTTPS
      }
    }

    // Check if site even has HTTPS
    if (siteUrl.startsWith("http://")) {
      return {
        type: "no_https_redirect",
        url: httpUrl,
        severity: "error",
        details: "Site does not redirect HTTP to HTTPS",
      };
    }

    return {
      type: "no_https_redirect",
      url: httpUrl,
      severity: "warning",
      details: "HTTP does not redirect to HTTPS",
    };
  } catch {
    return null;
  }
}

// ============= PAGE ANALYSIS =============

export async function analyzePage(
  pageUrl: string
): Promise<PageAnalysis | null> {
  try {
    const response = await fetch(pageUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SiteAuditBot/1.0)" },
    });

    if (!response.ok) return null;

    const html = await response.text();
    const $ = cheerio.load(html);
    const baseUrl = new URL(pageUrl).origin;

    // Title
    const title = $("title").text().trim() || undefined;

    // H1 analysis
    const h1Elements = $("h1");
    const h1Text = h1Elements.toArray().map((el) => $(el).text().trim());

    // Heading hierarchy
    const headingHierarchy: string[] = [];
    $("h1, h2, h3, h4, h5, h6").each((_, el) => {
      headingHierarchy.push(el.tagName.toLowerCase());
    });

    // Images without alt
    const imagesWithoutAltList: string[] = [];
    $("img").each((_, el) => {
      const alt = $(el).attr("alt");
      if (alt === undefined || alt === "") {
        const src = $(el).attr("src") || $(el).attr("data-src") || "";
        if (src && imagesWithoutAltList.length < 10) {
          imagesWithoutAltList.push(src.substring(0, 100));
        }
      }
    });
    const imagesWithoutAlt = imagesWithoutAltList.length;

    // Empty links
    const emptyLinksList: string[] = [];
    $("a").each((_, el) => {
      const href = $(el).attr("href");
      if (
        !href ||
        href === "#" ||
        href === "javascript:void(0)" ||
        href === "javascript:;"
      ) {
        const text = $(el).text().trim().substring(0, 50) || "[no text]";
        const linkHref = href || "[no href]";
        if (emptyLinksList.length < 10) {
          emptyLinksList.push(`"${text}" → ${linkHref}`);
        }
      }
    });
    const emptyLinks = emptyLinksList.length;

    // JS files in head
    const jsFiles = $("script[src]").length;

    // CSS files
    const cssFiles = $('link[rel="stylesheet"]').length;

    // Render blocking scripts (scripts in head without async/defer)
    const renderBlockingScripts = $("head script[src]").filter((_, el) => {
      const async = $(el).attr("async");
      const defer = $(el).attr("defer");
      return async === undefined && defer === undefined;
    }).length;

    // Webfonts
    const webfonts = $(
      'link[href*="fonts.googleapis.com"], link[href*="fonts.gstatic.com"], @font-face'
    ).length;

    // Lazy loading check
    const hasLazyLoading =
      $('img[loading="lazy"], img[data-src], img[data-lazy]').length > 0;

    // Mixed content (HTTP resources on HTTPS page)
    // Only check actual loaded resources from the SAME domain, NOT external resources or regular <a> links
    const mixedContent: string[] = [];
    if (pageUrl.startsWith("https://")) {
      const pageHostname = new URL(pageUrl).hostname.replace(/^www\./, '');

      // Helper to check if URL is from the same domain
      const isSameDomain = (url: string): boolean => {
        try {
          const resourceHostname = new URL(url).hostname.replace(/^www\./, '');
          return resourceHostname === pageHostname;
        } catch {
          return false;
        }
      };

      // Images, scripts, iframes, embeds, objects, audio, video - actual loaded content
      $('img[src^="http://"], script[src^="http://"], iframe[src^="http://"], embed[src^="http://"], object[data^="http://"], audio[src^="http://"], video[src^="http://"], source[src^="http://"]').each((_, el) => {
        const src = $(el).attr("src") || $(el).attr("data");
        if (src && isSameDomain(src)) {
          mixedContent.push(src);
        }
      });
      // CSS loaded via link
      $('link[rel="stylesheet"][href^="http://"]').each((_, el) => {
        const href = $(el).attr("href");
        if (href && isSameDomain(href)) {
          mixedContent.push(href);
        }
      });
    }

    // External scripts
    const externalScripts: string[] = [];
    $("script[src]").each((_, el) => {
      const src = $(el).attr("src");
      if (src && !src.startsWith("/") && !src.startsWith(baseUrl)) {
        try {
          const scriptUrl = new URL(src, pageUrl);
          if (scriptUrl.origin !== baseUrl) {
            externalScripts.push(scriptUrl.href);
          }
        } catch {
          // Ignore invalid URLs
        }
      }
    });

    // Favicon check in HTML
    const hasFavicon = $('link[rel*="icon"]').length > 0;

    // Open Graph tags
    const hasOgTags = $('meta[property^="og:"]').length >= 3;

    // Twitter Cards
    const hasTwitterCards = $('meta[name^="twitter:"]').length >= 2;

    // Meta description
    const metaDescContent = $('meta[name="description"]').attr("content");
    const hasMetaDescription = Boolean(metaDescContent && metaDescContent.length > 0);

    // Page size estimate
    const pageSize = html.length;

    return {
      url: pageUrl,
      title,
      h1Count: h1Elements.length,
      h1Text,
      headingHierarchy,
      imagesWithoutAlt,
      imagesWithoutAltList,
      emptyLinks,
      emptyLinksList,
      jsFiles,
      cssFiles,
      renderBlockingScripts,
      webfonts,
      hasLazyLoading,
      mixedContent,
      externalScripts,
      hasFavicon,
      hasOgTags,
      hasTwitterCards,
      hasMetaDescription,
      pageSize,
    };
  } catch (error) {
    console.error(`Error analyzing ${pageUrl}:`, error);
    return null;
  }
}

// ============= ISSUE GENERATORS =============

export function generatePerformanceIssues(
  analysis: PageAnalysis
): PerformanceIssue[] {
  const issues: PerformanceIssue[] = [];

  if (analysis.jsFiles > 10) {
    issues.push({
      type: "too_many_js",
      url: analysis.url,
      severity: "warning",
      details: `${analysis.jsFiles} JavaScript files found`,
    });
  }

  if (analysis.cssFiles > 5) {
    issues.push({
      type: "too_many_css",
      url: analysis.url,
      severity: "warning",
      details: `${analysis.cssFiles} CSS files found`,
    });
  }

  if (analysis.renderBlockingScripts > 0) {
    issues.push({
      type: "render_blocking_script",
      url: analysis.url,
      severity: "warning",
      details: `${analysis.renderBlockingScripts} render-blocking scripts in head`,
    });
  }

  if (analysis.webfonts > 3) {
    issues.push({
      type: "too_many_webfonts",
      url: analysis.url,
      severity: "warning",
      details: `${analysis.webfonts} webfont references found`,
    });
  }

  if (!analysis.hasLazyLoading && analysis.imagesWithoutAlt > 5) {
    issues.push({
      type: "missing_lazy_loading",
      url: analysis.url,
      severity: "warning",
      details: "No lazy loading detected for images",
    });
  }

  if (analysis.pageSize > 500000) {
    issues.push({
      type: "large_page_size",
      url: analysis.url,
      severity: "warning",
      details: `Page size: ${Math.round(analysis.pageSize / 1024)}KB`,
    });
  }

  return issues;
}

export function generateHtmlIssues(analysis: PageAnalysis): HtmlIssue[] {
  const issues: HtmlIssue[] = [];

  // H1 checks
  if (analysis.h1Count === 0) {
    issues.push({
      type: "missing_h1",
      url: analysis.url,
      severity: "error",
      details: "Page has no H1 heading",
    });
  } else if (analysis.h1Count > 1) {
    issues.push({
      type: "duplicate_h1",
      url: analysis.url,
      severity: "warning",
      details: `Page has ${analysis.h1Count} H1 headings: ${analysis.h1Text?.join(", ")}`,
    });
  }

  // Heading hierarchy check
  const hierarchy = analysis.headingHierarchy;
  for (let i = 1; i < hierarchy.length; i++) {
    const prevLevel = parseInt(hierarchy[i - 1].charAt(1));
    const currLevel = parseInt(hierarchy[i].charAt(1));
    if (currLevel > prevLevel + 1) {
      issues.push({
        type: "heading_hierarchy",
        url: analysis.url,
        severity: "warning",
        details: `Skipped heading level: ${hierarchy[i - 1]} → ${hierarchy[i]}`,
      });
      break;
    }
  }

  // Images without alt
  if (analysis.imagesWithoutAlt > 0) {
    issues.push({
      type: "missing_alt",
      url: analysis.url,
      severity: "warning",
      details: `${analysis.imagesWithoutAlt} images without alt attribute`,
      elements: analysis.imagesWithoutAltList,
    });
  }

  // Empty links
  if (analysis.emptyLinks > 0) {
    issues.push({
      type: "empty_link",
      url: analysis.url,
      severity: "warning",
      details: `${analysis.emptyLinks} empty or invalid links`,
      elements: analysis.emptyLinksList,
    });
  }

  // Meta description
  if (!analysis.hasMetaDescription) {
    issues.push({
      type: "missing_meta_description",
      url: analysis.url,
      severity: "warning",
      details: "Missing meta description",
    });
  }

  // Title
  if (!analysis.title) {
    issues.push({
      type: "missing_title",
      url: analysis.url,
      severity: "error",
      details: "Page has no title",
    });
  }

  return issues;
}

export function generateConfigIssues(
  analysis: PageAnalysis,
  isHomepage: boolean
): ConfigIssue[] {
  const issues: ConfigIssue[] = [];

  if (isHomepage) {
    if (!analysis.hasOgTags) {
      issues.push({
        type: "missing_og_tags",
        url: analysis.url,
        severity: "warning",
        details: "Missing Open Graph meta tags",
      });
    }

    if (!analysis.hasTwitterCards) {
      issues.push({
        type: "missing_twitter_cards",
        url: analysis.url,
        severity: "warning",
        details: "Missing Twitter Card meta tags",
      });
    }
  }

  return issues;
}

export function generateSecurityIssues(
  analysis: PageAnalysis
): SecurityIssue[] {
  const issues: SecurityIssue[] = [];

  // Mixed content
  for (const url of analysis.mixedContent) {
    issues.push({
      type: "mixed_content",
      url: analysis.url,
      source: url,
      severity: "error",
      details: `HTTP resource on HTTPS page: ${url}`,
    });
  }

  // Check for untrusted external scripts
  const trustedDomains = [
    "googleapis.com",
    "gstatic.com",
    "google.com",
    "googletagmanager.com",
    "google-analytics.com",
    "facebook.net",
    "facebook.com",
    "cloudflare.com",
    "cloudflareinsights.com",
    "jquery.com",
    "jsdelivr.net",
    "unpkg.com",
    "cdnjs.cloudflare.com",
    "shoptet.cz",
  ];

  for (const scriptUrl of analysis.externalScripts) {
    try {
      const scriptHost = new URL(scriptUrl).hostname;
      const isTrusted = trustedDomains.some(
        (domain) => scriptHost === domain || scriptHost.endsWith(`.${domain}`)
      );

      if (!isTrusted) {
        issues.push({
          type: "untrusted_scripts",
          url: analysis.url,
          source: scriptUrl,
          severity: "warning",
          details: `External script from: ${scriptHost}`,
        });
      }
    } catch {
      // Ignore invalid URLs
    }
  }

  return issues;
}

// ============= LINK EXTRACTION =============

export async function extractLinksFromPage(
  pageUrl: string
): Promise<{ links: string[]; images: string[] }> {
  const links: string[] = [];
  const images: string[] = [];

  try {
    const response = await fetch(pageUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SiteAuditBot/1.0)" },
    });

    if (!response.ok) return { links, images };

    const html = await response.text();
    const $ = cheerio.load(html);
    const baseUrl = new URL(pageUrl).origin;

    $("a[href]").each((_, el) => {
      const href = $(el).attr("href");
      if (href) {
        const absoluteUrl = resolveUrl(href, baseUrl, pageUrl);
        if (absoluteUrl && !links.includes(absoluteUrl)) {
          links.push(absoluteUrl);
        }
      }
    });

    $("img[src]").each((_, el) => {
      const src = $(el).attr("src");
      if (src) {
        const absoluteUrl = resolveUrl(src, baseUrl, pageUrl);
        if (absoluteUrl && !images.includes(absoluteUrl)) {
          images.push(absoluteUrl);
        }
      }
    });

    $("img[srcset], source[srcset]").each((_, el) => {
      const srcset = $(el).attr("srcset");
      if (srcset) {
        const srcs = srcset.split(",").map((s) => s.trim().split(" ")[0]);
        for (const src of srcs) {
          const absoluteUrl = resolveUrl(src, baseUrl, pageUrl);
          if (absoluteUrl && !images.includes(absoluteUrl)) {
            images.push(absoluteUrl);
          }
        }
      }
    });
  } catch (error) {
    console.error(`Error extracting links from ${pageUrl}:`, error);
  }

  return { links, images };
}

// ============= COMBINED PAGE ANALYSIS (OPTIMIZED) =============

/**
 * Combined function that fetches page ONCE and returns both analysis AND links
 * This is ~2x faster than calling analyzePage + extractLinksFromPage separately
 */
export async function analyzePageFull(
  pageUrl: string
): Promise<{ analysis: PageAnalysis | null; links: string[]; images: string[] }> {
  const links: string[] = [];
  const images: string[] = [];

  try {
    const response = await fetchWithTimeout(pageUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SiteAuditBot/1.0)" },
    }, 15000); // 15 second timeout for full page analysis

    if (!response.ok) {
      return { analysis: null, links, images };
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const baseUrl = new URL(pageUrl).origin;

    // ===== EXTRACT LINKS =====
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href");
      if (href) {
        const absoluteUrl = resolveUrl(href, baseUrl, pageUrl);
        if (absoluteUrl && !links.includes(absoluteUrl)) {
          links.push(absoluteUrl);
        }
      }
    });

    // ===== EXTRACT IMAGES =====
    $("img[src]").each((_, el) => {
      const src = $(el).attr("src");
      if (src) {
        const absoluteUrl = resolveUrl(src, baseUrl, pageUrl);
        if (absoluteUrl && !images.includes(absoluteUrl)) {
          images.push(absoluteUrl);
        }
      }
    });

    $("img[srcset], source[srcset]").each((_, el) => {
      const srcset = $(el).attr("srcset");
      if (srcset) {
        const srcs = srcset.split(",").map((s) => s.trim().split(" ")[0]);
        for (const src of srcs) {
          const absoluteUrl = resolveUrl(src, baseUrl, pageUrl);
          if (absoluteUrl && !images.includes(absoluteUrl)) {
            images.push(absoluteUrl);
          }
        }
      }
    });

    // ===== PAGE ANALYSIS (reuse parsed HTML) =====
    const title = $("title").text().trim() || undefined;

    const h1Elements = $("h1");
    const h1Text = h1Elements.toArray().map((el) => $(el).text().trim());

    const headingHierarchy: string[] = [];
    $("h1, h2, h3, h4, h5, h6").each((_, el) => {
      headingHierarchy.push(el.tagName.toLowerCase());
    });

    const imagesWithoutAltList: string[] = [];
    $("img").each((_, el) => {
      const alt = $(el).attr("alt");
      if (alt === undefined || alt === "") {
        const src = $(el).attr("src") || $(el).attr("data-src") || "";
        if (src && imagesWithoutAltList.length < 10) {
          imagesWithoutAltList.push(src.substring(0, 100));
        }
      }
    });

    const emptyLinksList: string[] = [];
    $("a").each((_, el) => {
      const href = $(el).attr("href");
      if (!href || href === "#" || href === "javascript:void(0)" || href === "javascript:;") {
        const text = $(el).text().trim().substring(0, 50) || "[no text]";
        const linkHref = href || "[no href]";
        if (emptyLinksList.length < 10) {
          emptyLinksList.push(`"${text}" → ${linkHref}`);
        }
      }
    });

    const jsFiles = $("script[src]").length;
    const cssFiles = $('link[rel="stylesheet"]').length;

    const renderBlockingScripts = $("head script[src]").filter((_, el) => {
      const async = $(el).attr("async");
      const defer = $(el).attr("defer");
      return async === undefined && defer === undefined;
    }).length;

    const webfonts = $('link[href*="fonts.googleapis.com"], link[href*="fonts.gstatic.com"]').length;
    const hasLazyLoading = $('img[loading="lazy"], img[data-src], img[data-lazy]').length > 0;

    const mixedContent: string[] = [];
    if (pageUrl.startsWith("https://")) {
      const pageHostname = new URL(pageUrl).hostname.replace(/^www\./, '');
      const isSameDomain = (url: string): boolean => {
        try {
          return new URL(url).hostname.replace(/^www\./, '') === pageHostname;
        } catch { return false; }
      };

      $('img[src^="http://"], script[src^="http://"], iframe[src^="http://"]').each((_, el) => {
        const src = $(el).attr("src");
        if (src && isSameDomain(src)) mixedContent.push(src);
      });
      $('link[rel="stylesheet"][href^="http://"]').each((_, el) => {
        const href = $(el).attr("href");
        if (href && isSameDomain(href)) mixedContent.push(href);
      });
    }

    const externalScripts: string[] = [];
    $("script[src]").each((_, el) => {
      const src = $(el).attr("src");
      if (src && !src.startsWith("/") && !src.startsWith(baseUrl)) {
        try {
          const scriptUrl = new URL(src, pageUrl);
          if (scriptUrl.origin !== baseUrl) {
            externalScripts.push(scriptUrl.href);
          }
        } catch {}
      }
    });

    const hasFavicon = $('link[rel*="icon"]').length > 0;
    const hasOgTags = $('meta[property^="og:"]').length >= 3;
    const hasTwitterCards = $('meta[name^="twitter:"]').length >= 2;
    const metaDescContent = $('meta[name="description"]').attr("content");
    const hasMetaDescription = Boolean(metaDescContent && metaDescContent.length > 0);

    const analysis: PageAnalysis = {
      url: pageUrl,
      title,
      h1Count: h1Elements.length,
      h1Text,
      headingHierarchy,
      imagesWithoutAlt: imagesWithoutAltList.length,
      imagesWithoutAltList,
      emptyLinks: emptyLinksList.length,
      emptyLinksList,
      jsFiles,
      cssFiles,
      renderBlockingScripts,
      webfonts,
      hasLazyLoading,
      mixedContent,
      externalScripts,
      hasFavicon,
      hasOgTags,
      hasTwitterCards,
      hasMetaDescription,
      pageSize: html.length,
    };

    return { analysis, links, images };
  } catch (error) {
    console.error(`Error analyzing ${pageUrl}:`, error);
    return { analysis: null, links, images };
  }
}

// ============= PARALLEL PROCESSING UTILITIES =============

/**
 * Process items in parallel with concurrency limit
 */
export async function processInParallel<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency: number = 5
): Promise<R[]> {
  const results: R[] = [];
  const queue = [...items];
  const inProgress: Promise<void>[] = [];

  const processNext = async (): Promise<void> => {
    if (queue.length === 0) return;

    const item = queue.shift()!;
    const result = await processor(item);
    results.push(result);
  };

  // Start initial batch
  while (inProgress.length < concurrency && queue.length > 0) {
    const promise = processNext().then(() => {
      inProgress.splice(inProgress.indexOf(promise), 1);
    });
    inProgress.push(promise);
  }

  // Process remaining items as slots become available
  while (queue.length > 0 || inProgress.length > 0) {
    if (inProgress.length > 0) {
      await Promise.race(inProgress);
    }
    while (inProgress.length < concurrency && queue.length > 0) {
      const promise = processNext().then(() => {
        inProgress.splice(inProgress.indexOf(promise), 1);
      });
      inProgress.push(promise);
    }
  }

  return results;
}

/**
 * Check multiple URLs in parallel with concurrency limit
 */
export async function checkUrlsBatch(
  urls: Array<{ url: string; source?: string }>,
  concurrency: number = 10
): Promise<Array<{ url: string; source?: string; status: number }>> {
  return processInParallel(
    urls,
    async (item) => {
      const { status } = await checkUrl(item.url);
      return { ...item, status };
    },
    concurrency
  );
}

// ============= UTILITIES =============

function resolveUrl(
  href: string,
  baseUrl: string,
  pageUrl: string
): string | null {
  try {
    if (
      href.startsWith("javascript:") ||
      href.startsWith("mailto:") ||
      href.startsWith("tel:") ||
      href.startsWith("#") ||
      href.startsWith("data:")
    ) {
      return null;
    }

    if (href.startsWith("http://") || href.startsWith("https://")) {
      return href;
    }

    if (href.startsWith("//")) {
      return `https:${href}`;
    }

    if (href.startsWith("/")) {
      return `${baseUrl}${href}`;
    }

    const pageBase = pageUrl.substring(0, pageUrl.lastIndexOf("/") + 1);
    return new URL(href, pageBase).href;
  } catch {
    return null;
  }
}

export function isExternalUrl(url: string, baseUrl: string): boolean {
  try {
    const urlHost = new URL(url).host;
    const baseHost = new URL(baseUrl).host;
    return urlHost !== baseHost;
  } catch {
    return false;
  }
}

// ============= SCORE CALCULATION =============

export function calculateScores(
  report: Omit<AuditReport, "scores">
): AuditReport["scores"] {
  // Links score (100 - penalty per error)
  const totalLinkErrors =
    report.errors.pages404.length +
    report.errors.internalLinks404.length +
    report.errors.brokenImages.length +
    report.errors.externalLinks404.length;
  const linksScore = Math.max(0, 100 - totalLinkErrors * 5);

  // Performance score
  const perfErrors = report.performance.filter(
    (i) => i.severity === "error"
  ).length;
  const perfWarnings = report.performance.filter(
    (i) => i.severity === "warning"
  ).length;
  const performanceScore = Math.max(
    0,
    100 - perfErrors * 10 - perfWarnings * 3
  );

  // HTML score
  const htmlErrors = report.html.filter((i) => i.severity === "error").length;
  const htmlWarnings = report.html.filter(
    (i) => i.severity === "warning"
  ).length;
  const htmlScore = Math.max(0, 100 - htmlErrors * 10 - htmlWarnings * 3);

  // Config score
  const configErrors = report.config.filter(
    (i) => i.severity === "error"
  ).length;
  const configWarnings = report.config.filter(
    (i) => i.severity === "warning"
  ).length;
  const configScore = Math.max(0, 100 - configErrors * 15 - configWarnings * 5);

  // Security score
  const secErrors = report.security.filter(
    (i) => i.severity === "error"
  ).length;
  const secWarnings = report.security.filter(
    (i) => i.severity === "warning"
  ).length;
  const securityScore = Math.max(0, 100 - secErrors * 20 - secWarnings * 5);

  // Overall (weighted average)
  const overall = Math.round(
    linksScore * 0.2 +
      performanceScore * 0.2 +
      htmlScore * 0.2 +
      configScore * 0.2 +
      securityScore * 0.2
  );

  return {
    links: Math.round(linksScore),
    performance: Math.round(performanceScore),
    html: Math.round(htmlScore),
    config: Math.round(configScore),
    security: Math.round(securityScore),
    overall,
  };
}
